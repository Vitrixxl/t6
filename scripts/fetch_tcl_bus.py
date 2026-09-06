"""Ajoute les bus réguliers TCL au feed, avec un tracé et des quais par sens.

Source : WFS SYTRAL, tcllignebus_2_0_0 et tclarret. Les variantes sans sens,
les services spéciaux et les tracés discontinus ne sont pas exploitables ici.
L’ordre des quais est déduit de leur projection sur le tracé publié : ce n’est
pas un horaire GTFS. Aucun temps réel n’est inventé pour ces lignes.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from fetch_tcl_lines import CENTER_LAT, CENTER_LON, FEED, RADIUS_KM, fetch_layer, haversine_km, simplify

BUS_LAYER = "sytral:tcl_sytral.tcllignebus_2_0_0"
STOP_LAYER = "sytral:tcl_sytral.tclarret"


def projection(shape: list[list[float]], point: list[float]) -> tuple[float, float]:
    """Position fractionnaire sur la polyligne et distance au quai en km."""
    import math
    scale = math.cos(math.radians(point[1]))
    best = (0.0, float("inf"))
    for index, (a, b) in enumerate(zip(shape, shape[1:])):
        dx, dy = (b[0] - a[0]) * scale, b[1] - a[1]
        span = dx * dx + dy * dy
        ratio = 0 if span == 0 else max(0, min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / span))
        lon, lat = a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])
        distance = haversine_km(lat, lon, point[1], point[0])
        if distance < best[1]:
            best = (index + ratio, distance)
    return best


def active_regular(properties: dict, today: str) -> bool:
    return (
        properties.get("famille_transport") == "BUS"
        and properties.get("code_type_ligne") == "REG"
        and properties.get("type_trace") in {"NOM", "NOR"}
        and properties.get("sens") in {"Aller", "Retour"}
        and (properties.get("date_debut") or "00000000") <= today
        and (properties.get("date_fin") or "99999999") >= today
    )


def route_stops(feature: dict, stops: list[dict], shape: list[list[float]]) -> list[dict]:
    properties = feature["properties"]
    service = properties["ligne"] + (":A" if properties["sens"] == "Aller" else ":R")
    candidates = []
    for stop in stops:
        if service not in (stop["properties"].get("desserte") or "").split(","):
            continue
        position, distance = projection(shape, stop["geometry"]["coordinates"])
        if distance <= 0.05:
            candidates.append((position, stop))
    candidates.sort(key=lambda item: item[0])
    return [stop for _, stop in candidates]


def stop_name_key(name: str | None) -> str:
    """Les noms SYTRAL varient en espaces et tirets entre quai et terminus."""
    return "".join(character for character in (name or "").casefold() if character.isalnum())


def build_bus_network(line_features: list[dict], stop_features: list[dict], today: str) -> tuple[list[dict], list[dict]]:
    routes, stops = [], {}
    for feature in line_features:
        properties = feature["properties"]
        if not active_regular(properties, today):
            continue
        geometry = feature.get("geometry") or {}
        parts = geometry.get("coordinates", [])
        if geometry.get("type") == "LineString":
            parts = [parts]
        # Relier deux morceaux séparés créerait un segment absent de la source.
        if len(parts) != 1 or len(parts[0]) < 2:
            continue
        shape = simplify(parts[0], 2.0)
        served = route_stops(feature, stop_features, shape)
        if len(served) < 2:
            continue
        # Le sens de la géométrie est contrôlé avec les terminus publiés.
        names = [stop_name_key(stop["properties"]["nom"]) for stop in served]
        origin = stop_name_key(properties.get("nom_origine"))
        destination = stop_name_key(properties.get("nom_destination"))
        if origin == destination or origin not in names or destination not in names:
            continue
        if names.index(origin) > names.index(destination):
            shape.reverse()
            served.reverse()
        served = [stop for stop in served if haversine_km(CENTER_LAT, CENTER_LON, stop["geometry"]["coordinates"][1], stop["geometry"]["coordinates"][0]) <= RADIUS_KM]
        if len(served) < 2:
            continue
        route_id = "bus:" + str(properties["gid"])
        sequence = []
        for stop in served:
            p = stop["properties"]
            stop_id = "bus-stop:" + str(p["id"])
            lon, lat = stop["geometry"]["coordinates"]
            entry = stops.setdefault(stop_id, {
                "stop_id": stop_id, "stop_name": p["nom"], "stop_lat": round(lat, 7), "stop_lon": round(lon, 7),
                "wheelchair_boarding": 0 if p.get("pmr") is None else (1 if p["pmr"] else 2), "routes": [],
            })
            entry["routes"].append(route_id)
            sequence.append(stop_id)
        routes.append({
            "route_id": route_id, "route_short_name": properties["ligne"],
            "route_long_name": properties["nom_trace"], "route_type": 3,
            "route_color": (properties.get("couleur_hex") or "#6B7280").lstrip("#").upper(),
            "route_text_color": "FFFFFF", "shape": shape, "stopSequence": sequence,
            "wheelchairAccessible": properties.get("pmr") is True,
        })
    return routes, list(stops.values())


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Réutiliser lines.json et stops.json téléchargés depuis le WFS")
    args = parser.parse_args()
    if args.source_dir:
        lines = json.loads((args.source_dir / "lines.json").read_text())["features"]
        stops = json.loads((args.source_dir / "stops.json").read_text())["features"]
    else:
        lines, stops = fetch_layer(BUS_LAYER), fetch_layer(STOP_LAYER)
    routes, stops = build_bus_network(lines, stops, date.today().strftime("%Y%m%d"))
    if not routes:
        raise SystemExit("Aucune desserte bus vérifiée : le feed existant est conservé.")
    feed = json.loads(FEED.read_text())
    feed["routes"] = [route for route in feed["routes"] if route["route_type"] != 3] + routes
    feed["stops"] = [stop for stop in feed["stops"] if not stop["stop_id"].startswith("bus-stop:")] + stops
    feed["trips"] = [trip for trip in feed["trips"] if not trip["route_id"].startswith("bus:")] + [{
        "trip_id": route["route_id"] + "-estimate", "route_id": route["route_id"], "service_id": "estimated",
        # Hypothèse de calcul, pas une fréquence observée ni un retard réel.
        "headway_minutes": 15, "realtime_delay_minutes": 0, "occupancy": "medium",
    } for route in routes]
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2))
    print(f"Bus : {len(set(route['route_short_name'] for route in routes))} lignes, {len(routes)} tracés par sens, {len(stops)} quais. Source WFS du {date.today()}.")


if __name__ == "__main__":
    main()
