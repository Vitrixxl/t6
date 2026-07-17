"""Integre le GTFS statique reel du reseau TCL (SYTRAL, licence ODbL).

Telecharge le zip GTFS officiel publie sur transport.data.gouv.fr, extrait les
arrets et lignes structurantes autour du centre de la metropole et genere
`public/data/gtfs-feed.json` consomme par l'application.

Aucune dependance externe: stdlib uniquement.
"""

from __future__ import annotations

import csv
import io
import json
import math
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp" / "gtfs" / "lyon_tcl.zip"
OUTPUT = ROOT / "public" / "data" / "gtfs-feed.json"

# URL officielle de la ressource GTFS "Reseau urbain TCL" (transport.data.gouv.fr, ODbL).
GTFS_URL = (
    "https://gtech-transit-prod.apigee.net/v1/google/gtfs/odbl/lyon_tcl.zip"
    "?apikey=BasyG6OFZXgXnzWdQLTwJFGcGmeOs204&secret=gNo6F5PhQpsGRBCK"
)

CENTER_LAT = 45.7578
CENTER_LON = 4.8320
RADIUS_KM = 3.2
MAX_STOPS = 130
CACHE_MAX_AGE_HOURS = 24

# route_type GTFS: 0 tram, 1 metro, 3 bus, 7 funiculaire.
KEPT_ROUTE_TYPES = {0, 1, 7}
HEADWAY_BY_TYPE = {1: 4, 0: 8, 7: 10}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def download_gtfs() -> Path:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if CACHE.exists() and (time.time() - CACHE.stat().st_mtime) < CACHE_MAX_AGE_HOURS * 3600:
        print(f"Cache GTFS reutilise: {CACHE}")
        return CACHE
    print("Telechargement du GTFS TCL (~43 Mo)...")
    request = urllib.request.Request(GTFS_URL, headers={"User-Agent": "urbanflow-mobility-build"})
    with urllib.request.urlopen(request, timeout=180) as response, CACHE.open("wb") as target:
        target.write(response.read())
    print(f"GTFS telecharge: {CACHE}")
    return CACHE


def read_csv(archive: zipfile.ZipFile, filename: str) -> list[dict[str, str]]:
    with archive.open(filename) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig")
        return list(csv.DictReader(text))


def build_feed(archive: zipfile.ZipFile) -> dict:
    agencies = read_csv(archive, "agency.txt")
    agency = agencies[0] if agencies else {}

    routes = [
        {
            "route_id": row["route_id"],
            "route_short_name": row.get("route_short_name", ""),
            "route_long_name": row.get("route_long_name", ""),
            "route_type": int(row.get("route_type", 3) or 3),
            "route_color": row.get("route_color") or "6B7280",
            "route_text_color": row.get("route_text_color") or "FFFFFF",
        }
        for row in read_csv(archive, "routes.txt")
        if int(row.get("route_type", 3) or 3) in KEPT_ROUTE_TYPES
    ]
    routes.sort(key=lambda route: (route["route_type"], route["route_short_name"]))

    seen_names: set[str] = set()
    stops = []
    for row in read_csv(archive, "stops.txt"):
        if row.get("location_type", "0") not in ("", "0", "1"):
            continue
        try:
            lat = float(row["stop_lat"])
            lon = float(row["stop_lon"])
        except (KeyError, ValueError):
            continue
        distance = haversine_km(CENTER_LAT, CENTER_LON, lat, lon)
        if distance > RADIUS_KM:
            continue
        name = row.get("stop_name", "").strip()
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())
        wheelchair = row.get("wheelchair_boarding", "0") or "0"
        stops.append(
            {
                "stop_id": row["stop_id"],
                "stop_name": name,
                "stop_lat": round(lat, 6),
                "stop_lon": round(lon, 6),
                "wheelchair_boarding": int(wheelchair) if wheelchair in ("0", "1", "2") else 0,
                "_distance": distance,
            }
        )

    stops.sort(key=lambda stop: stop["_distance"])
    stops = stops[:MAX_STOPS]
    for stop in stops:
        stop.pop("_distance")

    trips = [
        {
            "trip_id": f"{route['route_id']}-service",
            "route_id": route["route_id"],
            "service_id": "weekday",
            "headway_minutes": HEADWAY_BY_TYPE.get(route["route_type"], 12),
            "realtime_delay_minutes": sum(ord(c) for c in route["route_id"]) % 3,
            "occupancy": ["low", "medium", "high"][sum(ord(c) for c in route["route_id"]) % 3],
        }
        for route in routes
    ]

    return {
        "agency": {
            "agency_id": agency.get("agency_id", "TCL"),
            "agency_name": agency.get("agency_name", "TCL SYTRAL"),
            "agency_url": agency.get("agency_url", "https://www.tcl.fr"),
            "agency_timezone": agency.get("agency_timezone", "Europe/Paris"),
        },
        "stops": stops,
        "routes": routes,
        "trips": trips,
        "incidents": [
            {
                "id": "inc-demo-1",
                "severity": "medium",
                "title": "Travaux quai Saint-Antoine (simulation)",
                "affected_modes": ["bike", "scooter"],
                "message": "Piste cyclable deviee entre Bellecour et Cordeliers. Flux SIRI operateur sous cle: incident simule.",
            },
            {
                "id": "inc-demo-2",
                "severity": "high",
                "title": "Affluence forte pole Part-Dieu (simulation)",
                "affected_modes": ["transit"],
                "message": "Prevoir 5 min supplementaires en correspondance. Flux SIRI operateur sous cle: incident simule.",
            },
        ],
        "weather": {
            "condition": "clear",
            "temperature_celsius": 21,
            "wind_kmh": 12,
            "updated_at": "2026-09-14T08:00:00+02:00",
        },
    }


def main() -> None:
    archive_path = download_gtfs()
    with zipfile.ZipFile(archive_path) as archive:
        feed = build_feed(archive)
    OUTPUT.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Feed genere: {OUTPUT} ({len(feed['stops'])} arrets, {len(feed['routes'])} lignes,"
        f" agence {feed['agency']['agency_name']})"
    )


if __name__ == "__main__":
    main()
