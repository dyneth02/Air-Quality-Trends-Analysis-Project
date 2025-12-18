import os
import logging
from typing import List, Dict, Any, Tuple, Optional


logger = logging.getLogger(__name__)


def _parse_weights(env_val: Optional[str]) -> Dict[str, float]:
    weights: Dict[str, float] = {}
    if not env_val:
        return weights
    try:
        parts = [p.strip() for p in env_val.split(',') if p.strip()]
        for part in parts:
            if '=' in part:
                k, v = part.split('=', 1)
                k = k.strip()
                try:
                    weights[k] = float(v)
                except Exception:
                    pass
    except Exception:
        logger.warning("Failed to parse AGG_WEIGHTS: %r", env_val)
    return weights


def _zscore_trim(values: List[Tuple[float, float]], z: float) -> List[Tuple[float, float]]:
    # values as (x, weight)
    if not values:
        return values
    xs = [x for x, _ in values]
    mean = sum(xs) / len(xs)
    var = sum((x - mean) ** 2 for x in xs) / max(1, len(xs) - 1)
    std = var ** 0.5
    if std == 0:
        return values
    kept: List[Tuple[float, float]] = []
    for x, w in values:
        if abs((x - mean) / std) <= z:
            kept.append((x, w))
    return kept


def _iqr_trim(values: List[Tuple[float, float]], k: float) -> List[Tuple[float, float]]:
    if not values:
        return values
    xs = sorted(x for x, _ in values)
    n = len(xs)
    if n < 4:
        return values
    q1 = xs[n // 4]
    q3 = xs[(3 * n) // 4]
    iqr = q3 - q1
    lo = q1 - k * iqr
    hi = q3 + k * iqr
    kept: List[Tuple[float, float]] = []
    for x, w in values:
        if lo <= x <= hi:
            kept.append((x, w))
    return kept


def _maybe_trim(values: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    # Config: AGG_TRIM (0/1), AGG_TRIM_METHOD (zscore|iqr), AGG_Z (default 3.0), AGG_IQR_K (default 1.5)
    if not values:
        return values
    try:
        do_trim = os.getenv('AGG_TRIM', '0') in ('1', 'true', 'True')
        if not do_trim:
            return values
        method = os.getenv('AGG_TRIM_METHOD', 'zscore').lower()
        if method == 'iqr':
            k = float(os.getenv('AGG_IQR_K', '1.5'))
            return _iqr_trim(values, k)
        else:
            z = float(os.getenv('AGG_Z', '3.0'))
            return _zscore_trim(values, z)
    except Exception:
        return values


def _weighted_mean(values: List[Tuple[float, float]]) -> Optional[float]:
    if not values:
        return None
    num = sum(x * w for x, w in values)
    den = sum(w for _, w in values)
    if den == 0:
        return None
    return num / den


def combine_by_timestamp(city: str, lat: float, lon: float, *sources_rows: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Merge rows from multiple sources by ts and compute (weighted) means.
    Returns rows with source='aggregated'.
    Each input row is expected to have: ts (str or datetime), city, latitude, longitude, pm25, pm10, source
    """
    weights_cfg = _parse_weights(os.getenv('AGG_WEIGHTS'))
    by_ts: Dict[str, Dict[str, List[Tuple[float, float]]]] = {}

    for rows in sources_rows:
        for r in rows or []:
            ts = str(r.get('ts'))
            source = str(r.get('source') or '').lower()
            w = float(weights_cfg.get(source, 1.0))
            bucket = by_ts.setdefault(ts, {"pm25": [], "pm10": []})
            try:
                pm25 = r.get('pm25')
                if pm25 is not None:
                    bucket['pm25'].append((float(pm25), w))
            except Exception:
                pass
            try:
                pm10 = r.get('pm10')
                if pm10 is not None:
                    bucket['pm10'].append((float(pm10), w))
            except Exception:
                pass

    out: List[Dict[str, Any]] = []
    for ts, measures in by_ts.items():
        vals25 = _maybe_trim(measures.get('pm25', []))
        vals10 = _maybe_trim(measures.get('pm10', []))
        mean25 = _weighted_mean(vals25)
        mean10 = _weighted_mean(vals10)
        if mean25 is None and mean10 is None:
            continue
        out.append({
            'ts': ts,
            'city': city,
            'latitude': lat,
            'longitude': lon,
            'pm25': mean25,
            'pm10': mean10,
            'source': 'aggregated',
        })

    return out



