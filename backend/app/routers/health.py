from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import requests

from ..db import get_db

router = APIRouter()

@router.get("/simple")
def simple_health():
    """Simple health check without database dependency"""
    return {"status": "ok", "message": "Server is running"}

@router.get("/healthz")
def healthz(db: Session = Depends(get_db)):
    db_ok, db_err = True, None
    upstream_ok, up_err = True, None

    try:
        db.execute(text("SELECT 1")).scalar()
    except Exception as e:
        db_ok, db_err = False, str(e)

    # Make upstream check non-blocking with shorter timeout
    try:
        r = requests.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality"
            "?latitude=0&longitude=0&hourly=pm2_5&start_date=2025-01-01&end_date=2025-01-02",
            timeout=2  # Reduced timeout to prevent hanging
        )
        upstream_ok = r.status_code < 500
        if not upstream_ok:
            up_err = f"HTTP {r.status_code}"
    except Exception as e:
        upstream_ok, up_err = False, str(e)

    # Return ok status even if upstream is down - only fail if DB is down
    status = "ok" if db_ok else "degraded"
    return JSONResponse({
        "status": status,
        "db": {"ok": db_ok, "error": db_err},
        "upstream": {"ok": upstream_ok, "error": up_err}
    })
