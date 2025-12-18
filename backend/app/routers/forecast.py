from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas import ForecastIn, ForecastMultiIn
from ..core.security import get_plan, Plan
from ..core.tiers import enforce_forecast
from ..services.forecast import forecast_city, fit_and_save_model, backtest_roll, forecast_cities

router = APIRouter()

@router.post("/forecast")
def forecast(payload: ForecastIn, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    enforce_forecast(plan, payload.horizonDays, 1)
    result = forecast_city(db, payload.city, payload.horizonDays, payload.trainDays, payload.use_cache)
    return {"ok": True, **result}

@router.post("/forecast/train")
def forecast_train(payload: ForecastIn, db: Session = Depends(get_db)):
    path = fit_and_save_model(db, payload.city, payload.trainDays)
    return {"ok": True, "modelPath": path}

@router.get("/forecast/backtest")
def forecast_backtest(city: str, days: int = 30, horizonHours: int = 24, db: Session = Depends(get_db)):
    stats = backtest_roll(db, city, days, horizonHours)
    return {"ok": True, **stats}

@router.post("/forecast/multi")
def forecast_multi(payload: ForecastMultiIn, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    if not payload.cities:
        raise HTTPException(400, "No cities provided")
    enforce_forecast(plan, payload.horizonDays, len(payload.cities))
    out = forecast_cities(db, payload.cities, payload.horizonDays, payload.trainDays, payload.use_cache)
    return {"ok": True, **out, "horizonDays": payload.horizonDays}
