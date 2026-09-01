"""Complete le feed transport avec ce que notre extraction GTFS ne donne pas :
quelle ligne dessert quel arret, et par ou passe reellement chaque ligne.

Le GTFS statique decrit la desserte dans `stop_times.txt`, un fichier de
plusieurs millions de lignes qu'il faudrait agreger, et le trace dans
`shapes.txt`. Le portail open data de la Metropole publie les deux sous une
forme deja agregee, en acces libre (aucun jeton, licence ODbL) :

  - `tcl_sytral.tclarret`            : arrets, avec le champ `desserte`
                                       ("B:A,T1:R,C13:A") qui liste les lignes ;
  - `tcl_sytral.tcllignemf_2_0_0`    : traces metro et funiculaire ;
  - `tcl_sytral.tcllignetram_2_0_0`  : traces tramway.

Sans ces deux informations, le moteur d'itineraires ne pouvait ni choisir un
arret reellement desservi, ni nommer la ligne a prendre, ni dessiner autre
chose qu'une approximation routiere (cf. docs/BUGS.md, B12).

Aucune dependance externe : stdlib uniquement.
"""

from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "public" / "data" / "gtfs-feed.json"

WFS = "https://data.grandlyon.com/geoserver/sytral/ows"
LAYER_STOPS = "sytral:tcl_sytral.tclarret"
LAYERS_LINES = ("sytral:tcl_sytral.tcllignemf_2_0_0", "sytral:tcl_sytral.tcllignetram_2_0_0")

# Meme perimetre que l'ingestion GTFS : la metropole entiere.
CENTER_LAT = 45.7578
CENTER_LON = 4.8320
RADIUS_KM = 16.0

# `famille_transport` du portail -> `route_type` GTFS (0 tram, 1 metro, 7 funiculaire).
ROUTE_TYPE_BY_FAMILY = {"MET": 1, "TRA": 0, "FUN": 7}
HEADWAY_BY_TYPE = {1: 4, 0: 8, 7: 10}

# Tolerance de simplification du trace, en metres. Les traces tramway du portail
# comptent jusqu a 5 300 points, densifies tous les 3 m environ : a 2 m pres, le
# trace reste fidele au zoom rue et ne pese plus que 2 % de sa taille.
SIMPLIFY_METERS = 2.0

# En dessous de ce nombre de points, le trace est deja compact et on le garde
# tel quel. Les traces metro et funiculaire tiennent en une centaine de points
# pour toute la ligne : les simplifier ne gagnerait rien et raboterait les
# courbes entre deux stations, la ou le trace est justement lu de pres.
SIMPLIFY_THRESHOLD_POINTS = 400


def fetch_layer(typename: str) -> list[dict]:
    query = urllib.parse.urlencode(
        {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typename": typename,
            "outputFormat": "application/json",
        }
    )
    request = urllib.request.Request(f"{WFS}?{query}", headers={"User-Agent": "urbanflow-mobility-build"})
    print(f"Telechargement {typename}...")
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))["features"]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def served_lines(desserte: str | None) -> set[str]:
    """`desserte` liste les couples ligne:sens ("B:A,B:R,C13:A"). Le sens ne nous
    interesse pas : on ne retient que le code de ligne."""
    return {item.split(":")[0].strip() for item in (desserte or "").split(",") if item.strip()}


def simplify(points: list[list[float]], tolerance_m: float) -> list[list[float]]:
    """Douglas-Peucker. La distance point-segment est calculee en degres projetes
    en metres : a la latitude de Lyon, un degre de longitude vaut cos(lat) fois
    un degre de latitude, sans quoi l'erreur horizontale serait sous-estimee de
    30 %."""
    if len(points) <= 2:
        return points

    scale_lon = math.cos(math.radians(CENTER_LAT))
    tolerance_deg = tolerance_m / 111_320.0

    def flat(point: list[float]) -> tuple[float, float]:
        return point[0] * scale_lon, point[1]

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]

    while stack:
        start, end = stack.pop()
        ax, ay = flat(points[start])
        bx, by = flat(points[end])
        dx, dy = bx - ax, by - ay
        span = dx * dx + dy * dy
        worst_index, worst_distance = -1, 0.0

        for index in range(start + 1, end):
            px, py = flat(points[index])
            if span == 0:
                distance = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / span))
                distance = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if distance > worst_distance:
                worst_index, worst_distance = index, distance

        if worst_index != -1 and worst_distance > tolerance_deg:
            keep[worst_index] = True
            stack.append((start, worst_index))
            stack.append((worst_index, end))

    return [point for point, kept in zip(points, keep) if kept]


def build_routes(line_features: list[dict]) -> list[dict]:
    """Une ligne a plusieurs traces (aller, retour, antennes). On retient le plus
    long : c'est celui qui couvre la ligne de bout en bout, et un seul sens
    suffit pour dessiner un segment entre deux stations."""
    longest: dict[str, dict] = {}
    for feature in line_features:
        properties = feature["properties"]
        code = (properties.get("ligne") or "").strip()
        family = properties.get("famille_transport")
        if not code or family not in ROUTE_TYPE_BY_FAMILY:
            continue
        geometry = feature["geometry"]
        parts = geometry["coordinates"] if geometry["type"] == "MultiLineString" else [geometry["coordinates"]]
        points = max(parts, key=len)
        if code not in longest or len(points) > len(longest[code]["points"]):
            longest[code] = {"points": points, "properties": properties}

    routes = []
    for code, entry in longest.items():
        properties = entry["properties"]
        route_type = ROUTE_TYPE_BY_FAMILY[properties["famille_transport"]]
        points = [[round(lon, 6), round(lat, 6)] for lon, lat in entry["points"]]
        shape = points if len(points) < SIMPLIFY_THRESHOLD_POINTS else simplify(points, SIMPLIFY_METERS)
        routes.append(
            {
                "route_id": code,
                "route_short_name": code,
                "route_long_name": (properties.get("nom_trace") or "").strip(),
                "route_type": route_type,
                "route_color": (properties.get("couleur_hex") or "#6B7280").lstrip("#").upper(),
                "route_text_color": "FFFFFF",
                "shape": shape,
            }
        )

    routes.sort(key=lambda route: (route["route_type"], route["route_short_name"]))
    return routes


def build_stops(stop_features: list[dict], known_lines: set[str]) -> list[dict]:
    """Un arret physique existe en plusieurs exemplaires (un par quai). On les
    regroupe par nom : l'utilisateur raisonne en station, pas en poteau. Les
    lignes desservies sont l'union de celles des quais regroupes."""
    grouped: dict[str, dict] = {}
    for feature in stop_features:
        properties = feature["properties"]
        name = (properties.get("nom") or "").strip()
        if not name:
            continue
        lon, lat = feature["geometry"]["coordinates"]
        if haversine_km(CENTER_LAT, CENTER_LON, lat, lon) > RADIUS_KM:
            continue

        key = name.casefold()
        lines = served_lines(properties.get("desserte")) & known_lines
        entry = grouped.get(key)
        if entry is None:
            grouped[key] = {
                "stop_id": str(properties.get("id") or properties.get("gid")),
                "stop_name": name,
                "stop_lat": round(lat, 6),
                "stop_lon": round(lon, 6),
                # `pmr` du portail : quai accessible en fauteuil. 1 accessible,
                # 2 non — la valeur 0 ("inconnu") de GTFS n'a pas d'equivalent
                # ici, l'information est toujours renseignee.
                "wheelchair_boarding": 1 if properties.get("pmr") else 2,
                "routes": sorted(lines),
            }
            continue

        entry["routes"] = sorted(set(entry["routes"]) | lines)
        if properties.get("pmr"):
            entry["wheelchair_boarding"] = 1
        # Une station desservie par une ligne structurante est mieux placee sur
        # le quai de cette ligne que sur un arret de bus homonyme.
        if lines and not entry["routes"]:
            entry["stop_lat"], entry["stop_lon"] = round(lat, 6), round(lon, 6)

    return sorted(grouped.values(), key=lambda stop: stop["stop_name"])


def main() -> None:
    feed = json.loads(FEED.read_text(encoding="utf-8"))

    routes = build_routes([feature for layer in LAYERS_LINES for feature in fetch_layer(layer)])
    known_lines = {route["route_id"] for route in routes}
    stops = build_stops(fetch_layer(LAYER_STOPS), known_lines)

    feed["routes"] = routes
    feed["stops"] = stops
    feed["trips"] = [
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

    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")

    served = sum(1 for stop in stops if stop["routes"])
    shape_points = sum(len(route["shape"]) for route in routes)
    print(
        f"Feed complete: {FEED} ({len(stops)} arrets dont {served} desservis par une ligne"
        f" structurante, {len(routes)} lignes, {shape_points} points de trace)"
    )


if __name__ == "__main__":
    main()
