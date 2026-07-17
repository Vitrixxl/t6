"""Genere le dossier projet PDF UrbanFlow Mobility (T6 CDSD, session septembre 2026).

Structure alignee sur la grille d'evaluation RNCP 36146 :
- BC01 : specification des besoins, etat de l'art, recommandations, specifications
  fonctionnelles et architecture (C1.1, C1.2, C1.3).
- BC02 : approche iterative, outils, roles, tests, amelioration continue (C2.1, C2.2).
- BC03 : realisations techniques, APIs reelles, traitement des bogues (C3.1, C3.2, C3.3).
"""

from pathlib import Path

from PIL import Image as PILImage
from reportlab.graphics.shapes import Circle, Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "dossier-projet-urbanflow.pdf"
SCREENS = ROOT / "output" / "screens"
PAGE_WIDTH, PAGE_HEIGHT = A4
CONTENT_WIDTH = PAGE_WIDTH - 36 * mm

# Identite graphique "eco-urbaine" alignee sur l'application.
PINE = colors.HexColor("#1d6b4f")
PINE_DARK = colors.HexColor("#14503a")
LIME = colors.HexColor("#a8c528")
BLUE = colors.HexColor("#2f6cb3")
AMBER = colors.HexColor("#b45309")
INK = colors.HexColor("#182420")
MUTED = colors.HexColor("#5a6a62")
CREAM = colors.HexColor("#f5f3ea")
LIGHT = colors.HexColor("#e9f0e6")
LINE = colors.HexColor("#cdd6cd")


def register_fonts() -> tuple[str, str]:
    candidates = [
        Path("/usr/share/fonts/TTF/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    bold_candidates = [
        Path("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    regular = next((path for path in candidates if path.exists()), None)
    if regular:
        bold = next((path for path in bold_candidates if path.exists()), regular)
        pdfmetrics.registerFont(TTFont("DejaVu", regular))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", bold))
        return "DejaVu", "DejaVu-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT_REGULAR, FONT_BOLD = register_fonts()


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "TitleXL", parent=base["Title"], fontName=FONT_BOLD, fontSize=27, leading=33,
            textColor=PINE_DARK, alignment=TA_CENTER, spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle", parent=base["BodyText"], fontName=FONT_REGULAR, fontSize=11.5,
            leading=16, alignment=TA_CENTER, textColor=MUTED, spaceAfter=14,
        ),
        "h1": ParagraphStyle(
            "Heading1", parent=base["Heading1"], fontName=FONT_BOLD, fontSize=16.5,
            leading=21, textColor=PINE_DARK, spaceBefore=4, spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "Heading2", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=12.5,
            leading=16, textColor=PINE, spaceBefore=10, spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "Heading3", parent=base["Heading3"], fontName=FONT_BOLD, fontSize=10.5,
            leading=14, textColor=INK, spaceBefore=8, spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName=FONT_REGULAR, fontSize=9.4,
            leading=13.6, textColor=INK, alignment=TA_LEFT, spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=base["BodyText"], fontName=FONT_REGULAR, fontSize=9.2,
            leading=13, leftIndent=11, firstLineIndent=-7, textColor=INK, spaceAfter=3,
        ),
        "caption": ParagraphStyle(
            "Caption", parent=base["BodyText"], fontName=FONT_REGULAR, fontSize=8.2,
            leading=11, textColor=MUTED, spaceBefore=3, spaceAfter=10, alignment=TA_CENTER,
        ),
        "tableCell": ParagraphStyle(
            "TableCell", parent=base["BodyText"], fontName=FONT_REGULAR, fontSize=7.8,
            leading=9.9, textColor=INK,
        ),
        "tableHeader": ParagraphStyle(
            "TableHeader", parent=base["BodyText"], fontName=FONT_BOLD, fontSize=7.9,
            leading=9.9, textColor=colors.white,
        ),
        "toc": ParagraphStyle(
            "Toc", parent=base["BodyText"], fontName=FONT_REGULAR, fontSize=10.5,
            leading=19, textColor=INK,
        ),
        "kicker": ParagraphStyle(
            "Kicker", parent=base["BodyText"], fontName=FONT_BOLD, fontSize=8.6,
            leading=11, textColor=PINE, spaceAfter=2,
        ),
    }


S = styles()


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(text, S["bullet"], bulletText="–")


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(PINE_DARK)
        canvas.rect(0, PAGE_HEIGHT - 9 * mm, PAGE_WIDTH, 9 * mm, stroke=0, fill=1)
        canvas.setFillColor(LIME)
        canvas.rect(0, PAGE_HEIGHT - 10 * mm, PAGE_WIDTH, 1 * mm, stroke=0, fill=1)
        canvas.setFont(FONT_BOLD, 8.4)
        canvas.setFillColor(colors.white)
        canvas.drawString(18 * mm, PAGE_HEIGHT - 6.6 * mm, "UrbanFlow Mobility")
        canvas.setFont(FONT_REGULAR, 8)
        canvas.drawRightString(PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 6.6 * mm, "Dossier projet  |  T6 CDSD  |  Session sept. 2026")
        canvas.setFillColor(MUTED)
        canvas.setFont(FONT_REGULAR, 8)
        canvas.drawRightString(PAGE_WIDTH - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def table(data, widths=None, header=True, zebra=True) -> Table:
    wrapped = []
    for row_index, row in enumerate(data):
        wrapped.append(
            [Paragraph(str(cell), S["tableHeader" if header and row_index == 0 else "tableCell"]) for cell in row]
        )
    flowable = Table(wrapped, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), PINE))
    if zebra:
        start = 1 if header else 0
        for row_index in range(start, len(data)):
            if (row_index - start) % 2 == 1:
                style.append(("BACKGROUND", (0, row_index), (-1, row_index), CREAM))
    flowable.setStyle(TableStyle(style))
    return flowable


def screenshot(filename: str, width_mm: float, caption: str) -> KeepTogether:
    path = SCREENS / filename
    with PILImage.open(path) as img:
        ratio = img.height / img.width
    width = width_mm * mm
    image = Image(str(path), width=width, height=width * ratio)
    image.hAlign = "CENTER"
    return KeepTogether([image, p(caption, "caption")])


def screenshot_pair(file_a: str, file_b: str, width_mm: float, caption: str) -> KeepTogether:
    cells = []
    for filename in (file_a, file_b):
        path = SCREENS / filename
        with PILImage.open(path) as img:
            ratio = img.height / img.width
        width = width_mm * mm
        cells.append(Image(str(path), width=width, height=width * ratio))
    grid = Table([[cells[0], cells[1]]], colWidths=[width_mm * mm + 6, width_mm * mm + 6], hAlign="CENTER")
    grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    return KeepTogether([grid, p(caption, "caption")])


def rect_label(d: Drawing, x, y, w, h, text, fill=colors.white, stroke=PINE, size=8, text_color=None) -> None:
    d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=1, rx=3, ry=3))
    d.add(String(x + w / 2, y + h / 2 - 3, text, fontName=FONT_BOLD, fontSize=size,
                 fillColor=text_color or INK, textAnchor="middle"))


def arrow(d: Drawing, x1, y1, x2, y2, color=INK, dashed=False) -> None:
    line = Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.1)
    if dashed:
        line.strokeDashArray = [3, 2]
    d.add(line)
    import math

    angle = math.atan2(y2 - y1, x2 - x1)
    size = 6
    d.add(
        Polygon(
            [
                x2, y2,
                x2 - size * math.cos(angle - 0.42), y2 - size * math.sin(angle - 0.42),
                x2 - size * math.cos(angle + 0.42), y2 - size * math.sin(angle + 0.42),
            ],
            fillColor=color, strokeColor=color,
        )
    )


def use_case_diagram() -> Drawing:
    d = Drawing(500, 268)
    d.add(Rect(118, 14, 268, 240, fillColor=colors.HexColor("#fbfaf5"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(252, 240, "Systeme UrbanFlow Mobility", fontName=FONT_BOLD, fontSize=9.5, fillColor=PINE_DARK, textAnchor="middle"))

    actors = [("Citoyen", 48, 168), ("Operateur mobilite", 452, 190), ("Metropole (admin)", 452, 66)]
    for label, x, y in actors:
        d.add(Circle(x, y + 28, 9, fillColor=colors.white, strokeColor=INK))
        d.add(Line(x, y + 19, x, y - 8, strokeColor=INK))
        d.add(Line(x - 12, y + 8, x + 12, y + 8, strokeColor=INK))
        d.add(Line(x, y - 8, x - 9, y - 24, strokeColor=INK))
        d.add(Line(x, y - 8, x + 9, y - 24, strokeColor=INK))
        d.add(String(x, y - 38, label, fontName=FONT_BOLD, fontSize=7.6, textAnchor="middle", fillColor=INK))

    cases = [
        ("S'inscrire / se connecter", 138, 206),
        ("Gerer profil de mobilite", 138, 172),
        ("Planifier trajet multimodal", 138, 138),
        ("Suivre navigation GPS", 138, 104),
        ("Suivre empreinte carbone", 138, 70),
        ("Sauvegarder ses trajets", 138, 36),
        ("Publier flux GTFS / GBFS", 262, 188),
        ("Signaler incidents reseau", 262, 120),
        ("Consulter indicateurs usage", 262, 52),
    ]
    for label, x, y in cases:
        rect_label(d, x, y, 112, 24, label, fill=LIGHT, stroke=PINE, size=6.6)

    for y in (218, 184, 150, 116, 82, 48):
        d.add(Line(60, 168, 138, y, strokeColor=MUTED))
    d.add(Line(452, 190, 374, 200, strokeColor=MUTED))
    d.add(Line(452, 190, 374, 132, strokeColor=MUTED))
    d.add(Line(452, 66, 374, 64, strokeColor=MUTED))
    d.add(Line(452, 66, 374, 128, strokeColor=MUTED))
    return d


def sequence_diagram() -> Drawing:
    d = Drawing(500, 300)
    lifelines = [
        ("Citoyen", 42),
        ("PWA UrbanFlow", 145),
        ("RoutePlanner", 250),
        ("APIs externes", 355),
        ("CarbonTracker", 455),
    ]
    for label, x in lifelines:
        rect_label(d, x - 42, 262, 84, 24, label, fill=LIGHT, stroke=BLUE, size=6.8)
        d.add(Line(x, 30, x, 262, strokeColor=LINE))

    steps = [
        (42, 145, 240, "1. saisit depart / arrivee", False),
        (145, 250, 218, "2. planRoutes(profil, position)", False),
        (250, 355, 196, "3. GET geocodage + OSRM + GBFS", False),
        (355, 250, 174, "4. geometries, stations, delais", True),
        (250, 145, 152, "5. options scorees (duree, CO2, PMR)", True),
        (145, 42, 130, "6. cartes de trajets + carte", True),
        (42, 145, 108, "7. enregistre le trajet", False),
        (145, 455, 86, "8. createTripRecord(CO2 evite)", False),
        (455, 145, 64, "9. synthese hebdomadaire", True),
        (145, 42, 42, "10. progression objectif carbone", True),
    ]
    for x1, x2, y, label, dashed in steps:
        arrow(d, x1, y, x2, y, BLUE, dashed=dashed)
        d.add(String((x1 + x2) / 2, y + 5, label, fontName=FONT_REGULAR, fontSize=6.6, fillColor=INK, textAnchor="middle"))
    return d


def communication_diagram() -> Drawing:
    d = Drawing(500, 252)
    nodes = {
        "PWA (App.tsx)": (30, 148, 108, 32),
        "AuthService": (200, 200, 100, 30),
        "RoutePlanner": (200, 118, 100, 30),
        "TransportApi": (368, 168, 108, 30),
        "ExternalApis": (368, 96, 108, 30),
        "CarbonTracker": (200, 36, 100, 30),
        "LocalStorage": (30, 44, 108, 30),
    }
    for label, (x, y, w, h) in nodes.items():
        rect_label(d, x, y, w, h, label, fill=colors.white, stroke=PINE, size=7.2)

    links = [
        ((138, 172), (200, 210), "1: login()"),
        ((250, 200), (110, 76), "1.1: session"),
        ((138, 158), (200, 130), "2: planRoutes()"),
        ((300, 148), (368, 176), "2.1: reseau GTFS/GBFS"),
        ((300, 122), (368, 106), "2.2: OSRM + geocodage"),
        ((138, 148), (232, 66), "3: saveTrip()"),
        ((214, 36), (110, 48), "3.1: persist"),
    ]
    for start, end, label in links:
        x1, y1 = start
        x2, y2 = end
        arrow(d, x1, y1, x2, y2, MUTED)
        d.add(String((x1 + x2) / 2, (y1 + y2) / 2 + 7, label, fontName=FONT_BOLD, fontSize=6.6, fillColor=PINE_DARK, textAnchor="middle"))
    return d


def architecture_diagram() -> Drawing:
    d = Drawing(500, 265)
    d.add(Rect(10, 150, 225, 105, fillColor=colors.HexColor("#fbfaf5"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(122, 242, "Client PWA (livre)", fontName=FONT_BOLD, fontSize=8.6, fillColor=PINE_DARK, textAnchor="middle"))
    rect_label(d, 22, 208, 95, 24, "UI React 19", fill=LIGHT, size=7)
    rect_label(d, 128, 208, 95, 24, "Service worker", fill=LIGHT, size=7)
    rect_label(d, 22, 178, 95, 24, "RoutePlanner", fill=LIGHT, size=7)
    rect_label(d, 128, 178, 95, 24, "Auth PBKDF2", fill=LIGHT, size=7)
    rect_label(d, 22, 156, 201, 18, "LocalStorage (profils, trajets, CO2)", fill=colors.white, size=6.6)

    d.add(Rect(265, 150, 225, 105, fillColor=colors.HexColor("#f4f8fb"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(377, 242, "APIs open data (reelles)", fontName=FONT_BOLD, fontSize=8.6, fillColor=BLUE, textAnchor="middle"))
    rect_label(d, 277, 208, 95, 24, "api-adresse BAN", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 383, 208, 95, 24, "OSRM (OSM.de)", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 277, 178, 95, 24, "GBFS Velo'v v3", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 383, 178, 95, 24, "GBFS Dott v2.3", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 277, 156, 95, 18, "GTFS TCL (ODbL)", fill=colors.white, stroke=BLUE, size=6.4)
    rect_label(d, 383, 156, 95, 18, "Open-Meteo", fill=colors.white, stroke=BLUE, size=6.4)

    arrow(d, 235, 200, 265, 200, BLUE)
    d.add(String(250, 205, "HTTPS", fontName=FONT_REGULAR, fontSize=6, fillColor=MUTED, textAnchor="middle"))

    d.add(Rect(10, 14, 480, 112, fillColor=colors.HexColor("#f7f6ef"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(250, 112, "Architecture cible metropolitaine (evolution)", fontName=FONT_BOLD, fontSize=8.6, fillColor=AMBER, textAnchor="middle"))
    rect_label(d, 22, 72, 100, 26, "API Gateway", fill=colors.white, stroke=AMBER, size=6.8)
    rect_label(d, 134, 72, 100, 26, "Auth OIDC/JWT", fill=colors.white, stroke=AMBER, size=6.8)
    rect_label(d, 246, 72, 110, 26, "Service itineraires", fill=colors.white, stroke=AMBER, size=6.8)
    rect_label(d, 368, 72, 110, 26, "Workers ingestion", fill=colors.white, stroke=AMBER, size=6.8)
    rect_label(d, 78, 30, 110, 26, "PostgreSQL/PostGIS", fill=colors.white, stroke=AMBER, size=6.8)
    rect_label(d, 202, 30, 100, 26, "Cache Redis", fill=colors.white, stroke=AMBER, size=6.8)
    rect_label(d, 316, 30, 130, 26, "GTFS-RT / SIRI operateurs", fill=colors.white, stroke=AMBER, size=6.6)
    arrow(d, 122, 128, 122, 100, MUTED, dashed=True)
    arrow(d, 377, 128, 377, 100, MUTED, dashed=True)
    return d


def sprint_timeline() -> Drawing:
    d = Drawing(500, 110)
    sprints = [
        ("S1 - Cadrage", "Besoins, maquettes,\nsocle Vite/TS/PWA", LIGHT),
        ("S2 - F1", "Auth PBKDF2,\nprofils mobilite", LIGHT),
        ("S3 - F2", "Carte, GPS,\nplanificateur", LIGHT),
        ("S4 - F3 + APIs", "GTFS TCL, GBFS live,\nOSRM, meteo", LIGHT),
        ("S5 - Option", "Suivi carbone,\ngamification legere", LIGHT),
        ("S6 - Durcissement", "Tests, WCAG, RGPD,\ndossier + recette", CREAM),
    ]
    x = 6
    for title, detail, fill in sprints:
        d.add(Rect(x, 34, 76, 56, fillColor=fill, strokeColor=PINE, strokeWidth=1, rx=4, ry=4))
        d.add(String(x + 38, 74, title, fontName=FONT_BOLD, fontSize=6.8, fillColor=PINE_DARK, textAnchor="middle"))
        for line_index, line in enumerate(detail.split("\n")):
            d.add(String(x + 38, 60 - line_index * 9, line, fontName=FONT_REGULAR, fontSize=5.9, fillColor=INK, textAnchor="middle"))
        if x > 6:
            arrow(d, x - 7, 62, x + 1, 62, PINE)
        x += 83
    d.add(String(250, 14, "6 sprints d'une semaine - revue, retro et demo client a chaque fin de sprint", fontName=FONT_REGULAR, fontSize=7.2, fillColor=MUTED, textAnchor="middle"))
    return d


def bug_workflow_diagram() -> Drawing:
    d = Drawing(500, 74)
    steps = ["Detection\n(test, revue, user)", "Ticket qualifie\n(repro + criticite)", "Triage quotidien\n(bloqueur > majeur)", "Correctif +\ntest non-regression", "Revue de code\n+ CI verte", "Recette preprod\npuis deploiement"]
    x = 4
    for index, step in enumerate(steps):
        fill = LIGHT if index % 2 == 0 else colors.white
        d.add(Rect(x, 18, 74, 44, fillColor=fill, strokeColor=PINE, strokeWidth=1, rx=4, ry=4))
        for line_index, line in enumerate(step.split("\n")):
            d.add(String(x + 37, 44 - line_index * 10, line, fontName=FONT_REGULAR, fontSize=6.1, fillColor=INK, textAnchor="middle"))
        if index < len(steps) - 1:
            arrow(d, x + 76, 40, x + 84, 40, PINE)
        x += 83
    return d


def cover_page() -> list:
    band = Drawing(CONTENT_WIDTH, 8)
    band.add(Rect(0, 0, CONTENT_WIDTH, 8, fillColor=LIME, strokeColor=None))
    logo = Drawing(CONTENT_WIDTH, 74)
    logo.add(Circle(CONTENT_WIDTH / 2, 37, 30, fillColor=PINE, strokeColor=None))
    logo.add(Polygon([CONTENT_WIDTH / 2 - 10, 26, CONTENT_WIDTH / 2 + 12, 37, CONTENT_WIDTH / 2 - 10, 48, CONTENT_WIDTH / 2 - 4, 37],
                     fillColor=LIME, strokeColor=None))
    return [
        Spacer(1, 40),
        band,
        Spacer(1, 42),
        logo,
        Spacer(1, 16),
        p("UrbanFlow Mobility", "title"),
        p("Plateforme PWA de mobilite urbaine intelligente et durable", "subtitle"),
        Spacer(1, 4),
        p("<b>Dossier projet</b> - Titre 6 Concepteur Developpeur de Solutions Digitales (RNCP 36146)", "subtitle"),
        p("Session septembre 2026 - B3DEV - Digital Campus", "subtitle"),
        Spacer(1, 26),
        table(
            [
                ["Livrable", "Description"],
                ["Application PWA", "React 19 + TypeScript, mobile first, installable, geolocalisation temps reel, carte MapLibre GL."],
                ["APIs reelles", "GTFS TCL (ODbL), GBFS Velo'v v3, GBFS Dott, OSRM, api-adresse (BAN), Open-Meteo."],
                ["Fonctionnalites", "F1 comptes + profils, F2 planificateur multimodal + GPS, F3 integration transport, option suivi carbone."],
                ["Qualite", "TypeScript strict, ESLint, 9 tests unitaires Vitest, build de production verifie, WCAG 2.1 AA, RGPD."],
            ],
            widths=[95, CONTENT_WIDTH - 95],
        ),
        PageBreak(),
    ]


def toc_page() -> list:
    entries = [
        ("1.", "Contexte, objectifs client et besoins"),
        ("2.", "Perimetre fonctionnel et exigences"),
        ("3.", "Etat de l'art et solutions techniques comparees"),
        ("4.", "Recommandation et arbitrages"),
        ("5.", "Pilotage : methode, roles, outils, amelioration continue"),
        ("6.", "Modelisation UML (cas d'utilisation, sequence, communication)"),
        ("7.", "Specifications de la fonctionnalite cle"),
        ("8.", "Architecture technique, evolutivite et maintenabilite"),
        ("9.", "Securite (OWASP) et protection des donnees (RGPD)"),
        ("10.", "Qualite logicielle, tests et traitement des bogues"),
        ("11.", "Realisation : parcours applicatifs commentes"),
        ("12.", "Couverture des contraintes C1 a C12"),
        ("13.", "Verification finale, bilan et perspectives"),
    ]
    rows = [[num, title] for num, title in entries]
    toc = Table(rows, colWidths=[26, CONTENT_WIDTH - 26], hAlign="LEFT")
    toc.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTSIZE", (0, 0), (-1, -1), 10.6),
                ("TEXTCOLOR", (0, 0), (0, -1), PINE),
                ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
                ("TEXTCOLOR", (1, 0), (1, -1), INK),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, LINE),
            ]
        )
    )
    return [p("Sommaire", "h1"), Spacer(1, 6), toc, PageBreak()]


def section_1() -> list:
    return [
        p("1. Contexte, objectifs client et besoins", "h1"),
        p(
            "Une metropole d'environ 500 000 habitants, engagee dans la transition ecologique, souhaite une plateforme "
            "unifiee de mobilite urbaine. Le constat exprime par la commanditaire (Claire Henette, UrbanFlow Mobility) "
            "tient en trois problemes structurels : la <b>congestion</b> des axes routiers aux heures de pointe, la "
            "<b>pollution</b> generee par l'autosolisme, et la <b>fragmentation</b> des services de transport : chaque "
            "operateur (transport public, velos en libre-service, trottinettes, covoiturage) impose aujourd'hui sa propre "
            "application, ses comptes et sa billettique.",
        ),
        p(
            "UrbanFlow Mobility repond a ce besoin par une application web progressive (PWA) qui reunit la planification "
            "multimodale, la disponibilite temps reel des services partages et la mesure de l'impact carbone de chaque "
            "deplacement, avec une exigence forte : etre <b>mobile first</b>, car l'usage se fait en marchant, en attendant "
            "un metro ou au guidon d'un velo.",
        ),
        p("1.1 Enjeux metiers et objectifs economiques", "h2"),
        table(
            [
                ["Enjeu", "Objectif mesurable", "Retombee attendue"],
                ["Report modal vers les mobilites douces",
                 "+15 % de trajets velo/marche planifies via la plateforme a 12 mois",
                 "Baisse de la congestion, des emissions et du cout d'entretien routier."],
                ["Meilleure utilisation de l'infrastructure existante",
                 "Taux d'occupation lisse des lignes fortes (occupation affichee par trajet)",
                 "Report des investissements capacitaires, ROI direct pour la collectivite."],
                ["Baisse mesurable de l'empreinte carbone",
                 "CO2 evite affiche par trajet et cumule par citoyen (objectif hebdomadaire)",
                 "Contribution chiffree aux objectifs climat du mandat."],
                ["Inclusion et accessibilite",
                 "100 % des itineraires qualifies PMR compatible ou non",
                 "Conformite legale (WCAG 2.1 AA, normes transport) et service universel."],
                ["Souverainete et maitrise des couts",
                 "Open data et standards ouverts (GTFS, GBFS) plutot que licences proprietaires",
                 "Pas de dependance editeur, cout marginal d'integration d'un nouvel operateur faible."],
            ],
            widths=[125, 165, CONTENT_WIDTH - 290],
        ),
        p("1.2 Besoins utilisateurs par persona", "h2"),
        table(
            [
                ["Persona", "Situation type", "Besoin prioritaire", "Reponse UrbanFlow"],
                ["Camille, 34 ans, salariee",
                 "Domicile-travail quotidien, 6 km",
                 "Un trajet fiable en moins de 2 minutes de decision",
                 "Options scorees (duree, CO2, fiabilite), preferences memorisees, alternatives en 1 tap."],
                ["Nadia, 61 ans, PMR",
                 "Rendez-vous medicaux en centre-ville",
                 "Ne jamais etre bloquee par une rupture d'accessibilite",
                 "Profil PMR : seuls les arrets wheelchair_boarding=1 sont retenus, badge PMR compatible."],
                ["Theo, 22 ans, etudiant",
                 "Trajets ponctuels, budget serre",
                 "Trouver un velo ou une trottinette disponible tout de suite",
                 "Disponibilites GBFS temps reel Velo'v et Dott affichees sur la carte."],
                ["La metropole",
                 "Pilotage de la politique mobilite",
                 "Des indicateurs d'usage et un systeme interoperable",
                 "Standards GTFS/GBFS, architecture ouverte, suivi CO2 agregeable."],
            ],
            widths=[90, 105, 120, CONTENT_WIDTH - 315],
        ),
        p("1.3 Ce que le document engage", "h2"),
        p(
            "Ce dossier depasse la reponse aux besoins immediats : chaque choix (architecture en adaptateurs, standards "
            "ouverts, modele de donnees type GTFS/GBFS, PWA installable) est motive par les <b>evolutions probables</b> du "
            "service : ouverture a de nouveaux operateurs, passage a une API metropolitaine, montee en charge et "
            "reglementations futures. Les sections 4 et 8 explicitent ces trajectoires pour ne pas figer la solution dans "
            "ses choix initiaux.",
        ),
        PageBreak(),
    ]


def section_2() -> list:
    return [
        p("2. Perimetre fonctionnel et exigences", "h1"),
        p("2.1 Fonctionnalites obligatoires et option retenue", "h2"),
        table(
            [
                ["ID", "Exigence du sujet", "Implementation livree"],
                ["F1", "Inscription / connexion et profils de mobilite personnalises",
                 "Comptes locaux avec mot de passe derive PBKDF2-SHA-256 (120 000 iterations, sel aleatoire, Web Crypto), "
                 "profil : modes preferes, marche max, priorite PMR, sensibilite pluie, objectif CO2 hebdomadaire."],
                ["F2", "Planificateur d'itineraires multimodal avec geolocalisation temps reel",
                 "Moteur planRoutes : options marche / velo partage / trottinette / metro-tram / combinaisons, suivi GPS "
                 "watchPosition haute precision, navigation pas-a-pas avec progression et instructions."],
                ["F3", "Integration d'APIs de transport (GTFS, velos/trottinettes partages)",
                 "GTFS statique reel TCL-SYTRAL (ODbL) integre au build ; GBFS v3 Velo'v et GBFS v2.3 Dott interroges en "
                 "direct dans le navigateur ; fallback local documente en cas de coupure reseau."],
                ["Option", "Calculateur d'empreinte carbone avec suivi personnel",
                 "CO2 par trajet (facteurs g/km par mode), CO2 evite vs voiture individuelle, historique local, "
                 "objectif hebdomadaire avec jauge de progression, suppression en un clic (RGPD)."],
            ],
            widths=[34, 150, CONTENT_WIDTH - 184],
        ),
        p("2.2 Exigences non fonctionnelles (contraintes C1 a C12)", "h2"),
        p(
            "Les douze contraintes du sujet sont traitees comme des exigences de premier rang, integrees au backlog au "
            "meme titre que les fonctionnalites. La matrice de couverture complete, preuve par preuve, figure en "
            "section 12. Trois d'entre elles ont structure la conception :",
        ),
        bullet("<b>C1 PWA / C10 performances</b> : application installable, service worker cache-first sur le shell et les flux, page hors-ligne dediee ; concevoir pour une connectivite variable a impose le fallback local des flux transport."),
        bullet("<b>C2 responsive / UX mobile first</b> : la cible principale est un ecran de smartphone tenu d'une main : carte plein ecran, feuille de trajets glissable (bottom sheet), actions principales accessibles au pouce ; le bureau devient un shell trois colonnes."),
        bullet("<b>C7 accessibilite / C12 normes transport</b> : navigation clavier complete, libelles ARIA, contrastes AA, et qualification PMR de chaque itineraire a partir du champ GTFS wheelchair_boarding."),
        p("2.3 Hors perimetre assume de cette version", "h2"),
        bullet("Reservation et paiement unifies : necessite des accords billettiques operateurs ; l'architecture cible (section 8) reserve l'emplacement d'un service dedie."),
        bullet("Covoiturage dynamique : demande une masse critique d'utilisateurs simultanes ; le mode est present dans le moteur de scoring pour une activation future."),
        bullet("Incidents temps reel operateur : le flux SIRI Lite du reseau TCL est publie sous cle d'API ; les incidents sont simules et clairement etiquetes comme tels dans l'interface."),
        PageBreak(),
    ]


def section_3() -> list:
    return [
        p("3. Etat de l'art et solutions techniques comparees", "h1"),
        p("3.1 Panorama des solutions existantes", "h2"),
        table(
            [
                ["Solution", "Forces", "Limites pour la metropole"],
                ["Citymapper / Google Maps",
                 "Experience de reference, couverture mondiale, temps reel riche.",
                 "Boite noire proprietaire : pas de maitrise des donnees, pas de politique publique (priorite aux modes doux), cout de licence ou dependance publicitaire."],
                ["Moovit (solution blanche)",
                 "Deploiement rapide, MaaS packagee.",
                 "Licence annuelle elevee, personnalisation limitee, donnees usagers hors du controle de la collectivite."],
                ["Open Trip Planner (OTP)",
                 "Open source, moteur multimodal GTFS mature.",
                 "Infrastructure serveur Java a operer des le jour 1 ; surdimensionne pour prouver les parcours en phase MVP."],
                ["Developpement sur mesure PWA + open data",
                 "Maitrise totale, standards ouverts, cout marginal faible, eco-conception possible.",
                 "Effort de developpement initial ; necessite une trajectoire claire vers une API pour passer a l'echelle."],
            ],
            widths=[105, 145, CONTENT_WIDTH - 250],
        ),
        p("3.2 Scenarios d'architecture etudies", "h2"),
        table(
            [
                ["Scenario", "Cout initial", "Delais MVP", "Performance", "Perennite / evolutivite"],
                ["A. Application native iOS + Android",
                 "Eleve (2 bases de code, comptes stores)",
                 "3 a 4 mois",
                 "Excellente sur l'appareil",
                 "Couteuse : chaque evolution est doublee, publication lente."],
                ["B. PWA autonome (client seul)",
                 "Faible",
                 "6 semaines",
                 "Tres bonne (bundle optimise, cache)",
                 "Limitee sans backend : persistance locale, pas de temps reel operateur sous cle."],
                ["C. PWA + API modulaire (cible)",
                 "Moyen",
                 "MVP 6 semaines puis increments",
                 "Bonne a excellente (cache Redis, PostGIS)",
                 "Forte : services remplacables, ouverture operateurs, montee en charge maitrisee."],
                ["D. Microservices evenementiels",
                 "Tres eleve",
                 "6 mois et plus",
                 "Excellente a tres grande echelle",
                 "Pertinent uniquement au-dela de plusieurs centaines de milliers d'utilisateurs actifs."],
            ],
            widths=[118, 82, 70, 92, CONTENT_WIDTH - 362],
        ),
        p("3.3 Briques logicielles evaluees", "h2"),
        table(
            [
                ["Domaine", "Options etudiees", "Choix", "Justification objective"],
                ["Framework UI", "React 19, Vue 3, Svelte 5", "React 19",
                 "Ecosysteme le plus large (MapLibre, Radix, shadcn/ui), competences disponibles sur le marche, garantie de maintenance long terme."],
                ["Langage", "TypeScript, JavaScript", "TypeScript strict",
                 "Contrats de donnees transport types (GTFS/GBFS), erreurs detectees a la compilation, refactorings surs."],
                ["Cartographie", "MapLibre GL, Leaflet, Google Maps SDK", "MapLibre GL",
                 "Open source (fork Mapbox), rendu GPU 60 fps sur mobile, aucune cle ni cout de licence, styles personnalisables."],
                ["Build / outillage", "Vite 7, Webpack, Parcel", "Vite 7 + ESLint + Vitest",
                 "Demarrage instantane, bundle optimise, tests unitaires rapides integres au meme outillage."],
                ["Donnees transport", "Scraping, licences privees, open data GTFS/GBFS", "Open data + standards",
                 "GTFS et GBFS sont les standards mondiaux de facto : interoperabilite immediate avec tout operateur conforme (C9)."],
            ],
            widths=[70, 118, 78, CONTENT_WIDTH - 266],
        ),
        PageBreak(),
    ]


def section_4() -> list:
    return [
        p("4. Recommandation et arbitrages", "h1"),
        p("4.1 Recommandation", "h2"),
        p(
            "<b>Lancer le scenario B (PWA autonome) comme MVP en s'interdisant tout choix qui bloquerait le scenario C "
            "(PWA + API modulaire), qui constitue la cible.</b> La PWA livree prouve les parcours critiques avec de vraies "
            "donnees open data ; la couche d'acces aux donnees est isolee dans des adaptateurs (transportApi, externalApis) "
            "dont la signature ne changera pas quand les appels passeront par l'API metropolitaine.",
        ),
        p("4.2 Consequences explicites de chaque arbitrage", "h2"),
        table(
            [
                ["Arbitrage", "Cout", "Delais", "Performance", "Perennite"],
                ["PWA plutot que natif",
                 "1 seule base de code : budget initial reduit d'environ 40 %",
                 "MVP en 6 sprints au lieu de 12 a 16",
                 "Rendu carte GPU equivalent ; notifications push limitees sur iOS (acceptable pour le MVP)",
                 "Le web est le socle le plus durable ; un wrapper natif (Capacitor) reste possible sans reecriture."],
                ["Open data + standards plutot que licences",
                 "0 EUR de licence ; integration d'un nouvel operateur = 1 adaptateur",
                 "Aucune negociation commerciale bloquante au demarrage",
                 "Dependance aux SLA des services publics : mitigee par cache + fallback local",
                 "ODbL et GBFS garantissent la reutilisation ; pas de verrouillage editeur."],
                ["Calcul d'itineraire client (MVP) puis service dedie (cible)",
                 "Pas de serveur a operer au lancement",
                 "Fonctionnel des le sprint 3",
                 "Suffisant jusqu'a quelques milliers d'utilisateurs ; OSRM public mutualise",
                 "Le contrat RouteOption est stable : le moteur pourra migrer cote serveur sans toucher l'UI."],
                ["Persistance locale (MVP) puis PostgreSQL/PostGIS (cible)",
                 "0 EUR d'hebergement de donnees personnelles",
                 "RGPD simplifie au lancement (donnees chez l'usager)",
                 "Lecture instantanee, fonctionne hors ligne",
                 "Migration par export/import versionne prevue dans le modele de donnees."],
            ],
            widths=[108, 92, 88, 100, CONTENT_WIDTH - 388],
        ),
        p("4.3 Risques residuels et mitigations", "h2"),
        table(
            [
                ["Risque", "Probabilite", "Impact", "Mitigation en place"],
                ["Indisponibilite d'une API publique (OSRM, GBFS)", "Moyenne", "Moyen",
                 "Timeout 8 s, degradation gracieuse : trace directe + fallback local, statut visible dans l'UI."],
                ["Changement de schema d'un flux operateur", "Faible", "Moyen",
                 "Adaptateurs types + tests unitaires sur la fusion GBFS ; le build echoue si le contrat casse."],
                ["Montee en charge au-dela du client seul", "Certaine a terme", "Fort",
                 "Trajectoire scenario C documentee (section 8) ; aucun couplage UI/donnees bloquant."],
                ["Flux temps reel operateur sous cle (SIRI/GTFS-RT)", "Actee", "Faible au MVP",
                 "Incidents simules etiquetes ; convention a signer avec SYTRAL en phase de deploiement reel."],
            ],
            widths=[150, 62, 48, CONTENT_WIDTH - 260],
        ),
        PageBreak(),
    ]


def section_5() -> list:
    return [
        p("5. Pilotage : methode, roles, outils, amelioration continue", "h1"),
        p("5.1 Approche iterative retenue : Scrum adapte", "h2"),
        p(
            "Le projet est conduit en <b>Scrum</b> avec des sprints d'une semaine, adaptes a un contexte individuel de "
            "certification : les ceremonies sont conservees mais resserrees. Chaque sprint commence par un sprint planning "
            "(objectif + selection du backlog), se termine par une revue sur demonstration fonctionnelle et une "
            "retrospective qui alimente le backlog d'amelioration. Le tableau kanban (A faire / En cours / En revue / "
            "Termine) rend l'avancement visible en continu.",
        ),
        sprint_timeline(),
        p("Figure 1 - Deroulement des 6 sprints du MVP, avec revue et retrospective a chaque iteration.", "caption"),
        p("5.2 Roles dans l'equipe cible", "h2"),
        table(
            [
                ["Role", "Responsabilite dans l'approche", "Sur ce projet individuel"],
                ["Product Owner (metropole)", "Priorise le backlog par valeur citoyenne, valide les demos de fin de sprint.", "Arbitrages joues a partir du cahier des charges du sujet."],
                ["Scrum Master", "Garantit la methode, leve les blocages, anime les retrospectives.", "Auto-discipline outillee : checklist, definition of done, kanban."],
                ["Tech Lead / architecte", "Tranche les choix techniques, garde la dette sous controle, revoit le code.", "Decisions consignees dans ce dossier (sections 3, 4, 8)."],
                ["Developpeur front / PWA", "Implemente UI, accessibilite, service worker, cartographie.", "Realise sprints 2 a 5."],
                ["Developpeur data / API", "Adaptateurs GTFS/GBFS, scripts d'ingestion, contrats de donnees.", "Realise sprint 4 (fetch_gtfs.py, transportApi.ts)."],
                ["QA", "Strategie de tests, non-regression, recette preprod.", "Tests Vitest + verification terminale systematique."],
            ],
            widths=[92, 175, CONTENT_WIDTH - 267],
        ),
        p("5.3 Environnement et outils de travail", "h2"),
        table(
            [
                ["Categorie", "Outils", "Role dans le cycle"],
                ["Developpement", "Node 26, Vite 7, TypeScript 5.8, React 19", "Boucle locale instantanee, typage strict des contrats de donnees."],
                ["Qualite", "ESLint (react-hooks, jsx-a11y), Vitest + jsdom", "Lint bloquant et 9 tests unitaires executes avant tout build."],
                ["UI / design", "Tailwind CSS 4, shadcn/ui, MapLibre GL, Bricolage Grotesque / Figtree", "Systeme de design tokenise (oklch), composants accessibles."],
                ["Donnees", "python3 stdlib (fetch_gtfs.py), APIs open data", "Ingestion GTFS reproductible au build, flux GBFS live au runtime."],
                ["Livraison", "npm run check (lint + test + build), generation PDF ReportLab", "Une commande unique valide l'ensemble avant livraison."],
            ],
            widths=[75, 155, CONTENT_WIDTH - 230],
        ),
        p("5.4 Demarche d'amelioration continue : DMAIC applique", "h2"),
        table(
            [
                ["Phase", "Application concrete sur UrbanFlow"],
                ["Define", "Irritant cible par sprint, ex. sprint 4 : les donnees transport simulees ne prouvent pas l'interoperabilite reelle. "],
                ["Measure", "Indicateurs objectifs : nombre de tests verts, temps de build, poids du bundle, nombre d'arrets/stations reels charges, avertissements lint."],
                ["Analyze", "Analyse de cause : le blocage venait du format GTFS (zip CSV volumineux) inadapte a un client web."],
                ["Improve", "Solution : ingestion au build (130 arrets TCL reels filtres) + GBFS interroge en direct ; verification par captures et tests."],
                ["Control", "Verrouillage : tests unitaires sur la fusion GBFS, npm run check bloquant, statut des sources visible dans l'UI."],
            ],
            widths=[58, CONTENT_WIDTH - 58],
        ),
        p(
            "Bilan d'iteration (esprit Kaizen) : chaque retrospective a produit au moins un ajustement applique au sprint "
            "suivant : reduction de la taille des marqueurs carte apres surcharge visuelle constatee, message de statut des "
            "sources de donnees apres confusion live/simule, verrouillage du select natif au profit d'un composant accessible. "
            "Les frictions restantes et leur traitement sont detailles en section 10.",
        ),
        PageBreak(),
    ]


def scaled(drawing: Drawing, factor: float) -> Drawing:
    drawing.scale(factor, factor)
    drawing.width *= factor
    drawing.height *= factor
    return drawing


def section_6() -> list:
    return [
        p("6. Modelisation UML", "h1"),
        p("6.1 Diagramme de cas d'utilisation", "h2"),
        scaled(use_case_diagram(), 0.94),
        p(
            "Figure 2 - Le citoyen accede a six cas d'utilisation apres authentification : gestion de profil, planification "
            "multimodale, navigation GPS, suivi carbone et sauvegarde de trajets. L'operateur de mobilite alimente le systeme "
            "en flux GTFS/GBFS et signale les incidents ; la metropole administre et consulte les indicateurs d'usage. "
            "L'inclusion entre planification et navigation est implicite : la navigation etend un trajet selectionne.",
            "caption",
        ),
        KeepTogether([
            p("6.2 Diagramme de sequence : planifier puis enregistrer un trajet", "h2"),
            scaled(sequence_diagram(), 0.88),
            p(
                "Figure 3 - Sequence du parcours cle. Fleches pleines : appels ; pointillees : retours. Le moteur RoutePlanner "
                "croise le profil et la position (2), interroge en parallele geocodage BAN, geometries OSRM et disponibilites "
                "GBFS (3-4), puis score les options (5). L'enregistrement volontaire (7-8) declenche le calcul du CO2 evite "
                "et la mise a jour de l'objectif hebdomadaire (9-10).",
                "caption",
            ),
        ]),
        PageBreak(),
        p("6.3 Diagramme de communication", "h2"),
        communication_diagram(),
        p(
            "Figure 4 - Collaboration entre objets, numerotee dans l'ordre des messages. 1 : l'App delegue l'authentification "
            "(AuthService derive le mot de passe et persiste la session, 1.1). 2 : la planification appelle le moteur, qui "
            "obtient le reseau aupres de TransportApi (2.1 : GTFS TCL, GBFS Velo'v/Dott, meteo) et les geometries aupres "
            "d'ExternalApis (2.2 : OSRM, BAN). 3 : l'enregistrement d'un trajet passe par CarbonTracker qui persiste "
            "l'historique minimal (3.1). Ce decoupage en services a responsabilite unique est la cle de la maintenabilite : "
            "chaque adaptateur est remplacable par un appel a l'API cible sans toucher les autres objets.",
            "caption",
        ),
        p("6.4 Nomenclature", "h2"),
        p(
            "Les nomenclatures sont univoques et homogenes dans tout le projet : les entites portent les noms des standards "
            "(GtfsStop, GtfsRoute, SharedStation, wheelchair_boarding), les services sont suffixes par leur role (AuthService, "
            "RoutePlanner, TransportApi, CarbonTracker) et les types TypeScript font foi : le code, les diagrammes et ce "
            "dossier utilisent strictement les memes identifiants.",
        ),
        PageBreak(),
    ]


def section_7() -> list:
    return [
        p("7. Specifications de la fonctionnalite cle", "h1"),
        p(
            "Fonctionnalite retenue : <b>le planificateur d'itineraires multimodal avec geolocalisation temps reel</b> (F2), "
            "coeur de la proposition de valeur et point de convergence de F1 (profil), F3 (donnees transport) et de l'option "
            "carbone.",
        ),
        p("7.1 Specification fonctionnelle", "h2"),
        table(
            [
                ["Rubrique", "Specification"],
                ["Declencheur", "L'utilisateur definit un depart (recherche d'adresse, point d'interet, ou position GPS) et une destination."],
                ["Entrees", "Depart, arrivee (GeoPoint), profil de mobilite : modes preferes, marche maximale (min), priorite PMR, sensibilite pluie ; reseau transport (arrets GTFS, stations GBFS, incidents, meteo)."],
                ["Regles de gestion", "RG1 : seuls les modes actives par l'utilisateur produisent des options. RG2 : si priorite PMR, tout segment transport public doit partir et arriver a un arret wheelchair_boarding=1, sinon l'option est marquee non accessible. RG3 : un segment velo/trottinette exige une station a moins de 400 m avec au moins 1 vehicule disponible (donnee GBFS live). RG4 : en cas de pluie signalee et sensibilite activee, les options exposees ajoutent un avertissement et leur score est penalise. RG5 : la marche totale ne depasse pas la marche maximale du profil."],
                ["Scoring", "Score 0-100 = combinaison ponderee : adequation aux preferences (40 %), duree relative (30 %), CO2 (20 %), fiabilite/incidents (10 %). Les coefficients sont centralises et testes unitairement."],
                ["Sorties", "2 a 5 options RouteOption ordonnees : titre, resume, segments detailles (from/to, distance, duree, CO2), avertissements, score, badge PMR, geometrie affichable et instructions pas-a-pas."],
                ["Geolocalisation", "Suivi continu watchPosition (haute precision, timeout 10 s) : recentrage de la carte, distance restante, validation du depart (l'utilisateur doit etre a moins de 150 m du point de depart pour lancer la navigation), progression le long du trace."],
                ["Etats d'erreur", "Permission GPS refusee : mode manuel avec position demo etiquetee. API de routage indisponible : trace directe locale avec statut degrade affiche. Flux GBFS indisponible : fallback local date et signale. Aucune option possible : message explicite et suggestions de modes a activer."],
            ],
            widths=[78, CONTENT_WIDTH - 78],
        ),
        PageBreak(),
        p("7.2 Specification technique", "h2"),
        table(
            [
                ["Composant", "Contrat et implementation"],
                ["Types de domaine (types.ts)", "GeoPoint, MobilityProfile, GtfsFeed, SharedMobilityFeed, RouteOption, RouteLeg, RouteInstruction, TripRecord : contrats TypeScript stricts partages par toute l'application, alignes sur les champs GTFS/GBFS officiels."],
                ["Moteur (routePlanner.ts)", "Fonctions pures sans effet de bord : haversineDistanceKm, generation d'options par mode, scoring pondere. Testable unitairement (5 tests), deterministe, independant du DOM : migrable tel quel cote serveur."],
                ["Adaptateur transport (transportApi.ts)", "loadTransportNetwork() : GTFS local genere depuis le zip officiel TCL + fusion GBFS live : mergeVelovStations (station_information x station_status, GBFS v3) et mapDottVehicles (free_bike_status, v2.3) ; timeout 8 s et fallback local ; source de chaque flux exposee a l'UI."],
                ["APIs externes (externalApis.ts)", "searchPlaces : api-adresse.data.gouv.fr (BAN) avec debounce 220 ms et AbortController ; enhanceRoutesWithLiveRouting : OSRM profils foot/bike/driving, geometries GeoJSON, instructions traduites en francais, recalcul duree/CO2/score."],
                ["Ingestion GTFS (fetch_gtfs.py)", "Telecharge le GTFS officiel TCL (ODbL, ~43 Mo), filtre metro/tram/funiculaire et 130 arrets dans un rayon de 3,2 km, genere public/data/gtfs-feed.json ; cache 24 h, stdlib uniquement, reproductible (npm run generate:gtfs)."],
                ["Rendu carte (UrbanMap.tsx)", "MapLibre GL, sources GeoJSON reactives (traces, arrets, stations, incidents, position), mise a jour differentielle sans recreation de carte, ajustement de vue automatique sur le trajet selectionne."],
                ["Performances", "Debounce des recherches, annulation des requetes obsoletes, plafonds de donnees (130 arrets, 90 stations, 80 trottinettes), bundle unique ~400 kB gzip, tuiles et shell caches par le service worker."],
            ],
            widths=[105, CONTENT_WIDTH - 105],
        ),
        p("7.3 Criteres d'acceptation verifies", "h2"),
        bullet("Un trajet Bellecour vers Part-Dieu produit au moins 4 options multimodales scorees en moins de 3 secondes avec reseau (verifie en demonstration, section 11)."),
        bullet("Le profil PMR ne propose que des correspondances accessibles et l'affiche explicitement (badge PMR compatible)."),
        bullet("La coupure du reseau apres chargement initial laisse l'application utilisable : shell servi par le service worker, fallback transport local signale."),
        bullet("Le suivi GPS met a jour position, distance restante et instruction courante sans rechargement (watchPosition)."),
        PageBreak(),
    ]


def section_8() -> list:
    return [
        p("8. Architecture technique, evolutivite et maintenabilite", "h1"),
        architecture_diagram(),
        p(
            "Figure 5 - Architecture livree (PWA + APIs open data reelles) et trajectoire cible metropolitaine. "
            "Les fleches pointillees indiquent la migration prevue : les adaptateurs du client pointeront vers l'API "
            "Gateway sans changement de contrat.",
            "caption",
        ),
        p("8.1 Principes structurants", "h2"),
        bullet("<b>Separation stricte des responsabilites</b> : UI (App, UrbanMap), services metier (routePlanner, carbon), adaptateurs de donnees (transportApi, externalApis), securite (auth). Aucune logique metier dans les composants d'affichage."),
        bullet("<b>Contrats de donnees standards</b> : les types GTFS/GBFS du code reprennent les champs officiels : brancher un nouvel operateur conforme = ecrire un adaptateur, sans toucher au moteur ni a l'UI (C9 interoperabilite)."),
        bullet("<b>Degradation gracieuse systematique</b> : chaque dependance externe a un comportement de repli defini (fallback local, trace directe, position demo) et un statut visible : l'application n'a pas d'etat mort."),
        bullet("<b>Mobile first et eco-conception</b> : un seul bundle optimise (~400 kB gzip), polices auto-hebergees, donnees plafonnees au perimetre utile, cache offline : moins de reseau, moins d'energie (C5, C10)."),
        p("8.2 Evolutivite : trajectoire en trois paliers", "h2"),
        table(
            [
                ["Palier", "Declencheur", "Evolution", "Ce qui ne change pas"],
                ["1. MVP livre", "Preuve des parcours", "PWA + open data directs", "-"],
                ["2. API metropolitaine", "Au-dela de quelques milliers d'utilisateurs, besoin de comptes centralises",
                 "API Gateway, OIDC/JWT, PostgreSQL/PostGIS, cache Redis, workers d'ingestion GTFS-RT/SIRI sous convention operateur",
                 "L'UI, le moteur de scoring, les types de domaine : les adaptateurs changent d'URL, pas de signature."],
                ["3. Services metropole", "Reservation/billettique, covoiturage dynamique",
                 "Services dedies derriere la Gateway, notifications push, webhooks operateurs",
                 "Le socle PWA et le modele RouteOption, concu pour accueillir de nouveaux modes."],
            ],
            widths=[80, 118, 155, CONTENT_WIDTH - 353],
        ),
        p("8.3 Maintenabilite mesuree", "h2"),
        bullet("TypeScript strict de bout en bout : le contrat GTFS/GBFS casse a la compilation, pas en production."),
        bullet("9 tests unitaires cibles sur les fonctions a risque (scoring, carbone, fusion GBFS) executes en moins de 2 s : la boucle de correction reste courte."),
        bullet("ESLint avec regles react-hooks et jsx-a11y bloquantes : les regressions d'accessibilite sont traitees comme des erreurs de build."),
        bullet("Une commande unique de verification (npm run check) et des scripts reproductibles (generate:gtfs, generate:pdf) : tout contributeur reconstruit l'ensemble a l'identique."),
        PageBreak(),
    ]


def section_9() -> list:
    return [
        p("9. Securite (OWASP) et protection des donnees (RGPD)", "h1"),
        p("9.1 Mesures alignees sur l'OWASP Top 10", "h2"),
        table(
            [
                ["Risque OWASP", "Mesure appliquee dans la version livree", "Complement en architecture cible"],
                ["A01 Broken Access Control", "Ecrans et donnees conditionnes a une session valide ; suppression de compte purge toutes les donnees liees.", "Controle d'acces par ressource cote API, tokens a duree courte."],
                ["A02 Cryptographic Failures", "Aucun mot de passe en clair : derivation PBKDF2-SHA-256, 120 000 iterations, sel aleatoire par compte (Web Crypto).", "Argon2id cote serveur, chiffrement au repos PostgreSQL."],
                ["A03 Injection", "Aucune evaluation dynamique ; React echappe le rendu ; entrees validees et typees ; URLs construites via URLSearchParams.", "Requetes preparees, validation de schema cote API."],
                ["A05 Security Misconfiguration", "Dependances epinglees, lint bloquant, aucune cle secrete dans le code (les flux utilises sont publics).", "Durcissement CSP, en-tetes de securite, scans de dependances CI."],
                ["A07 Identification Failures", "Messages d'erreur de connexion generiques (pas d'enumeration de comptes), mot de passe minimum 12 caracteres.", "MFA administrateurs, limitation de debit, journal d'audit."],
                ["A09 Logging Failures", "Etats d'erreur visibles et explicites cote client (statuts de flux, GPS, routage).", "Logs structures centralises, alerting SLO."],
            ],
            widths=[95, 190, CONTENT_WIDTH - 285],
        ),
        p("9.2 RGPD : donnees de geolocalisation et minimisation", "h2"),
        table(
            [
                ["Principe", "Application concrete"],
                ["Consentement prealable", "La geolocalisation n'est jamais activee sans action explicite ; refus = mode manuel etiquete, sans perte de fonctionnalite de planification."],
                ["Minimisation", "Seuls sont conserves les agregats utiles au suivi carbone (mode, distance, CO2, date) : jamais de trace GPS brute persistee."],
                ["Localite des donnees", "Dans cette version, profils et historiques restent dans le navigateur de l'usager : aucune transmission a un serveur UrbanFlow."],
                ["Droit a l'effacement", "Suppression de l'historique en un clic et suppression de compte totale (profil + trajets + session) depuis l'interface."],
                ["Transparence", "La provenance de chaque flux (live ou simule) et l'usage de la position sont affiches dans l'interface."],
            ],
            widths=[92, CONTENT_WIDTH - 92],
        ),
        p(
            "Les appels aux APIs publiques (BAN, OSRM, GBFS, Open-Meteo) transitent en HTTPS et ne portent aucun "
            "identifiant utilisateur : seules des coordonnees ponctuelles necessaires au service sont transmises (C11).",
        ),
        PageBreak(),
    ]


def section_10() -> list:
    return [
        p("10. Qualite logicielle, tests et traitement des bogues", "h1"),
        p("10.1 Strategie de tests deployee", "h2"),
        table(
            [
                ["Niveau", "Outillage", "Perimetre couvert"],
                ["Tests unitaires (9)", "Vitest + jsdom", "Moteur d'itineraires (scoring, PMR, modes), calcul carbone (facteurs, objectif), fusion GBFS (Velo'v v3, Dott, filtrage geographique), classification meteo."],
                ["Analyse statique", "TypeScript strict + ESLint (react-hooks, jsx-a11y)", "Contrats de donnees, regles des hooks, accessibilite des composants : bloquant en build."],
                ["Tests manuels structures", "Scenarios de recette par sprint", "Parcours complets mobile et desktop : auth, planification, navigation GPS, offline, PMR, suppression RGPD."],
                ["Verification de bout en bout", "npm run check + captures automatisees (Playwright)", "Lint + 9 tests + build production ; les ecrans de la section 11 sont generes par script, donc reproductibles."],
            ],
            widths=[92, 118, CONTENT_WIDTH - 210],
        ),
        p("10.2 Processus de traitement des bogues", "h2"),
        bug_workflow_diagram(),
        p("Figure 6 - Cycle de vie d'un bogue, de la detection a la recette en preproduction.", "caption"),
        bullet("<b>Qualification</b> : chaque ticket contient environnement, etapes de reproduction, resultat attendu/observe, capture et criticite (bloqueur / majeur / mineur)."),
        bullet("<b>Regle de non-regression</b> : tout bogue sur une fonction pure (scoring, carbone, fusion de flux) donne lieu a un test unitaire ecrit avant le correctif : le bogue ne peut pas revenir silencieusement."),
        bullet("<b>Preproduction</b> : recette sur donnees figees (GTFS cache, GBFS fallback) pour etre deterministe, smoke tests PWA (installation, offline, permissions GPS refusees), audit contrastes et navigation clavier."),
        bullet("<b>Criteres de sortie</b> : zero bloqueur, majeurs explicitement acceptes par le PO, npm run check vert, checklist de deploiement signee."),
        p("10.3 Exemples reels traites pendant la production", "h2"),
        table(
            [
                ["Bogue constate", "Cause racine", "Correctif et verrouillage"],
                ["Le clic 'compte demo' ne connectait pas dans les tests automatises",
                 "Le bouton ne fait que pre-remplir le formulaire : la soumission restait necessaire",
                 "Scenario de test corrige (remplir puis soumettre) ; libelles des actions clarifies."],
                ["Carte illisible apres branchement des donnees reelles (300+ marqueurs)",
                 "Rayon de marqueur calibre pour 6 arrets simules, pas pour 130 arrets + 170 stations",
                 "Rayon reduit (5 vers 3,5 px) et plafonds de donnees par couche ; controle visuel par capture avant/apres."],
                ["Erreurs lint 'process is not defined' apres ajout du script de captures",
                 "Script Node analyse avec l'environnement navigateur par defaut d'ESLint",
                 "Perimetre lint explicite (ignore du script outillage) : le check global reste bloquant."],
            ],
            widths=[140, 140, CONTENT_WIDTH - 280],
        ),
        PageBreak(),
    ]


def section_11() -> list:
    return [
        p("11. Realisation : parcours applicatifs commentes", "h1"),
        p(
            "Les captures suivantes sont generees automatiquement (Playwright + Chromium) sur l'application en fonctionnement "
            "reel, connectee aux flux publics : elles sont reproductibles a l'identique via les scripts du depot.",
        ),
        p("11.1 Authentification et identite visuelle", "h2"),
        screenshot("01-auth-desktop-crop.png", 152,
                   "Ecran d'authentification (desktop) : identite 'eco-urbaine' (vert pin, creme, accent lime, Bricolage Grotesque), "
                   "connexion, inscription et compte de demonstration. Mot de passe derive PBKDF2 avant tout stockage."),
        screenshot_pair("02-auth-mobile.png", "07-navigation-mobile.png", 45,
                        "A gauche : authentification mobile (mobile first, cibles tactiles genereuses). A droite : navigation GPS active : "
                        "instruction courante, distance restante, progression et sortie protegee par confirmation."),
        PageBreak(),
        p("11.2 Planification multimodale sur donnees reelles", "h2"),
        screenshot("03-planner-desktop.png", 168,
                   "Planificateur (desktop) : trajet Bellecour vers Part-Dieu. Options scorees (86/100), segments detailles : approche "
                   "velo vers la station Velo'v BELLECOUR / ST EXUPERY (23 velos disponibles en GBFS live), metro A vers Part-Dieu "
                   "Auditorium (arrets GTFS TCL reels), badge PMR compatible, CO2 par option et bandeau de statut des sources live."),
        screenshot("06-planner-mobile.png", 54,
                   "Meme parcours en mobile first : carte plein ecran, GPS actif (precision affichee), feuille de trajets glissable, "
                   "alternatives comparables d'un geste et validation de proximite du depart avant navigation."),
        PageBreak(),
        p("11.3 Suivi carbone et profil de mobilite", "h2"),
        screenshot("04-carbon-desktop.png", 168,
                   "Apres enregistrement du trajet : 455 g de CO2 evites comptabilises, progression vers l'objectif hebdomadaire (8 %), "
                   "historique effacable en un clic (RGPD). Le panneau de droite detaille le trajet actif et ses correspondances."),
        screenshot("05-profile-desktop.png", 148,
                   "Profil et preferences : modes favoris, marche maximale, priorite PMR, deconnexion et suppression de compte. "
                   "Ces preferences alimentent directement le scoring du planificateur (RG1, RG2, RG5)."),
        PageBreak(),
    ]


def section_12() -> list:
    return [
        p("12. Couverture des contraintes C1 a C12", "h1"),
        table(
            [
                ["ID", "Contrainte", "Preuve concrete dans le projet"],
                ["C1", "PWA installable", "manifest.webmanifest (standalone, icones 192/512, theme), sw.js cache-first + page offline, installable Chrome/Android et iOS."],
                ["C2", "Responsive / UX", "Mobile first : carte plein ecran + bottom sheet ; desktop : shell 3 colonnes ; memes parcours, zero fonctionnalite perdue selon le support."],
                ["C3", "Normes et standards", "TypeScript strict, ESLint bloquant, standards GTFS/GBFS/GeoJSON, composants shadcn/Radix accessibles, conventions de nommage univoques."],
                ["C4", "Securite OWASP", "PBKDF2-SHA-256 (120k iterations), erreurs generiques en connexion, validation des entrees, aucune evaluation dynamique (section 9.1)."],
                ["C5", "Eco-conception", "Bundle unique ~400 kB gzip, polices auto-hebergees, plafonds de donnees, cache offline, aucune ressource tierce superflue (pas de trackers)."],
                ["C6", "Geolocalisation fiable", "watchPosition haute precision, precision affichee en metres, validation de proximite au depart, fallback manuel etiquete."],
                ["C7", "Accessibilite WCAG 2.1 AA", "61 attributs ARIA/labels dans l'App, navigation clavier complete, focus visible, contrastes AA du systeme de design, regles jsx-a11y bloquantes."],
                ["C8", "RGPD", "Consentement geolocalisation, minimisation (pas de trace GPS persistee), donnees locales, effacement historique et compte (section 9.2)."],
                ["C9", "Interoperabilite", "Champs GTFS/GBFS officiels dans les types, adaptateurs par operateur, GTFS TCL reel + GBFS Velo'v/Dott reels integres sans modification du moteur."],
                ["C10", "Performances / connectivite variable", "Service worker, fallback local des flux, debounce et annulation des requetes, timeouts 8 s, etats de chargement et statuts visibles."],
                ["C11", "Securite des donnees de deplacement", "Aucune donnee de deplacement transmise a un serveur UrbanFlow ; appels APIs anonymes en HTTPS ; separation profil / historique."],
                ["C12", "Normes transport (PMR)", "wheelchair_boarding exploite depuis le GTFS TCL reel, regle RG2 (correspondances accessibles), badge PMR compatible par option."],
            ],
            widths=[26, 108, CONTENT_WIDTH - 134],
        ),
        PageBreak(),
    ]


def section_13() -> list:
    return [
        p("13. Verification finale, bilan et perspectives", "h1"),
        p("13.1 Preuves de verification terminale", "h2"),
        table(
            [
                ["Controle", "Commande", "Resultat verifie"],
                ["Qualite statique", "npm run lint", "0 erreur ESLint (regles react-hooks et jsx-a11y incluses)."],
                ["Tests unitaires", "npm run test", "3 fichiers, 9 tests verts : routePlanner, carbon, transportApi."],
                ["Build production", "npm run build", "Compilation TypeScript stricte + bundle Vite generes sans erreur."],
                ["Chaine complete", "npm run check", "Lint + tests + build en une commande, bloquante avant toute livraison."],
                ["Donnees reelles", "npm run generate:gtfs", "130 arrets et 14 lignes TCL reels regeneres depuis le GTFS officiel (ODbL)."],
                ["Ce dossier", "npm run generate:pdf", "PDF genere par script (ReportLab), captures reproductibles, moins de 40 pages."],
            ],
            widths=[85, 118, CONTENT_WIDTH - 203],
        ),
        p("13.2 Bilan au regard du besoin", "h2"),
        p(
            "La version livree couvre l'integralite du perimetre impose : F1, F2, F3 et l'option carbone fonctionnent de "
            "bout en bout sur donnees reelles (GTFS TCL, GBFS Velo'v et Dott, OSRM, BAN, Open-Meteo), dans une PWA "
            "installable, mobile first, accessible et respectueuse des donnees personnelles. Les choix d'architecture "
            "n'hypothequent aucune evolution : la trajectoire vers l'API metropolitaine est documentee et les contrats de "
            "donnees sont stables.",
        ),
        p("13.3 Perspectives", "h2"),
        bullet("Conventionner avec SYTRAL l'acces aux flux temps reel (SIRI Lite / GTFS-RT) pour remplacer les incidents simules."),
        bullet("Deployer l'API metropolitaine (palier 2) : comptes centralises, historique multi-appareils, notifications push."),
        bullet("Ouvrir la reservation unifiee et le covoiturage dynamique (palier 3), puis mesurer le report modal reel via les indicateurs agreges anonymises."),
        bullet("Etendre la couverture de tests : tests de composants (Testing Library), tests de bout en bout Playwright en CI et audits accessibilite automatises (axe-core)."),
        Spacer(1, 14),
        table(
            [
                ["UrbanFlow Mobility - synthese"],
                ["Une plateforme de mobilite urbaine intelligente, sobre et interoperable : concue mobile first, construite "
                 "sur les standards ouverts du transport, verifiee par des preuves reproductibles, et prete a grandir avec la metropole."],
            ],
            widths=[CONTENT_WIDTH],
            header=True,
            zebra=False,
        ),
    ]


def build_story() -> list:
    story = []
    story.extend(cover_page())
    story.extend(toc_page())
    story.extend(section_1())
    story.extend(section_2())
    story.extend(section_3())
    story.extend(section_4())
    story.extend(section_5())
    story.extend(section_6())
    story.extend(section_7())
    story.extend(section_8())
    story.extend(section_9())
    story.extend(section_10())
    story.extend(section_11())
    story.extend(section_12())
    story.extend(section_13())
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=17 * mm,
        bottomMargin=16 * mm,
        title="Dossier projet UrbanFlow Mobility - T6 CDSD septembre 2026",
        author="Candidat T6 CDSD",
    )
    doc.build(build_story(), onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
