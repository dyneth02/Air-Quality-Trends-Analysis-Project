import logging
from datetime import datetime, date
from typing import List, Dict, Any, Optional

import requests
from bs4 import BeautifulSoup  # type: ignore

from .normalize import make_row, parse_ts


logger = logging.getLogger(__name__)

TIMEOUT = 15
RETRIES = 2


def _get(url: str, params: Dict[str, Any] = None, headers: Dict[str, Any] = None) -> Optional[requests.Response]:
    params = params or {}
    headers = headers or {"User-Agent": "Mozilla/5.0 (compatible; AirQualityBot/1.0)"}
    for i in range(RETRIES + 1):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
            if r.status_code == 200:
                return r
            logger.warning("WAQI non-200: %s", r.status_code)
        except Exception as e:
            logger.warning("WAQI request failed (try %s): %s", i + 1, e)
    return None


def fetch_waqi(city: str, start: date, end: date, lat: float = None, lon: float = None, token: Optional[str] = None) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    try:
        if token:
            # API mode
            url = f"https://api.waqi.info/feed/{city}/"
            res = _get(url, params={"token": token})
            if res is not None:
                try:
                    data = res.json()
                    iaqi = (data or {}).get("data", {}).get("iaqi", {})
                    time_obj = (data or {}).get("data", {}).get("time", {})
                    ts = parse_ts(time_obj.get("utc") or time_obj.get("s")) or datetime.utcnow()
                    pm25 = iaqi.get("pm25", {}).get("v")
                    pm10 = iaqi.get("pm10", {}).get("v")
                    rows.append(make_row(ts=ts, city=city, latitude=lat, longitude=lon, pm25=pm25, pm10=pm10, source="waqi"))
                    return rows
                except Exception:
                    logger.warning("WAQI API parse failed")

        # HTML scrape fallback
        # WAQI station/city page URLs vary; a simple guess:
        slug = city.strip().lower().replace(" ", "-")
        url = f"https://aqicn.org/city/{slug}/"
        res = _get(url)
        if res is None:
            return rows
        html = res.text
        soup = BeautifulSoup(html, "html.parser")

        # Attempt to extract a current timestamp and values
        ts = datetime.utcnow()
        pm25 = None
        pm10 = None
        try:
            # common layout: elements with id like 'pm25', 'pm10'
            el25 = soup.select_one('#pm25 .value') or soup.select_one('[data-pollutant="pm25"] .value')
            if el25:
                try:
                    pm25 = float(el25.get_text(strip=True))
                except Exception:
                    pm25 = None
            el10 = soup.select_one('#pm10 .value') or soup.select_one('[data-pollutant="pm10"] .value')
            if el10:
                try:
                    pm10 = float(el10.get_text(strip=True))
                except Exception:
                    pm10 = None
            # time may be in a tag with class/time-id; fallback to now
            time_el = soup.find(class_='time')
            if time_el:
                ts_parsed = parse_ts(time_el.get_text(" ").strip())
                if ts_parsed:
                    ts = ts_parsed
        except Exception:
            pass

        rows.append(make_row(ts=ts, city=city, latitude=lat, longitude=lon, pm25=pm25, pm10=pm10, source="waqi"))
    except Exception as e:
        logger.warning("fetch_waqi failed: %s", e)
    return rows



