import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

def get_coords_for_city(db: Session, city: str):
    row = db.execute(
        text("SELECT latitude, longitude FROM geocodes WHERE city=:c"),
        {"c": city}
    ).fetchone()
    if row:
        return float(row[0]), float(row[1])

    try:
        r = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": city, "count": 1},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()
    except requests.Timeout:
        raise RuntimeError("GeocodingTimeout: upstream geocoder timed out")
    except requests.RequestException as e:
        raise RuntimeError(f"GeocodingHTTP: {e}")

    if not data.get("results"):
        raise RuntimeError(f"GeocodingNoResult: City '{city}' not found")

    lat = float(data["results"][0]["latitude"])
    lon = float(data["results"][0]["longitude"])

    db.execute(
        text("REPLACE INTO geocodes (city, latitude, longitude) VALUES (:c, :lat, :lon)"),
        {"c": city, "lat": lat, "lon": lon},
    )
    db.commit()
    return lat, lon
