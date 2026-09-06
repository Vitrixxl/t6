"""Construit l'horaire GTFS de recette pour le moteur MOTIS jetable de `bun run ci`.

Le réseau versionné (`data/transport/gtfs-feed.json`) porte la desserte et les
fréquences réelles de chaque ligne, mais pas d'horaires. Ce script en dérive un
GTFS minimal : une course par ligne et par sens, cadencée par `frequencies.txt`
à la fréquence publiée, avec des temps de parcours calculés sur la distance
entre arrêts. Il ne sert qu'à la recette : la production utilise l'archive
GTFS officielle TCL (voir infra/motis-entrypoint.sh).

Usage : python3 scripts/build-gtfs-fixture.py
"""

from __future__ import annotations

import csv
import io
import json
import math
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "data" / "transport" / "gtfs-feed.json"
OUTPUT = ROOT / "scripts" / "fixtures" / "lyon-ci.gtfs.zip"

# Emprise de l'extrait routier de recette (scripts/fixtures/README.md).
WEST, SOUTH, EAST, NORTH = 4.78, 45.72, 4.95, 45.81
# Vitesses commerciales par route_type GTFS, en km/h : tram, métro, bus, funiculaire.
SPEED_KMH = {0: 20.0, 1: 30.0, 3: 15.0, 7: 10.0}
DWELL_SECONDS = 30
SERVICE_START, SERVICE_END = "20260101", "20301231"
FIRST_DEPARTURE, LAST_DEPARTURE = "05:00:00", "24:00:00"


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    d_lat, d_lon = lat2 - lat1, lon2 - lon1
    value = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * 6371 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def inside(stop: dict) -> bool:
    return WEST <= stop["stop_lon"] <= EAST and SOUTH <= stop["stop_lat"] <= NORTH


def ordered_by_shape(stops: list[dict], shape: list[list[float]]) -> list[dict]:
    """Ordonne les arrêts d'une ligne sans desserte publiée le long de son tracé."""

    def nearest_index(stop: dict) -> int:
        return min(range(len(shape)), key=lambda i: haversine_km((stop["stop_lat"], stop["stop_lon"]), (shape[i][1], shape[i][0])))

    return sorted(stops, key=nearest_index)


def directions(route: dict, stops_by_id: dict[str, dict], served: dict[str, list[dict]]) -> list[list[dict]]:
    """Une liste d'arrêts par sens. Les bus publient leur desserte par sens ; le rail est déduit du tracé."""
    if route.get("stopSequence"):
        sequence = [stops_by_id[stop_id] for stop_id in route["stopSequence"] if stop_id in stops_by_id]
        return [sequence] if len(sequence) > 1 else []
    ordered = ordered_by_shape(served.get(route["route_id"], []), route["shape"])
    return [ordered, list(reversed(ordered))] if len(ordered) > 1 else []


def to_clock(seconds: int) -> str:
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def build() -> dict[str, list[list[object]]]:
    feed = json.loads(FEED.read_text(encoding="utf-8"))
    stops = [stop for stop in feed["stops"] if inside(stop)]
    stops_by_id = {stop["stop_id"]: stop for stop in stops}
    served: dict[str, list[dict]] = {}
    for stop in stops:
        for route_id in stop["routes"]:
            served.setdefault(route_id, []).append(stop)
    headways = {trip["route_id"]: trip["headway_minutes"] for trip in feed["trips"]}

    routes_rows, trips_rows, stop_times_rows, frequencies_rows = [], [], [], []
    used_stops: set[str] = set()
    for route in feed["routes"]:
        sequences = directions(route, stops_by_id, served)
        if not sequences:
            continue
        routes_rows.append([route["route_id"], "tcl", route["route_short_name"], route["route_long_name"], route["route_type"], route["route_color"], route["route_text_color"]])
        for direction, sequence in enumerate(sequences):
            trip_id = f"{route['route_id']}-{direction}"
            trips_rows.append([route["route_id"], "recette", trip_id, sequence[-1]["stop_name"], direction])
            elapsed = 0
            for index, stop in enumerate(sequence):
                if index > 0:
                    previous = sequence[index - 1]
                    distance = haversine_km((previous["stop_lat"], previous["stop_lon"]), (stop["stop_lat"], stop["stop_lon"]))
                    elapsed += int(distance / SPEED_KMH[route["route_type"]] * 3600) + DWELL_SECONDS
                stop_times_rows.append([trip_id, to_clock(elapsed), to_clock(elapsed), stop["stop_id"], index + 1])
                used_stops.add(stop["stop_id"])
            frequencies_rows.append([trip_id, FIRST_DEPARTURE, LAST_DEPARTURE, headways.get(route["route_id"], 10) * 60, 0])

    stops_rows = [[stop["stop_id"], stop["stop_name"], stop["stop_lat"], stop["stop_lon"], stop["wheelchair_boarding"]] for stop in stops if stop["stop_id"] in used_stops]
    agency = feed["agency"]
    return {
        "agency.txt": [["agency_id", "agency_name", "agency_url", "agency_timezone"], ["tcl", agency["agency_name"], agency["agency_url"], agency["agency_timezone"]]],
        "stops.txt": [["stop_id", "stop_name", "stop_lat", "stop_lon", "wheelchair_boarding"], *stops_rows],
        "routes.txt": [["route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color", "route_text_color"], *routes_rows],
        "calendar.txt": [["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"], ["recette", 1, 1, 1, 1, 1, 1, 1, SERVICE_START, SERVICE_END]],
        "trips.txt": [["route_id", "service_id", "trip_id", "trip_headsign", "direction_id"], *trips_rows],
        "stop_times.txt": [["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"], *stop_times_rows],
        "frequencies.txt": [["trip_id", "start_time", "end_time", "headway_secs", "exact_times"], *frequencies_rows],
    }


def main() -> None:
    tables = build()
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, rows in tables.items():
            buffer = io.StringIO()
            csv.writer(buffer, lineterminator="\n").writerows(rows)
            archive.writestr(name, buffer.getvalue())
    print(f"GTFS de recette : {OUTPUT} ({len(tables['stops.txt']) - 1} arrêts, {len(tables['routes.txt']) - 1} lignes, {len(tables['trips.txt']) - 1} courses cadencées)")


if __name__ == "__main__":
    main()
