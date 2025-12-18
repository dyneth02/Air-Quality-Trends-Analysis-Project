import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from dateutil import parser as dtparser


logger = logging.getLogger(__name__)


def align_to_hour(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    ts = ts.astimezone(timezone.utc)
    return ts.replace(minute=0, second=0, microsecond=0, tzinfo=timezone.utc)


def parse_ts(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    try:
        if isinstance(value, datetime):
            return value
        return dtparser.parse(str(value))
    except Exception:
        logger.debug("Failed to parse timestamp: %r", value)
        return None


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        f = float(value)
        return f
    except Exception:
        return None


def clean_pollutant(value: Any) -> Optional[float]:
    f = safe_float(value)
    if f is None:
        return None
    if f < 0 or f > 1000:
        return None
    return f


def make_row(ts: datetime, city: str, latitude: Optional[float], longitude: Optional[float],
             pm25: Optional[float], pm10: Optional[float], source: str) -> Dict[str, Any]:
    return {
        "ts": align_to_hour(ts).strftime("%Y-%m-%d %H:00:00"),
        "city": city,
        "latitude": safe_float(latitude),
        "longitude": safe_float(longitude),
        "pm25": clean_pollutant(pm25),
        "pm10": clean_pollutant(pm10),
        "source": source,
    }



