from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas import CityWindowIn, CompareIn
from ..core.security import get_plan, Plan
from ..core.tiers import enforce_scrape, enforce_compare
import os
from ..services.scraper import ensure_window_for_city, ensure_window_for_city_with_counts
from ..utils.compare import compare_logic

router = APIRouter()

@router.post("/scrape")
def scrape_city(payload: CityWindowIn, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    enforce_scrape(plan, payload.days)
    inserted, (lat, lon) = ensure_window_for_city(db, payload.city, payload.days, payload.sources)
    return {"ok": True, "city": payload.city, "inserted": inserted, "lat": lat, "lon": lon}

@router.post("/compare")
def compare_cities(payload: CompareIn, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    if not payload.cities:
        raise HTTPException(400, "No cities provided")
    enforce_compare(plan, payload.cities, payload.days)
    for c in payload.cities:
        ensure_window_for_city(db, c, payload.days, None)
    return {"ok": True, **compare_logic(db, payload.cities, payload.days)}


@router.post("/scrape/aggregate")
def scrape_city_aggregate(payload: CityWindowIn, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    enforce_scrape(plan, payload.days)
    counts, (lat, lon) = ensure_window_for_city_with_counts(db, payload.city, payload.days, payload.sources)
    # Emphasize aggregated counts, include which sources contributed
    sources_enabled = payload.sources
    if not sources_enabled:
        env_val = os.getenv('SOURCES_ENABLED', '')
        sources_enabled = [s.strip() for s in env_val.split(',') if s.strip()] or ["openaq", "iqair", "waqi"]
    return {
        "ok": True,
        "city": payload.city,
        "lat": lat,
        "lon": lon,
        "inserted": sum(counts.values()),
        "counts": counts,
        "sources_enabled": sources_enabled,
        "aggregated": counts.get('aggregated', 0),
    }
