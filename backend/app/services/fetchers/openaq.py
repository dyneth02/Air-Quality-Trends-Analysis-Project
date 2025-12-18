import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

import requests

from .normalize import make_row, parse_ts


logger = logging.getLogger(__name__)

BASE_URL = "https://api.openaq.org/v2"
TIMEOUT = 15  # seconds
RETRIES = 2


def _req(url: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for i in range(RETRIES + 1):
        try:
            r = requests.get(url, params=params, timeout=TIMEOUT)
            if r.status_code == 200:
                return r.json()
            logger.warning("OpenAQ non-200: %s %s", r.status_code, r.text[:200])
        except Exception as e:
            logger.warning("OpenAQ request failed (try %s): %s", i + 1, e)
    return None


def fetch_openaq(city: str, start: date, end: date, lat: float = None, lon: float = None) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    try:
        # OpenAQ measurements endpoint: we will fetch PM2.5 and PM10 separately and then merge by timestamp
        start_dt = datetime.combine(start, datetime.min.time())
        end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time())  # inclusive end day

        params_base = {
            "limit": 100,
            "page": 1,
            "offset": 0,
            "parameter": "pm25",
            "date_from": start_dt.isoformat() + "Z",
            "date_to": end_dt.isoformat() + "Z",
            "order_by": "datetime",
            "sort": "asc",
        }
        if city:
            params_base["city"] = city
        if lat is not None and lon is not None:
            params_base["coordinates"] = f"{lat},{lon}"
            params_base["radius"] = 20000

        def fetch_param(param: str) -> List[Dict[str, Any]]:
            merged: List[Dict[str, Any]] = []
            params = dict(params_base)
            params["parameter"] = param
            page = 1
            while True:
                params["page"] = page
                data = _req(f"{BASE_URL}/measurements", params)
                if not data or "results" not in data:
                    break
                res = data["results"]
                if not res:
                    break
                merged.extend(res)
                if len(res) < params["limit"]:
                    break
                page += 1
            return merged

        pm25_res = fetch_param("pm25")
        pm10_res = fetch_param("pm10")

        # Index by hour timestamp
        by_ts: Dict[str, Dict[str, Any]] = {}

        def add_values(items, key):
            for it in items:
                ts = parse_ts(it.get("date", {}).get("utc")) or parse_ts(it.get("date", {}).get("local"))
                if not ts:
                    continue
                ts_hr = ts.replace(minute=0, second=0, microsecond=0)
                k = ts_hr.strftime("%Y-%m-%d %H:00:00")
                ent = by_ts.setdefault(k, {"lat": it.get("coordinates", {}).get("latitude"),
                                           "lon": it.get("coordinates", {}).get("longitude")})
                val = it.get("value")
                try:
                    ent[key] = float(val)
                except Exception:
                    pass

        add_values(pm25_res, "pm25")
        add_values(pm10_res, "pm10")

        for k, ent in by_ts.items():
            ts_dt = parse_ts(k) or datetime.utcnow()
            rows.append(
                make_row(
                    ts=ts_dt,
                    city=city,
                    latitude=ent.get("lat"),
                    longitude=ent.get("lon"),
                    pm25=ent.get("pm25"),
                    pm10=ent.get("pm10"),
                    source="openaq",
                )
            )
    except Exception as e:
        logger.warning("fetch_openaq failed: %s", e)
    return rows



