# forecast_prophet.py (service)
from __future__ import annotations
import os
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error
from joblib import dump, load
import logging

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def _load_series(db: Session, city: str, days: int) -> pd.DataFrame:
    """Pull last N days from MySQL as a pandas hourly series (pm2.5 as target)."""

    rows = db.execute(text("""
                           SELECT ts, pm25
                           FROM measurements
                           WHERE city = :city
                             AND source = 'aggregated'
                             AND ts >= DATE_SUB(NOW(), INTERVAL :days DAY)
                           ORDER BY ts
                           """), {"city": city, "days": days}).mappings().all()

    if not rows:
        raise ValueError(f"No data found for {city} in last {days} days. Run /scrape first.")

    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["ts"])
    df = df.set_index("ts").sort_index()

    # Ensure hourly frequency and fill small gaps
    df = df.asfreq("H")
    # Simple imputation for small gaps
    df["pm25"] = df["pm25"].interpolate(limit_direction="both")

    return df  # columns: pm25 (float), index: hourly ts

def _model_path(city: str) -> str:
    """Generate safe filesystem path for model storage."""
    safe = city.lower().replace(" ", "_")
    return os.path.join(MODELS_DIR, f"{safe}_prophet.joblib")

def train_prophet(df: pd.DataFrame) -> Prophet:
    """
    Build a Prophet model for hourly PM2.5 forecasting.
    Prophet expects DataFrame with 'ds' (datetime) and 'y' (target) columns.

    Configuration:
    - Daily seasonality enabled (24-hour pattern)
    - Weekly seasonality enabled (7-day pattern)
    - Yearly seasonality disabled (not enough data typically)
    - Changepoint prior scale: controls flexibility (0.05 = moderate)
    - Seasonality prior scale: controls seasonality strength (10.0 = default)
    """

    # Prepare data in Prophet format
    prophet_df = pd.DataFrame({
        'ds': df.index,
        'y': df['pm25'].astype(float)
    })

    # Remove any NaN values
    prophet_df = prophet_df.dropna()

    # Initialize Prophet model with appropriate settings for hourly data
    model = Prophet(
        daily_seasonality=True,      # Capture daily patterns
        weekly_seasonality=True,     # Capture weekly patterns
        yearly_seasonality=False,    # Disable yearly (usually not enough data)
        changepoint_prior_scale=0.05,  # Moderate flexibility for trend changes
        seasonality_prior_scale=10.0,  # Default seasonality strength
        seasonality_mode='additive',   # Additive seasonality (can use 'multiplicative' if needed)
        interval_width=0.80,          # 80% confidence intervals (matches SARIMAX version)
    )

    # Add hourly seasonality explicitly (Prophet doesn't add this by default)
    # Fourier order of 8 captures complex hourly patterns
    model.add_seasonality(
        name='hourly',
        period=24,
        fourier_order=8
    )

    return model

def fit_and_save_model(db: Session, city: str, train_days: int = 30) -> str:
    """
    Fit Prophet model on training data and save to disk.

    Args:
        db: Database session
        city: City name
        train_days: Number of days to use for training (default: 30)

    Returns:
        Path to saved model file
    """
    df = _load_series(db, city, days=train_days)

    # Prepare Prophet DataFrame
    prophet_df = pd.DataFrame({
        'ds': df.index,
        'y': df['pm25'].astype(float)
    }).dropna()

    # Initialize and fit model
    model = train_prophet(df)
    model.fit(prophet_df)

    # Save fitted model
    path = _model_path(city)
    dump(model, path)
    logger.info(f"Prophet model saved for {city} at {path}")

    return path

def forecast_city(
        db: Session,
        city: str,
        horizon_days: int = 7,
        train_days: int = 30,
        use_cache: bool = True
):
    """
    Fit (or load) a Prophet model and forecast H days ahead with confidence intervals.

    Args:
        db: Database session
        city: City name
        horizon_days: Number of days to forecast ahead
        train_days: Number of days to use for training
        use_cache: Whether to use cached model if available

    Returns:
        Dict with city, horizon_hours, and forecast series
    """
    path = _model_path(city)
    model = None

    # Try to load cached model
    if use_cache and os.path.exists(path):
        try:
            model = load(path)
            logger.info(f"Loaded cached Prophet model for {city}")
        except Exception as e:
            logger.warning(f"Failed to load cached model for {city}: {e}")
            model = None

    # Train new model if cache miss or disabled
    if model is None:
        df = _load_series(db, city, days=train_days)

        # Prepare Prophet DataFrame
        prophet_df = pd.DataFrame({
            'ds': df.index,
            'y': df['pm25'].astype(float)
        }).dropna()

        # Initialize and fit model
        model = train_prophet(df)
        model.fit(prophet_df)

        # Save for future use
        dump(model, path)
        logger.info(f"Trained and saved new Prophet model for {city}")

    # Generate future dataframe for forecasting
    steps = int(horizon_days * 24)  # Convert days to hours
    future = model.make_future_dataframe(periods=steps, freq='H')

    # Make predictions
    forecast = model.predict(future)

    # Extract only future predictions (not historical)
    forecast_future = forecast.tail(steps)

    # Format output
    out = []
    for _, row in forecast_future.iterrows():
        out.append({
            "ts": row['ds'].strftime("%Y-%m-%d %H:%M:%S"),
            "yhat": float(row['yhat']),
            "yhat_lower": float(row['yhat_lower']),
            "yhat_upper": float(row['yhat_upper'])
        })

    return {
        "city": city,
        "horizon_hours": steps,
        "series": out
    }

def backtest_roll(
        db: Session,
        city: str,
        days: int = 30,
        horizon_hours: int = 24
):
    """
    Simple rolling-origin backtest: walk forward, forecast H hours, compute MAE/RMSE.

    Args:
        db: Database session
        city: City name
        days: Total days of data to use for backtesting
        horizon_hours: Forecast horizon in hours

    Returns:
        Dict with city, days, horizon_hours, mae, and rmse
    """
    df = _load_series(db, city, days=days)
    y = df["pm25"].astype(float).dropna()

    # Choose checkpoints every 24 hours to keep it fast
    min_train = 24 * 7  # Minimum 7 days training
    checkpoints = list(range(min_train, len(y) - horizon_hours, 24))

    if not checkpoints:
        raise ValueError(f"Not enough data for backtesting. Need at least {min_train + horizon_hours} hours")

    preds, trues = [], []

    for i, cut in enumerate(checkpoints):
        try:
            # Prepare training data
            train_y = y.iloc[:cut]
            train_df = pd.DataFrame({
                'ds': train_y.index,
                'y': train_y.values
            })

            # Train model
            model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=False,
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10.0,
                seasonality_mode='additive',
                interval_width=0.80,
            )
            model.add_seasonality(name='hourly', period=24, fourier_order=8)

            # Suppress Prophet's verbose logging
            with suppress_stdout_stderr():
                model.fit(train_df)

            # Forecast
            future = model.make_future_dataframe(periods=horizon_hours, freq='H')
            forecast = model.predict(future)
            fc = forecast.tail(horizon_hours)['yhat']

            # Get true values
            true = y.iloc[cut:cut + horizon_hours]

            # Align lengths (edge cases)
            n = min(len(fc), len(true))
            preds.extend(fc.iloc[:n].values)
            trues.extend(true.iloc[:n].values)

            logger.info(f"Backtest checkpoint {i+1}/{len(checkpoints)} completed for {city}")

        except Exception as e:
            logger.warning(f"Backtest checkpoint {i+1} failed for {city}: {e}")
            continue

    if not preds or not trues:
        raise ValueError(f"Backtest failed: no valid predictions generated for {city}")

    # Compute metrics
    mae = float(mean_absolute_error(trues, preds))
    rmse = float(np.sqrt(mean_squared_error(trues, preds)))

    return {
        "city": city,
        "days": days,
        "horizon_hours": horizon_hours,
        "mae": mae,
        "rmse": rmse,
        "n_checkpoints": len(checkpoints),
        "n_predictions": len(preds)
    }

def forecast_cities(
        db: Session,
        cities: list[str],
        horizon_days: int = 7,
        train_days: int = 30,
        use_cache: bool = True,
):
    """
    Runs forecast_city for each city and returns a dict { city -> series }.
    Also returns a small summary (mean predicted pm25 per city) to pick best/worst.

    Args:
        db: Database session
        cities: List of city names
        horizon_days: Number of days to forecast ahead
        train_days: Number of days to use for training
        use_cache: Whether to use cached models

    Returns:
        Dict with byCity forecasts, summary stats, best city, and worst city
    """
    results = {}
    summary = {}

    for city in cities:
        try:
            fc = forecast_city(db, city, horizon_days, train_days, use_cache)
            results[city] = fc["series"]

            # Mean of yhat over the horizon for ranking
            vals = [p["yhat"] for p in fc["series"] if p.get("yhat") is not None]
            summary[city] = {
                "mean_yhat": (sum(vals) / len(vals)) if vals else None,
                "n_points": len(vals)
            }
            logger.info(f"Forecast completed for {city}: mean_yhat={summary[city]['mean_yhat']:.2f}")

        except Exception as e:
            logger.error(f"Forecast failed for {city}: {e}")
            results[city] = {"error": str(e)}
            summary[city] = {"mean_yhat": None, "n_points": 0}

    # Pick best/worst by mean_yhat (lower is "cleaner")
    valid = {c: s for c, s in summary.items() if s["mean_yhat"] is not None}
    best = min(valid, key=lambda c: valid[c]["mean_yhat"]) if valid else None
    worst = max(valid, key=lambda c: valid[c]["mean_yhat"]) if valid else None

    return {
        "byCity": results,
        "summary": summary,
        "best": best,
        "worst": worst
    }

# Utility context manager to suppress Prophet's verbose output
class suppress_stdout_stderr:
    """
    Context manager to suppress stdout and stderr.
    Useful for suppressing Prophet's verbose logging during backtesting.
    """
    def __enter__(self):
        import sys
        self.old_stdout = sys.stdout
        self.old_stderr = sys.stderr
        sys.stdout = open(os.devnull, 'w')
        sys.stderr = open(os.devnull, 'w')

    def __exit__(self, exc_type, exc_val, exc_tb):
        import sys
        sys.stdout.close()
        sys.stderr.close()
        sys.stdout = self.old_stdout
        sys.stderr = self.old_stderr