"""Normalise les horaires GTFS sans publier l'archive ni son URL d'accès."""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODES = {0, 1, 7}
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def rows(archive, name):
    if name not in archive.namelist():
        return []
    with archive.open(name) as raw:
        return list(csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig")))


def seconds(value):
    hours, minutes, secs = map(int, value.split(":"))
    if not (0 <= hours < 168 and 0 <= minutes < 60 and 0 <= secs < 60):
        raise ValueError("Heure GTFS invalide.")
    return hours * 3600 + minutes * 60 + secs


def civil(value):
    return datetime.strptime(value, "%Y%m%d").date()


def service_dates(archive):
    services = defaultdict(set)
    for row in rows(archive, "calendar.txt"):
        day, end = civil(row["start_date"]), civil(row["end_date"])
        if (end - day).days > 730:
            raise ValueError("Calendrier de plus de deux ans : vérifier l'archive.")
        while day <= end:
            if row[WEEKDAYS[day.weekday()]] == "1":
                services[row["service_id"]].add(day.isoformat())
            day += timedelta(days=1)
    for row in rows(archive, "calendar_dates.txt"):
        day = civil(row["date"]).isoformat()
        if row["exception_type"] == "1":
            services[row["service_id"]].add(day)
        elif row["exception_type"] == "2":
            services[row["service_id"]].discard(day)
    return services


def read_routes(archive):
    return {row["route_id"]: {
        "route_id": row["route_id"], "route_short_name": row.get("route_short_name", ""),
        "route_long_name": row.get("route_long_name", ""), "route_type": int(row["route_type"]),
        "route_color": row.get("route_color") or "1d6b4f",
        "route_text_color": row.get("route_text_color") or "ffffff", "shape": [],
    } for row in rows(archive, "routes.txt")
        if int(row["route_type"]) in MODES and row.get("route_short_name", "").upper() not in {"RX", "RHONEXPRESS"}}


def read_stops(archive):
    raw = {row["stop_id"]: row for row in rows(archive, "stops.txt")}
    result = {}
    for stop_id, row in raw.items():
        if row.get("location_type", "0") not in ("", "0"):
            continue
        parent = raw.get(row.get("parent_station"), {})
        wheelchair = row.get("wheelchair_boarding") or parent.get("wheelchair_boarding") or "0"
        result[stop_id] = {
            "stop_id": stop_id, "stop_name": row["stop_name"],
            "stop_lat": float(row["stop_lat"]), "stop_lon": float(row["stop_lon"]),
            "wheelchair_boarding": int(wheelchair), "parent_station": row.get("parent_station") or "", "routes": [],
        }
    return result


def read_shapes(archive):
    grouped = defaultdict(list)
    for row in rows(archive, "shapes.txt"):
        grouped[row["shape_id"]].append(row)
    return {key: [
        [float(row["shape_pt_lon"]), float(row["shape_pt_lat"])]
        for row in sorted(values, key=lambda row: int(row["shape_pt_sequence"]))
    ] for key, values in grouped.items()}


def squared_distance(point, stop):
    x = (point[0] - stop["stop_lon"]) * math.cos(math.radians(stop["stop_lat"]))
    y = point[1] - stop["stop_lat"]
    return (x * x + y * y) * 111_320 ** 2


def locate_passages(passages, points, stops):
    previous = -1
    for passage in passages:
        candidates = range(previous + 1, len(points))
        if not candidates:
            raise ValueError("Ordre des quais incompatible avec le tracé.")
        index = min(candidates, key=lambda i: squared_distance(points[i], stops[passage["stopId"]]))
        if squared_distance(points[index], stops[passage["stopId"]]) > 200 ** 2:
            raise ValueError("Un quai est à plus de 200 m du tracé publié.")
        passage["shapeIndex"] = index
        previous = index


def trip_passages(values):
    result = []
    for row in sorted(values, key=lambda row: int(row["stop_sequence"])):
        arrival = row.get("arrival_time") or row.get("departure_time")
        departure = row.get("departure_time") or arrival
        if not arrival or not departure:
            raise ValueError("Passage sans heure : interpolation non autorisée.")
        result.append({
            "stopId": row["stop_id"], "sequence": int(row["stop_sequence"]),
            "arrival": seconds(arrival), "departure": seconds(departure),
            "pickup": row.get("pickup_type", "0") in ("", "0"),
            "dropoff": row.get("drop_off_type", "0") in ("", "0"),
        })
    return result


def read_frequencies(archive):
    result = defaultdict(list)
    for row in rows(archive, "frequencies.txt"):
        result[row["trip_id"]].append({
            "start": seconds(row["start_time"]), "end": seconds(row["end_time"]),
            "headway": int(row["headway_secs"]), "exact": row.get("exact_times") == "1",
        })
    return result


def read_transfers(archive, stops):
    result = {}
    def children(identifier):
        if identifier in stops:
            return [identifier]
        return [key for key, stop in stops.items() if stop["parent_station"] == identifier]
    for row in rows(archive, "transfers.txt"):
        origins, destinations = children(row["from_stop_id"]), children(row["to_stop_id"])
        if not origins or not destinations:
            continue
        if any(row.get(key) for key in ("from_route_id", "to_route_id", "from_trip_id", "to_trip_id")):
            raise ValueError("Transfert spécifique à une course ou ligne : import non pris en charge.")
        transfer_type = row.get("transfer_type", "0")
        if transfer_type not in ("0", "1", "2", "3"):
            raise ValueError("Correspondance à bord : import non pris en charge.")
        minimum = row.get("min_transfer_time", "")
        for origin in origins:
            for destination in destinations:
                key = (origin, destination)
                if key in result:
                    raise ValueError("Plusieurs règles de transfert sur les mêmes quais : arbitrage requis.")
                result[key] = {
                    "fromStopId": origin, "toStopId": destination,
                    "minimumSeconds": int(minimum) if minimum else 240,
                    "forbidden": transfer_type == "3", "estimated": not minimum,
                }
    return list(result.values())


def build(archive, digest):
    routes, stops, shapes = read_routes(archive), read_stops(archive), read_shapes(archive)
    services, frequencies = service_dates(archive), read_frequencies(archive)
    trips = [row for row in rows(archive, "trips.txt") if row["route_id"] in routes and services[row["service_id"]]]
    trip_ids = {row["trip_id"] for row in trips}
    times = defaultdict(list)
    for row in rows(archive, "stop_times.txt"):
        if row["trip_id"] in trip_ids:
            times[row["trip_id"]].append(row)
    result = []
    for row in trips:
        shape_id = row.get("shape_id", "")
        if len(shapes.get(shape_id, [])) < 2:
            raise ValueError(f"Course {row['trip_id']} : tracé GTFS absent ; correspondance WFS à établir avant import.")
        passages = trip_passages(times[row["trip_id"]])
        locate_passages(passages, shapes[shape_id], stops)
        for passage in passages:
            line_ids = stops[passage["stopId"]]["routes"]
            if row["route_id"] not in line_ids:
                line_ids.append(row["route_id"])
        routes[row["route_id"]]["shape"] = shapes[shape_id]
        for index, frequency in enumerate(frequencies[row["trip_id"]] or [None]):
            result.append({
                "id": f"{row['trip_id']}:{index}", "routeId": row["route_id"], "serviceId": row["service_id"],
                "shapeId": shape_id, "headsign": row.get("trip_headsign", ""),
                "accessible": row.get("wheelchair_accessible") == "1", "frequency": frequency, "passages": passages,
            })
    if not result:
        raise ValueError("Aucune course métro, tramway ou funiculaire exploitable.")
    used_services = {trip["serviceId"] for trip in result}
    days = [{"serviceId": key, "date": day} for key in sorted(used_services) for day in sorted(services[key])]
    dates = [day["date"] for day in days]
    agencies = rows(archive, "agency.txt")
    zones = {agency["agency_timezone"] for agency in agencies}
    if len(zones) != 1:
        raise ValueError("Un seul fuseau d'agence est attendu pour ce réseau.")
    max_time = max(max(p["departure"] for p in trip["passages"]) +
                   (trip["frequency"]["end"] - trip["passages"][0]["departure"] if trip["frequency"] else 0)
                   for trip in result)
    return {
        "metadata": {"id": digest, "importedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                     "startDate": min(dates), "endDate": max(dates), "timeZone": zones.pop(), "maxTimeSeconds": max_time},
        "network": {"stops": [stop for stop in stops.values() if stop["routes"]], "routes": list(routes.values())},
        "shapes": [{"id": key, "points": shapes[key]} for key in {trip["shapeId"] for trip in result}],
        "services": days, "trips": result, "transfers": read_transfers(archive, stops),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "tmp/gtfs/timetable.json")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    archive_path = args.archive or args.output.parent / "timetable.zip"
    if not args.archive:
        url = os.environ.get("GTFS_SOURCE_URL", "").strip()
        if not url:
            raise ValueError("Configurer GTFS_SOURCE_URL ou fournir --archive ; aucun horaire n'a été modifié.")
        request = urllib.request.Request(url, headers={"User-Agent": "UrbanFlow/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                archive_path.write_bytes(response.read())
        except Exception:
            raise ValueError("Téléchargement GTFS refusé ou indisponible ; vérifier l'accès Grand Lyon.") from None
    digest = hashlib.sha256(archive_path.read_bytes() + b"urbanflow-timetable-v1").hexdigest()
    with zipfile.ZipFile(archive_path) as archive:
        data = build(archive, digest)
    pending = args.output.with_suffix(".pending")
    pending.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    pending.replace(args.output)
    print(f"Horaires normalisés : {len(data['trips'])} courses, {len(data['network']['stops'])} quais, {data['metadata']['startDate']} → {data['metadata']['endDate']}.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, zipfile.BadZipFile) as error:
        print(f"Import GTFS interrompu : {error}", file=sys.stderr)
        raise SystemExit(1)
