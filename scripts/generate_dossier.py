"""Genere le dossier projet PDF UrbanFlow Mobility (T6 CDSD, session septembre 2026).

Structure alignee sur la grille d'evaluation RNCP 36146 :
- BC01 : specification des besoins, etat de l'art, recommandations, specifications
  fonctionnelles et architecture (C1.1, C1.2, C1.3).
- BC02 : approche iterative, outils, roles, tests, amelioration continue (C2.1, C2.2).
- BC03 : realisations techniques, APIs reelles, traitement des bogues (C3.1, C3.2, C3.3).
"""

from pathlib import Path
import re

from PIL import Image as PILImage
from reportlab.graphics.shapes import Circle, Drawing, Ellipse, Line, Polygon, Rect, String
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
METRICS = ROOT / "output" / "metrics"


# ---------------------------------------------------------------------------
# Metriques extraites des artefacts reels : le PDF ne recopie aucun chiffre a
# la main. build.json est obligatoire (produit par scripts/build-metrics.mjs
# via npm run generate:pdf) ; les autres proviennent des scripts d'audit.
# ---------------------------------------------------------------------------
import json


def _load_metrics(name: str, fallback: dict | None = None) -> dict:
    path = METRICS / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    if fallback is None:
        raise SystemExit(
            f"Metriques manquantes: {path}. Executer `npm run build` puis les scripts de mesure "
            "(metrics:build, bench:perf, audit:a11y, e2e) avant de generer le PDF."
        )
    return fallback


def _fr_date(iso_timestamp: str) -> str:
    date_part = iso_timestamp[:10]
    year, month, day = date_part.split("-")
    return f"{day}/{month}/{year}"


def _fr_kb(value: float) -> str:
    return f"{value:.2f}".replace(".", ",")


BUILD_M = _load_metrics("build")
PERF_M = _load_metrics("perf")
A11Y_M = _load_metrics("a11y")
E2E_M = _load_metrics("e2e")

ENTRY_KB = _fr_kb(BUILD_M["entry"]["gzipKb"])
MAPLIBRE_KB = _fr_kb(BUILD_M["maplibre"]["gzipKb"])
BUILD_DATE = _fr_date(BUILD_M["builtAt"])
FCP_MED = PERF_M["fcp"]["median"]
FCP_P95 = PERF_M["fcp"]["p95"]
LOAD_MED = PERF_M["load"]["median"]
TRANSFER_KB = PERF_M["transferredKbMedian"]
PERF_RUNS = PERF_M["runs"]
PERF_DATE = _fr_date(PERF_M["generatedAt"])
A11Y_VIOLATIONS = A11Y_M["violations"]
A11Y_SCREENS = A11Y_M["screens"]
A11Y_DATE = _fr_date(A11Y_M["generatedAt"])
E2E_DATE = _fr_date(E2E_M["generatedAt"])
E2E_STATUS = f"{E2E_M['assertions']}/{E2E_M['assertions']} assertions bloquantes passees" if E2E_M["passed"] else "ECHEC"

_test_files = sorted((ROOT / "src" / "lib").glob("*.test.ts"))
TEST_FILES = len(_test_files)
TEST_COUNT = sum(len(re.findall(r"^\s*it\(", f.read_text(), re.M)) for f in _test_files)
_planner_tests = next((f for f in _test_files if f.name == "routePlanner.test.ts"), None)
PLANNER_TEST_COUNT = len(re.findall(r"^\s*it\(", _planner_tests.read_text(), re.M)) if _planner_tests else 0
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


# Le dossier source reste facile a maintenir en ASCII, mais le livrable final doit
# respecter l'orthographe francaise. Les remplacements ne s'appliquent qu'aux
# textes rendus (paragraphes, tableaux et libelles), jamais aux identifiants du code.
ACCENT_REPLACEMENTS = (
    # Expressions figees d'abord (prioritaires sur les mots isoles).
    ("a la demande", "à la demande"), ("a froid", "à froid"), ("a jour", "à jour"),
    ("a la main", "à la main"), ("a chaque", "à chaque"), ("a terme", "à terme"),
    ("a partir", "à partir"), ("a moins de", "à moins de"), ("a destination", "à destination"),
    ("a venir", "à venir"), ("a portee", "à portée"), ("a rejouer", "à rejouer"),
    ("a ajouter", "à ajouter"), ("a signer", "à signer"), ("a une date", "à une date"),
    ("a l'identique", "à l'identique"), ("a l'execution", "à l'exécution"),
    ("grace a", "grâce à"), ("jusqu'a", "jusqu'à"), ("au-dela", "au-delà"),
    ("des que", "dès que"), ("des le", "dès le"), ("cote serveur", "côté serveur"),
    ("cote client", "côté client"),
    ("trajets programmes", "trajets programmés"), ("trajet programme", "trajet programmé"),
    ("est derive", "est dérivé"), ("derive de l'objectif", "dérivé de l'objectif"),
    # Mots sans ambiguite.
    ("increment accepte", "incrément accepté"), ("explicitement acceptes", "explicitement acceptés"),
    ("je prefere", "je préfère"), ("j'ai prefere", "j'ai préféré"),
    ("me suis fixe", "me suis fixé"), ("me suis fixee", "me suis fixée"),
    ("me suis impose", "me suis imposé"), ("me suis imposee", "me suis imposée"),
    ("me suis pose", "me suis posé"), ("me suis posee", "me suis posée"),
    ("j'ai pioche", "j'ai pioché"),
    ("avoir constate", "avoir constaté"), ("Bogue constate", "Bogue constaté"),
    ("perimetre impose", "périmètre imposé"), ("mode prefere", "mode préféré"),
    ("cote produit", "côté produit"), ("et remplace un select", "et remplacé un select"),
    ("concue", "conçue"), ("concus", "conçus"), ("concu", "conçu"),
    ("regressions", "régressions"), ("regression", "régression"),
    ("passe derive", "passe dérivé"), ("aleatoires", "aléatoires"), ("aleatoire", "aléatoire"),
    ("velo partage", "vélo partagé"), ("creee", "créée"), ("crees", "créés"),
    ("desactivees", "désactivées"), ("desactive", "désactivé"),
    ("delegue", "délègue"), ("PWA persiste", "PWA persiste"),
    ("ventilee", "ventilée"), ("ventile", "ventilé"),
    ("regeneres", "régénérés"), ("regenere", "régénéré"),
    ("isolee", "isolée"), ("j'ai isole", "j'ai isolé"),
    ("etre exporte", "être exporté"), ("dedies", "dédiés"), ("dediee", "dédiée"), ("dedie", "dédié"),
    ("verrouillee", "verrouillée"), ("verrouille par", "verrouillé par"),
    ("abandonnes", "abandonnés"), ("ordonnees", "ordonnées"),
    ("presentee", "présentée"), ("pilote reporte", "pilote reporté"),
    ("jours ouvres", "jours ouvrés"), ("recuperables", "récupérables"),
    ("facilite", "facilité"), ("vecus", "vécus"), ("econome", "économe"),
    ("ecrite", "écrite"), ("hypotheque", "hypothèque"), ("regenerer", "régénérer"),
    ("memoire", "mémoire"), ("decoule", "découle"), ("evidemment", "évidemment"),
    ("derriere", "derrière"), ("fixee", "fixée"), ("posee", "posée"),
    ("detaillent", "détaillent"), ("resserrant", "resserrant"), ("qu'a l'usage", "qu'à l'usage"),
    ("cote navigateur", "côté navigateur"), ("independants", "indépendants"),
    ("independante", "indépendante"), ("independant", "indépendant"),
    ("remplacables", "remplaçables"), ("remplacable", "remplaçable"),
    ("deterministe", "déterministe"), ("preferes", "préférés"), ("preferee", "préférée"),
    ("inferieures", "inférieures"), ("inferieure", "inférieure"), ("inferieur", "inférieur"),
    ("decouvre", "découvre"),
    ("meteo", "météo"), ("mobilite", "mobilité"), ("developpement", "développement"),
    ("limitees", "limitées"), ("limitee", "limitée"), ("pousses", "poussés"),
    ("criteres", "critères"), ("critere", "critère"), ("retrospectives", "rétrospectives"),
    ("retrospective", "rétrospective"), ("amelioration", "amélioration"),
    ("systemes", "systèmes"), ("systeme", "système"), ("metropolitaine", "métropolitaine"),
    ("metropolitain", "métropolitain"), ("metropole", "métropole"),
    ("reseaux", "réseaux"), ("reseau", "réseau"), ("departs", "départs"), ("depart", "départ"),
    ("geocodage", "géocodage"), ("geometries", "géométries"), ("geometrie", "géométrie"),
    ("demonstrateur", "démonstrateur"), ("demonstration", "démonstration"),
    ("versionnes", "versionnés"), ("versionne", "versionné"),
    ("proposees", "proposées"), ("proposee", "proposée"),
    ("increments", "incréments"), ("increment", "incrément"),
    ("rejouee", "rejouée"), ("rejoues", "rejoués"), ("simulees", "simulées"),
    ("operer", "opérer"), ("etats", "états"), ("etat", "état"),
    ("verifications", "vérifications"), ("verification", "vérification"),
    ("perimetre", "périmètre"), ("severites", "sévérités"), ("severite", "sévérité"),
    ("materialisees", "matérialisées"), ("agregats", "agrégats"),
    ("recurrentes", "récurrentes"), ("recurrente", "récurrente"),
    ("recurrents", "récurrents"), ("recurrent", "récurrent"),
    ("etiquetees", "étiquetées"), ("etiquetee", "étiquetée"), ("bornee", "bornée"),
    ("acces", "accès"), ("interet", "intérêt"), ("premiere", "première"),
    ("generees", "générées"), ("generee", "générée"), ("generes", "générés"),
    ("fonctionnalites", "fonctionnalités"), ("fonctionnalite", "fonctionnalité"),
    ("documentees", "documentées"), ("documentee", "documentée"),
    ("engagee", "engagée"), ("unifiee", "unifiée"), ("exprime", "exprimé"),
    ("problemes", "problèmes"), ("operateurs", "opérateurs"), ("operateur", "opérateur"),
    ("velos", "vélos"), ("velo", "vélo"), ("repond", "répond"), ("reunit", "réunit"),
    ("disponibilite", "disponibilité"), ("partages", "partagés"), ("partagee", "partagée"),
    ("deplacements", "déplacements"), ("deplacement", "déplacement"), ("metro", "métro"),
    ("metiers", "métiers"), ("metier", "métier"),
    ("hierarchises", "hiérarchisés"), ("hierarchisee", "hiérarchisée"),
    ("traitees", "traitées"), ("traitee", "traitée"),
    ("necessaires", "nécessaires"), ("necessaire", "nécessaire"),
    ("reponses", "réponses"), ("reponse", "réponse"),
    ("immediats", "immédiats"), ("immediate", "immédiate"), ("motive", "motivé"),
    ("montee", "montée"), ("reglementations", "réglementations"),
    ("prevues", "prévues"), ("prevue", "prévue"), ("prevus", "prévus"), ("prevu", "prévu"),
    ("deja", "déjà"), ("legale", "légale"), ("deliberement", "délibérément"),
    ("explicabilite", "explicabilité"), ("ponderes", "pondérés"), ("pondere", "pondéré"),
    ("labellisees", "labellisées"), ("arrets", "arrêts"), ("arret", "arrêt"),
    ("arrivee", "arrivée"), ("duree", "durée"), ("resume", "résumé"),
    ("detaillees", "détaillées"), ("detaillee", "détaillée"), ("detailles", "détaillés"),
    ("detaille", "détaillé"), ("detectees", "détectées"), ("detecte", "détecté"),
    ("elevee", "élevée"), ("eleve", "élevé"), ("emissions", "émissions"),
    ("emission", "émission"), ("etiquetes", "étiquetés"), ("etiquete", "étiqueté"),
    ("evitees", "évitées"), ("evitee", "évitée"), ("evites", "évités"),
    ("ecartee", "écartée"), ("ecarte", "écarté"), ("generees", "générées"),
    ("implementations", "implémentations"), ("implementation", "implémentation"),
    ("indisponibles", "indisponibles"), ("indisponible", "indisponible"),
    ("iterations", "itérations"), ("iteration", "itération"),
    ("nommees", "nommées"), ("nommee", "nommée"), ("optimisee", "optimisée"),
    ("parametres", "paramètres"), ("personnalises", "personnalisés"),
    ("planifiees", "planifiées"), ("planifiee", "planifiée"), ("protegee", "protégée"),
    ("publiee", "publiée"), ("qualifies", "qualifiés"), ("qualifie", "qualifié"),
    ("reduction", "réduction"), ("reservation", "réservation"),
    ("selectionnee", "sélectionnée"), ("simules", "simulés"), ("simule", "simulé"),
    ("structurees", "structurées"), ("structuree", "structurée"),
    ("hierarchisation", "hiérarchisation"), ("determine", "détermine"),
    ("assumee", "assumée"), ("assume", "assumé"), ("retombee", "retombée"),
    ("mobilites", "mobilités"), ("planifies", "planifiés"), ("apres", "après"),
    ("gagnees", "gagnées"), ("monetisation", "monétisation"), ("affirmee", "affirmée"),
    ("affichees", "affichées"), ("affichee", "affichée"),
    ("cumule", "cumulé"), ("defaut", "défaut"), ("chiffree", "chiffrée"),
    ("itineraires", "itinéraires"), ("itineraire", "itinéraire"),
    ("decalage", "décalage"), ("saturees", "saturées"),
    ("souverainete", "souveraineté"), ("reserve", "réserve"), ("editeur", "éditeur"),
    ("confirme", "confirmé"), ("decision", "décision"), ("economie", "économie"),
    ("budgetaire", "budgétaire"), ("sensibilite", "sensibilité"),
    ("separer", "séparer"), ("financiere", "financière"), ("releve", "relève"),
    ("meme", "même"), ("teste", "testé"), ("hebergement", "hébergement"),
    ("hebergees", "hébergées"), ("heberge", "hébergé"),
    ("plafonnees", "plafonnées"), ("assumees", "assumées"), ("detectee", "détectée"),
    ("livree", "livrée"), ("volumetrie", "volumétrie"), ("presente", "présenté"),
    ("depend", "dépend"), ("competences", "compétences"), ("reduit", "réduit"),
    ("preserve", "préserve"), ("ulterieure", "ultérieure"), ("salariee", "salariée"),
    ("medicaux", "médicaux"), ("bloquee", "bloquée"), ("scorees", "scorées"),
    ("fiabilite", "fiabilité"), ("memorisees", "mémorisées"), ("etudiant", "étudiant"),
    ("interoperable", "interopérable"), ("agregeable", "agrégeable"),
    ("disponibilites", "disponibilités"), ("plutot", "plutôt"),
    ("proprietaires", "propriétaires"), ("couteuse", "coûteuse"), ("coute", "coûte"),
    ("sequence", "séquence"), ("cle", "clé"), ("maintenabilite", "maintenabilité"),
    ("realisation", "réalisation"), ("commentes", "commentés"),
    ("datees", "datées"), ("etayent", "étayent"), ("schema", "schéma"),
    ("mediane", "médiane"), ("problemes", "problèmes"), ("probleme", "problème"),
    ("degrade", "dégradé"), ("automatise", "automatisé"), ("preserves", "préservés"),
    ("passes", "passés"), ("identifie", "identifié"), ("defendable", "défendable"),
    ("ideation", "idéation"), ("deployees", "déployées"), ("deployee", "déployée"),
    ("calibre", "calibré"), ("protege", "protégé"), ("signes", "signés"),
    ("henette", "Hénette"), ("theo", "Théo"),
    ("developpeurs", "développeurs"), ("developpeur", "développeur"),
    ("developpement", "développement"), ("developpee", "développée"),
    ("developpe", "développé"), ("developper", "développer"),
    ("deploiement", "déploiement"), ("deployer", "déployer"),
    ("geolocalisation", "géolocalisation"), ("mobilite", "mobilité"),
    ("metropolitaine", "métropolitaine"), ("metropole", "métropole"),
    ("securite", "sécurité"), ("qualite", "qualité"),
    ("perimetre", "périmètre"), ("donnees", "données"), ("donnee", "donnée"),
    ("reelles", "réelles"), ("reelle", "réelle"), ("reels", "réels"), ("reel", "réel"),
    ("verifiees", "vérifiées"), ("verifiee", "vérifiée"), ("verifies", "vérifiés"),
    ("verifie", "vérifié"), ("verification", "vérification"),
    ("ameliorations", "améliorations"), ("amelioration", "amélioration"),
    ("evolutivite", "évolutivité"), ("evolutive", "évolutive"),
    ("evolutions", "évolutions"), ("evolution", "évolution"),
    ("orientee", "orientée"), ("oriente", "orienté"),
    ("evaluation", "évaluation"), ("evaluees", "évaluées"), ("evaluee", "évaluée"),
    ("etudiees", "étudiées"), ("etudiee", "étudiée"), ("etudies", "étudiés"),
    ("comparees", "comparées"),
    ("comparee", "comparée"), ("etat", "état"),
    ("economiques", "économiques"), ("economique", "économique"),
    ("ecologique", "écologique"), ("eco-conception", "éco-conception"),
    ("ecosysteme", "écosystème"), ("ecrans", "écrans"), ("ecran", "écran"),
    ("couts", "coûts"), ("cout", "coût"), ("delais", "délais"), ("delai", "délai"),
    ("perennite", "pérennité"), ("maitrise", "maîtrise"),
    ("priorite", "priorité"), ("proprietaire", "propriétaire"),
    ("indisponibilite", "indisponibilité"), ("dependances", "dépendances"),
    ("dependance", "dépendance"), ("depreciee", "dépréciée"),
    ("integrees", "intégrées"), ("integree", "intégrée"), ("integres", "intégrés"),
    ("integre", "intégré"), ("integration", "intégration"),
    ("interoperabilite", "interopérabilité"), ("accessibilite", "accessibilité"),
    ("conformite", "conformité"), ("reglementaires", "réglementaires"),
    ("reglementaire", "réglementaire"), ("geometriques", "géométriques"),
    ("geometries", "géométries"), ("geometrie", "géométrie"),
    ("modelisation", "modélisation"), ("specifications", "spécifications"),
    ("specification", "spécification"), ("strategie", "stratégie"),
    ("methodologies", "méthodologies"), ("methodologie", "méthodologie"),
    ("methodologiques", "méthodologiques"), ("methodologique", "méthodologique"),
    ("methode", "méthode"), ("roles", "rôles"), ("role", "rôle"),
    ("criteres", "critères"), ("critere", "critère"),
    ("resultats", "résultats"), ("resultat", "résultat"),
    ("hypotheses", "hypothèses"), ("hypothese", "hypothèse"),
    ("preparation", "préparation"), ("references", "références"), ("reference", "référence"),
    ("raisonnee", "raisonnée"), ("complete", "complète"), ("complet", "complet"),
    ("complements", "compléments"), ("complement", "complément"),
    ("controles", "contrôles"), ("controle", "contrôle"),
    ("appliquees", "appliquées"), ("appliquee", "appliquée"),
    ("executees", "exécutées"), ("executee", "exécutée"), ("executes", "exécutés"),
    ("mesurees", "mesurées"), ("mesuree", "mesurée"), ("entree", "entrée"),
    ("differes", "différés"),
    ("differe", "différé"), ("repetitions", "répétitions"),
    ("reseaux", "réseaux"), ("reseau", "réseau"),
    ("geocodage", "géocodage"), ("geoplateforme", "Géoplateforme"),
    ("depreciation", "dépréciation"), ("actee", "actée"),
    ("isolees", "isolées"), ("isolee", "isolée"), ("isoles", "isolés"),
    ("recu", "reçu"), ("menacee", "menacée"), ("coeur", "cœur"),
    ("responsabilites", "responsabilités"), ("activite", "activité"),
    ("activites", "activités"), ("capacite", "capacité"),
    ("retrospective", "rétrospective"), ("retrospectives", "rétrospectives"),
    ("demonstration", "démonstration"), ("demarrage", "démarrage"),
    ("generiques", "génériques"), ("generique", "générique"),
    ("generees", "générées"), ("generee", "générée"), ("generes", "générés"),
    ("genere", "généré"), ("generation", "génération"),
    ("numero", "numéro"), ("precision", "précision"), ("preferences", "préférences"),
    ("scenario", "scénario"), ("scenarios", "scénarios"),
    ("synthese", "synthèse"), ("categorie", "catégorie"),
    ("deconnexion", "déconnexion"), ("reutilisation", "réutilisation"),
    ("itere", "itéré"), ("iterative", "itérative"), ("iteratif", "itératif"),
    ("regles", "règles"), ("regle", "règle"), ("modele", "modèle"),
    ("systeme", "système"), ("systemes", "systèmes"),
    ("equipe", "équipe"), ("equipes", "équipes"), ("equivalent", "équivalent"),
    ("etre", "être"),
    ("ecrits", "écrits"), ("ecrit", "écrit"),
    ("echelles", "échelles"), ("echelle", "échelle"),
    ("intermediaires", "intermédiaires"), ("intermediaire", "intermédiaire"),
    ("reserves", "réservés"), ("prepares", "préparés"),
    ("hierarchiser", "hiérarchiser"), ("priorites", "priorités"),
    ("retombees", "retombées"), ("compares", "comparés"),
    ("consequences", "conséquences"), ("homogenes", "homogènes"),
    ("appuyees", "appuyées"), ("representations", "représentations"),
    ("numerotee", "numérotée"), ("separation", "séparation"),
    ("declencheurs", "déclencheurs"), ("coherents", "cohérents"),
    ("adaptes", "adaptés"), ("etapes", "étapes"), ("expliques", "expliqués"),
    ("evaluables", "évaluables"), ("epreuves", "épreuves"),
    ("increments", "incréments"), ("increment", "incrément"),
    ("touches", "touchés"), ("depart", "départ"),
    ("accompagnes", "accompagnés"), ("non-regression", "non-régression"),
    ("ramenee", "ramenée"), ("croisee", "croisée"),
    ("revendiquee", "revendiquée"), ("proces-verbal", "procès-verbal"),
    ("meteo", "météo"), ("terminee", "terminée"),
    ("sequentiellement", "séquentiellement"), ("echec", "échec"),
    ("tracabilite", "traçabilité"), ("integralement", "intégralement"),
    ("renseignee", "renseignée"), ("financieres", "financières"),
    ("budgetaires", "budgétaires"), ("presentees", "présentées"),
    ("validite", "validité"), ("derive", "dérive"), ("superieur", "supérieur"),
    ("depasse", "dépassé"), ("surcout", "surcoût"), ("superieurs", "supérieurs"),
    ("cumulatives", "cumulatives"), ("reduire", "réduire"), ("ecart", "écart"),
    ("generalisation", "généralisation"), ("ecarts", "écarts"),
    ("criticite", "criticité"), ("competence", "compétence"),
    ("preparee", "préparée"), ("defendre", "défendre"),
    ("faisabilite", "faisabilité"), ("preserver", "préserver"),
    ("expliquer", "expliquer"), ("precis", "précis"),
    ("certifies", "certifiés"), ("verifiable", "vérifiable"),
    ("integrer", "intégrer"), ("definition", "définition"),
    ("adapte", "adapté"), ("centralise", "centralisé"),
    ("centralises", "centralisés"), ("ceremonie", "cérémonie"),
    ("execution", "exécution"), ("differee", "différée"),
    ("chaine", "chaîne"), ("comite", "comité"),
    ("echoue", "échoue"), ("epreuve", "épreuve"),
)


def fr(text: str) -> str:
    """Restaure les accents usuels dans les seuls textes affiches."""
    urls: list[str] = []

    def protect_url(match: re.Match[str]) -> str:
        urls.append(match.group(0))
        return f"__URL_{len(urls) - 1}__"

    rendered = re.sub(r"https?://[^\s<]+", protect_url, text)
    for ascii_word, french_word in ACCENT_REPLACEMENTS:
        pattern = rf"\b{re.escape(ascii_word)}\b"

        def replace(match: re.Match[str]) -> str:
            original = match.group(0)
            if original.isupper():
                return french_word.upper()
            if original[:1].isupper():
                return french_word[:1].upper() + french_word[1:]
            return french_word

        rendered = re.sub(pattern, replace, rendered, flags=re.IGNORECASE)
    rendered = re.sub(r"(?<!['’])\ba\b", "à", rendered)
    # Le mot ASCII "a" est majoritairement la preposition "à" dans le source,
    # mais ces quelques formes sont le verbe avoir. On les restaure apres la passe.
    verb_corrections = (
        ("Chaque appel externe à un timeout", "Chaque appel externe a un timeout"),
        ("chaque dépendance externe à un comportement", "chaque dépendance externe a un comportement"),
        ("L'arbitrage à été", "L'arbitrage a été"),
        ("Chaque cérémonie à une durée", "Chaque cérémonie a une durée"),
        ("chaque rétrospective à produit", "chaque rétrospective a produit"),
        ("est traite dès le MVP", "est traité dès le MVP"),
        ("non remplace par le lint", "non remplacé par le lint"),
        ("elle ne remplace ni sa décision", "elle ne remplace ni sa décision"),
    )
    for wrong, correct in verb_corrections:
        rendered = rendered.replace(wrong, correct)
    rendered = rendered.replace("Open-Météo", "Open-Meteo")
    for index, url in enumerate(urls):
        rendered = rendered.replace(f"__URL_{index}__", url)
    return rendered


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(fr(text), S[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(fr(text), S["bullet"], bulletText="-")


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
            [Paragraph(fr(str(cell)), S["tableHeader" if header and row_index == 0 else "tableCell"]) for cell in row]
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
    d.add(String(x + w / 2, y + h / 2 - 3, fr(text), fontName=FONT_BOLD, fontSize=size,
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


def oval_label(d: Drawing, cx, cy, w, h, text, fill=LIGHT, stroke=PINE, size=6.4) -> None:
    """Cas d'utilisation UML : ellipse, et non rectangle."""
    d.add(Ellipse(cx, cy, w / 2, h / 2, fillColor=fill, strokeColor=stroke, strokeWidth=1))
    lines = text.split("\n")
    start_y = cy - 2 + (len(lines) - 1) * 3.4
    for index, line in enumerate(lines):
        d.add(String(cx, start_y - index * 6.8, fr(line), fontName=FONT_BOLD, fontSize=size, fillColor=INK, textAnchor="middle"))


def dashed_stereotype_arrow(d: Drawing, x1, y1, x2, y2, stereotype: str) -> None:
    """Relation UML <<include>> / <<extend>> : trait pointille + fleche ouverte + stereotype."""
    import math

    line = Line(x1, y1, x2, y2, strokeColor=PINE_DARK, strokeWidth=0.9)
    line.strokeDashArray = [3, 2]
    d.add(line)
    angle = math.atan2(y2 - y1, x2 - x1)
    size = 7
    for sign in (-1, 1):
        d.add(
            Line(
                x2, y2,
                x2 - size * math.cos(angle + sign * 0.45),
                y2 - size * math.sin(angle + sign * 0.45),
                strokeColor=PINE_DARK, strokeWidth=0.9,
            )
        )
    mid_x = (x1 + x2) / 2
    mid_y = (y1 + y2) / 2
    d.add(String(mid_x, mid_y + 3, stereotype, fontName=FONT_BOLD, fontSize=5.8, fillColor=PINE_DARK, textAnchor="middle"))


def use_case_diagram() -> Drawing:
    d = Drawing(500, 290)
    d.add(Rect(112, 12, 286, 262, fillColor=colors.HexColor("#fbfaf5"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(255, 262, fr("Systeme UrbanFlow Mobility"), fontName=FONT_BOLD, fontSize=9.5, fillColor=PINE_DARK, textAnchor="middle"))

    actors = [("Citoyen", 46, 176), ("Operateur mobilite", 456, 202), ("Metropole (admin)", 456, 74)]
    for label, x, y in actors:
        d.add(Circle(x, y + 28, 9, fillColor=colors.white, strokeColor=INK))
        d.add(Line(x, y + 19, x, y - 8, strokeColor=INK))
        d.add(Line(x - 12, y + 8, x + 12, y + 8, strokeColor=INK))
        d.add(Line(x, y - 8, x - 9, y - 24, strokeColor=INK))
        d.add(Line(x, y - 8, x + 9, y - 24, strokeColor=INK))
        d.add(String(x, y - 38, fr(label), fontName=FONT_BOLD, fontSize=7.6, textAnchor="middle", fillColor=INK))

    # Cas d'utilisation du citoyen (colonne gauche), espaces pour loger les stereotypes.
    citizen_cases = [
        ("S'inscrire /\nse connecter", 186, 239),
        ("Gerer profil\net objectifs", 186, 187),
        ("Comparer options\nmultimodales", 186, 135),
        ("Programmer trajets\net routines", 186, 83),
        ("Suivre trajets faits\net historique", 186, 31),
    ]
    for label, cx, cy in citizen_cases:
        oval_label(d, cx, cy, 108, 30, label)

    # Cas d'utilisation des acteurs systeme et cas etendu (colonne droite).
    oval_label(d, 330, 239, 104, 30, "Publier flux\nGTFS / GBFS")
    oval_label(d, 330, 187, 104, 30, "Signaler\nincidents reseau")
    oval_label(d, 330, 96, 104, 30, "Suivre empreinte\ncarbone")
    oval_label(d, 330, 40, 104, 30, "Consulter\nindicateurs usage")

    # Associations acteur -> cas d'utilisation (trait plein, sans fleche).
    for cy in (239, 187, 135, 83, 31):
        d.add(Line(58, 176, 132, cy, strokeColor=MUTED))
    d.add(Line(444, 202, 382, 239, strokeColor=MUTED))
    d.add(Line(444, 202, 382, 190, strokeColor=MUTED))
    d.add(Line(444, 74, 382, 44, strokeColor=MUTED))
    d.add(Line(444, 74, 382, 182, strokeColor=MUTED))

    # Relations UML normalisees (trait pointille, fleche ouverte, stereotype).
    # <<include>> : programmer un trajet (date ou routine) reutilise obligatoirement une option comparee.
    dashed_stereotype_arrow(d, 186, 98, 186, 120, "<<include>>")
    # <<include>> : toute comparaison charge le profil de mobilite (scoring RG1/RG2/RG5).
    dashed_stereotype_arrow(d, 186, 150, 186, 172, "<<include>>")
    # <<extend>> : le suivi carbone etend le marquage "fait" d'un trajet (comportement optionnel).
    dashed_stereotype_arrow(d, 288, 84, 232, 42, "<<extend>>")
    return d


def combined_fragment(d: Drawing, x, y, w, h, operator: str, guard: str, divider_y: float | None = None, guard2: str = "") -> None:
    """Fragment combine UML : cadre, pastille d'operateur et conditions de garde."""
    d.add(Rect(x, y, w, h, fillColor=None, strokeColor=AMBER, strokeWidth=0.8))
    d.add(Rect(x, y + h - 12, 30, 12, fillColor=colors.HexColor("#fdf4e6"), strokeColor=AMBER, strokeWidth=0.8))
    d.add(String(x + 15, y + h - 8.5, operator, fontName=FONT_BOLD, fontSize=6, fillColor=AMBER, textAnchor="middle"))
    d.add(String(x + 36, y + h - 8.5, fr(guard), fontName=FONT_REGULAR, fontSize=5.8, fillColor=AMBER))
    if divider_y is not None:
        divider = Line(x, divider_y, x + w, divider_y, strokeColor=AMBER, strokeWidth=0.6)
        divider.strokeDashArray = [3, 2]
        d.add(divider)
        d.add(String(x + 4, divider_y + 3, fr(guard2), fontName=FONT_REGULAR, fontSize=5.8, fillColor=AMBER))


def sequence_diagram() -> Drawing:
    d = Drawing(500, 330)
    lifelines = [
        ("Citoyen", 40),
        ("PWA UrbanFlow", 143),
        ("RoutePlanner", 248),
        ("APIs externes", 353),
        ("CarbonTracker", 456),
    ]
    for label, x in lifelines:
        rect_label(d, x - 42, 292, 84, 22, label, fill=LIGHT, stroke=BLUE, size=6.8)
        lifeline = Line(x, 24, x, 292, strokeColor=LINE)
        lifeline.strokeDashArray = [4, 3]
        d.add(lifeline)

    # Barres d'activation (execution specification).
    activations = [
        (143, 40, 232),   # PWA : active de la saisie a l'affichage final
        (248, 150, 118),  # RoutePlanner : pendant la planification
        (353, 186, 52),   # APIs externes : pendant les appels reseau
        (456, 52, 40),    # CarbonTracker : pendant l'enregistrement
    ]
    for x, bottom, height in activations:
        d.add(Rect(x - 4, bottom, 8, height, fillColor=colors.HexColor("#dce9f6"), strokeColor=BLUE, strokeWidth=0.7))

    # Fragment alt : disponibilite des APIs externes (les 2 branches du paragraphe 7.1).
    combined_fragment(
        d, 196, 152, 232, 86, "alt", "[APIs disponibles]",
        divider_y=186, guard2="[timeout 8 s / erreur reseau]",
    )

    steps = [
        (40, 143, 272, "1. saisit depart / arrivee", False),
        (143, 248, 254, "2. planRoutes(profil, position)", False),
        (248, 353, 226, "3. GET geocodage + OSRM + GBFS", False),
        (353, 248, 204, "4. geometries, stations, delais", True),
        (248, 248, 168, "4'. fallback local + statut degrade", False),
        (248, 143, 140, "5. options scorees (duree, CO2, PMR)", True),
        (143, 40, 122, "6. cartes de trajets + carte", True),
        (40, 143, 100, "7. enregistre le trajet", False),
        (143, 456, 80, "8. createTripRecord(CO2 évité)", False),
        (456, 143, 58, "9. synthese hebdomadaire", True),
        (143, 40, 36, "10. progression objectif carbone", True),
    ]
    for x1, x2, y, label, dashed in steps:
        if x1 == x2:
            # Message reflexif (auto-appel) : le moteur bascule sur son fallback local.
            d.add(Line(x1 + 4, y, x1 + 26, y, strokeColor=BLUE, strokeWidth=1))
            d.add(Line(x1 + 26, y, x1 + 26, y - 10, strokeColor=BLUE, strokeWidth=1))
            arrow(d, x1 + 26, y - 10, x1 + 4, y - 10, BLUE)
            d.add(String(x1 + 32, y - 4, fr(label), fontName=FONT_REGULAR, fontSize=6.4, fillColor=INK))
            continue
        arrow(d, x1, y, x2, y, BLUE, dashed=dashed)
        d.add(String((x1 + x2) / 2, y + 5, fr(label), fontName=FONT_REGULAR, fontSize=6.6, fillColor=INK, textAnchor="middle"))
    return d


def communication_diagram() -> Drawing:
    d = Drawing(500, 262)
    # Objets UML : nomenclature ":Classe" (instances anonymes).
    nodes = {
        ":PWA": (26, 132, 104, 30),
        ":AuthService": (196, 216, 104, 28),
        ":RoutePlanner": (196, 132, 104, 30),
        ":TransportApi": (368, 190, 106, 28),
        ":ExternalApis": (368, 118, 106, 28),
        ":CarbonTracker": (196, 44, 104, 28),
        ":LocalStorage": (26, 44, 104, 28),
    }
    for label, (x, y, w, h) in nodes.items():
        rect_label(d, x, y, w, h, label, fill=colors.white, stroke=PINE, size=7.2)

    # Liens espaces pour eviter tout chevauchement de libelle.
    links = [
        ((104, 162), (214, 216), "1: login()", 0, 7),
        ((228, 216), (74, 72), "1.1: persistSession()", 34, 28),
        ((104, 148), (196, 148), "2: planRoutes()", 0, 7),
        ((300, 154), (368, 190), "2.1: loadNetwork()", 0, 7),
        ((300, 140), (368, 132), "2.2: routeGeometry()", 0, 7),
        ((78, 132), (232, 72), "3: saveTrip()", 0, 7),
        ((196, 58), (130, 58), "3.1: persistTrip()", 0, 7),
    ]
    for start, end, label, label_dx, label_dy in links:
        x1, y1 = start
        x2, y2 = end
        arrow(d, x1, y1, x2, y2, MUTED)
        d.add(String((x1 + x2) / 2 + label_dx, (y1 + y2) / 2 + label_dy, fr(label), fontName=FONT_BOLD, fontSize=6.6, fillColor=PINE_DARK, textAnchor="middle"))
    return d


def architecture_diagram() -> Drawing:
    d = Drawing(500, 265)
    d.add(Rect(10, 150, 225, 105, fillColor=colors.HexColor("#fbfaf5"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(122, 242, "Client PWA (livré)", fontName=FONT_BOLD, fontSize=8.6, fillColor=PINE_DARK, textAnchor="middle"))
    rect_label(d, 22, 208, 95, 24, "UI React 19", fill=LIGHT, size=7)
    rect_label(d, 128, 208, 95, 24, "Service worker", fill=LIGHT, size=7)
    rect_label(d, 22, 178, 95, 24, "RoutePlanner", fill=LIGHT, size=7)
    rect_label(d, 128, 178, 95, 24, "Auth locale (prototype)", fill=LIGHT, size=6.6)
    rect_label(d, 22, 156, 201, 18, "LocalStorage (profils, trajets, CO2)", fill=colors.white, size=6.6)

    d.add(Rect(265, 150, 225, 105, fillColor=colors.HexColor("#f4f8fb"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(377, 242, fr("APIs open data (reelles)"), fontName=FONT_BOLD, fontSize=8.6, fillColor=BLUE, textAnchor="middle"))
    rect_label(d, 277, 208, 95, 24, "api-adresse BAN", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 383, 208, 95, 24, "OSRM (OSM.de)", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 277, 178, 95, 24, "GBFS Velo'v v3", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 383, 178, 95, 24, "GBFS Dott v2.3", fill=colors.white, stroke=BLUE, size=6.6)
    rect_label(d, 277, 156, 95, 18, "GTFS TCL (ODbL)", fill=colors.white, stroke=BLUE, size=6.4)
    rect_label(d, 383, 156, 95, 18, "Open-Meteo", fill=colors.white, stroke=BLUE, size=6.4)

    arrow(d, 235, 200, 265, 200, BLUE)
    d.add(String(250, 205, "HTTPS", fontName=FONT_REGULAR, fontSize=6, fillColor=MUTED, textAnchor="middle"))

    d.add(Rect(10, 14, 480, 112, fillColor=colors.HexColor("#f7f6ef"), strokeColor=LINE, rx=6, ry=6))
    d.add(String(250, 112, fr("Architecture cible metropolitaine (evolution)"), fontName=FONT_BOLD, fontSize=8.6, fillColor=AMBER, textAnchor="middle"))
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
        ("S5 - F4", "Suivi carbone,\nobjectif hebdomadaire", LIGHT),
        ("S6 - Durcissement", "Tests, WCAG, RGPD,\ndossier + recette", CREAM),
    ]
    x = 6
    for title, detail, fill in sprints:
        d.add(Rect(x, 34, 76, 56, fillColor=fill, strokeColor=PINE, strokeWidth=1, rx=4, ry=4))
        d.add(String(x + 38, 74, fr(title), fontName=FONT_BOLD, fontSize=6.8, fillColor=PINE_DARK, textAnchor="middle"))
        for line_index, line in enumerate(detail.split("\n")):
            d.add(String(x + 38, 60 - line_index * 9, fr(line), fontName=FONT_REGULAR, fontSize=5.9, fillColor=INK, textAnchor="middle"))
        if x > 6:
            arrow(d, x - 7, 62, x + 1, 62, PINE)
        x += 83
    d.add(String(250, 14, fr("6 sprints d'une semaine - revue, retrospective et demonstration de conformite a chaque fin de sprint"), fontName=FONT_REGULAR, fontSize=7.0, fillColor=MUTED, textAnchor="middle"))
    return d


def sprint_zoom_diagram() -> Drawing:
    """Deroulement precis d'un cycle d'iteration d'une semaine (ceremonies, duree, livrable)."""
    d = Drawing(500, 150)
    days = [
        ("Lundi", "Sprint planning\n9h00 - 11h00", "Livrable :\nsprint backlog gele", LIGHT),
        ("Mardi", "Developpement\n+ daily 15 min", "Livrable :\nincrements pousses", colors.white),
        ("Mercredi", "Developpement\n+ daily 15 min", "Livrable :\nincrements pousses", colors.white),
        ("Jeudi", "Dev + revue de code\n+ daily 15 min", "Livrable :\nbranches fusionnees", colors.white),
        ("Vendredi AM", "Recette + demonstration\n9h00 - 11h00", "Livrable :\nincrement accepte sur criteres", LIGHT),
        ("Vendredi PM", "Retrospective\n14h00 - 15h00", "Livrable :\n1 action d'amelioration", CREAM),
    ]
    x = 4
    for day, activity, deliverable, fill in days:
        d.add(Rect(x, 30, 76, 100, fillColor=fill, strokeColor=PINE, strokeWidth=1, rx=4, ry=4))
        d.add(Rect(x, 112, 76, 18, fillColor=PINE, strokeColor=PINE, strokeWidth=1))
        d.add(String(x + 38, 118, fr(day), fontName=FONT_BOLD, fontSize=6.6, fillColor=colors.white, textAnchor="middle"))
        for line_index, line in enumerate(activity.split("\n")):
            d.add(String(x + 38, 100 - line_index * 9, fr(line), fontName=FONT_BOLD, fontSize=5.9, fillColor=INK, textAnchor="middle"))
        for line_index, line in enumerate(deliverable.split("\n")):
            d.add(String(x + 38, 70 - line_index * 8, fr(line), fontName=FONT_REGULAR, fontSize=5.4, fillColor=MUTED, textAnchor="middle"))
        if x > 4:
            arrow(d, x - 7, 80, x + 1, 80, PINE)
        x += 83
    d.add(String(250, 14, fr("Capacite : 32 h = 24 h de developpement + 4 h 15 de ceremonies + 3 h 45 de QA/documentation"), fontName=FONT_REGULAR, fontSize=6.8, fillColor=MUTED, textAnchor="middle"))
    return d


def bug_workflow_diagram() -> Drawing:
    d = Drawing(500, 74)
    steps = ["Detection\n(test, revue, user)", "Ticket qualifie\n(repro + criticite)", "Triage quotidien\n(bloqueur > majeur)", "Correctif +\ntest non-regression", "Revue de code\n+ CI verte", "Recette preprod\npuis deploiement"]
    x = 4
    for index, step in enumerate(steps):
        fill = LIGHT if index % 2 == 0 else colors.white
        d.add(Rect(x, 18, 74, 44, fillColor=fill, strokeColor=PINE, strokeWidth=1, rx=4, ry=4))
        for line_index, line in enumerate(step.split("\n")):
            d.add(String(x + 37, 44 - line_index * 10, fr(line), fontName=FONT_REGULAR, fontSize=6.1, fillColor=INK, textAnchor="middle"))
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
                ["APIs reelles", "GTFS TCL (ODbL), GBFS Velo'v v3, GBFS Dott, alertes trafic SIRI (data.grandlyon.com), OSRM, BAN, Photon, Open-Meteo."],
                ["Fonctionnalites", "F1 comptes + profils et objectifs, F2 planificateur multimodal (trajets programmes, routines) + geolocalisation, F3 integration transport, option suivi carbone."],
                ["Qualite", f"TypeScript strict, ESLint, {TEST_COUNT} tests unitaires Vitest, audit axe-core WCAG 2.1 A/AA sans violation sur {A11Y_SCREENS} ecrans, scenario E2E de planification bloquant et banc de performance scriptés ; RGPD par minimisation, limites documentees."],
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
        ("14.", "Sources, hypotheses et preparation aux criteres oraux"),
        ("15.", "Matrice d'evaluation et dossier de preuves"),
    ]
    rows = [[num, fr(title)] for num, title in entries]
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
            "Le point de depart, c'est l'email de Claire Henette pour une metropole d'environ 500 000 habitants engagee "
            "dans la transition ecologique. En le relisant plusieurs fois, j'y ai vu trois problemes de fond plutot qu'une "
            "liste de fonctionnalites : la <b>congestion</b> aux heures de pointe, la <b>pollution</b> liee a l'autosolisme, "
            "et surtout la <b>fragmentation</b> des services de transport. Aujourd'hui, chaque operateur (transport public, "
            "velos en libre-service, trottinettes, covoiturage) impose sa propre application, ses comptes et sa billettique, "
            "et c'est l'usager qui fait le travail d'assemblage.",
        ),
        p(
            "Ma reponse est une application web progressive (PWA) qui reunit au meme endroit la planification multimodale, "
            "la disponibilite temps reel des services partages et l'impact carbone de chaque deplacement. Je me suis impose "
            "une exigence des le depart : concevoir <b>mobile first</b>, parce qu'on utilise ce genre d'outil en marchant, "
            "en attendant un metro ou au guidon d'un velo, rarement assis devant un grand ecran.",
        ),
        p("1.1 Enjeux metiers et objectifs economiques", "h2"),
        p(
            "Pour ne pas tout traiter au meme niveau, j'ai classe les enjeux par priorite : <b>P1</b> pour ce qui justifie "
            "l'existence meme de la plateforme (traite dès le MVP), <b>P2</b> pour ce qui conditionne la conformite et "
            "l'adoption, <b>P3</b> pour la trajectoire economique a moyen terme. C'est ce classement qui a dicte l'ordre de "
            "mon backlog (section 5) et le perimetre que j'ai choisi de ne pas couvrir (section 2.3).",
        ),
        table(
            [
                ["Prio.", "Enjeu", "Objectif mesurable", "Retombee economique attendue"],
                ["<b>P1</b>", "Report modal vers les mobilites douces",
                 "+15 % de trajets velo/marche planifies via la plateforme a 12 mois",
                 "Valeur suivie par une baseline locale avant/apres : part modale planifiee, minutes gagnees et cout de service par usager actif. Aucune monetisation n'est affirmee sans donnees locales de trafic."],
                ["<b>P1</b>", "Baisse mesurable de l'empreinte carbone",
                 "CO2 évité affiché par trajet et cumule par citoyen (objectif hebdomadaire par defaut : 2 500 g)",
                 "Contribution chiffree aux objectifs climat ; facteurs d'emission a versionner depuis la Base Empreinte ADEME [S7], avec hypotheses visibles pour rendre le calcul auditable."],
                ["<b>P2</b>", "Inclusion et accessibilite",
                 "100 % des itineraires qualifies PMR compatible ou non (champ GTFS wheelchair_boarding)",
                 "Conception orientee WCAG 2.1 AA [S2] et normes transport : reduction du risque d'exclusion ; la conformite formelle exige un audit complet, non remplace par le lint."],
                ["<b>P2</b>", "Meilleure utilisation de l'infrastructure existante",
                 "Occupation affichee par trajet, report d'usage vers les lignes non saturees",
                 "Decalage d'investissements capacitaires : optimiser l'existant coute un ordre de grandeur moins cher qu'une extension de ligne."],
                ["<b>P3</b>", "Souverainete et maitrise des couts",
                 "Open data et standards ouverts (GTFS, GBFS) plutot que licences proprietaires",
                 "Cout de licence des jeux ouverts nul sous reserve de leur licence propre ; évite le verrouillage editeur. Tout prix MaaS doit etre confirme par devis avant decision d'achat."],
            ],
            widths=[26, 100, 130, CONTENT_WIDTH - 256],
        ),
        p("1.2 Economie du projet : couts de build et de run", "h2"),
        p(
            "Un mot d'honnetete avant les chiffres : les montants ci-dessous sont un <b>scenario budgetaire interne</b> que "
            "j'ai construit avec un TJM conventionnel de 450 EUR et 32 h par sprint (section 5.3), pas un devis de marché. "
            "J'ai prefere ajouter une analyse de sensibilite plutot que d'afficher une precision financiere que je ne peux "
            "pas garantir ; le chiffrage final appartient a la DSI de la metropole.",
        ),
        table(
            [
                ["Poste", "Hypothese", "Montant (ordre de grandeur)"],
                ["Build MVP (scenario central)", "6 sprints x 32 h = 192 h, soit 24 j.h a 450 EUR", "<b>10,8 k EUR</b>"],
                ["Sensibilite du build MVP", "Meme charge ; TJM teste de 350 a 600 EUR", "<b>8,4 a 14,4 k EUR</b>"],
                ["Build natif iOS + Android (hypothese)", "Facteur de charge interne +80 % sur UI/tests ; a valider par estimation detaillee", "~19,4 k EUR au TJM central"],
                ["Run annuel de la version livree", "Hebergement statique (PWA, aucune donnee personnelle serveur) + nom de domaine + APIs open data gratuites", "<b>~150 a 300 EUR/an</b>"],
                ["Run architecture cible (palier 2)", "API + PostgreSQL/PostGIS + cache + supervision ; volumetrie a mesurer", "Budget a chiffrer apres test de charge"],
                ["Solution MaaS en marque blanche", "Alternative fonctionnelle ; prix et clauses de donnees a consulter", "Devis fournisseur requis"],
            ],
            widths=[125, 170, CONTENT_WIDTH - 295],
        ),
        p(
            "Ce que j'en retire pour la decision : la PWA m'évite de developper et de maintenir deux applications natives "
            "en parallele. Je ne presente pas ce gain comme un fait de marché, il depend du perimetre, des competences et "
            "des devis reels. Mais meme si mes hypotheses bougent, l'arbitrage tient : une seule base de code, c'est moins "
            "de surface de test et de maintenance, et l'architecture en adaptateurs laisse la porte ouverte a une migration "
            "native ou serveur plus tard.",
        ),
        p("1.3 Besoins utilisateurs par persona", "h2"),
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
                 "Trajets ponctuels, budget serré",
                 "Trouver un velo ou une trottinette disponible tout de suite",
                 "Disponibilites GBFS temps reel Velo'v et Dott affichees sur la carte."],
                ["La metropole",
                 "Pilotage de la politique mobilite",
                 "Des indicateurs d'usage et un systeme interoperable",
                 "Standards GTFS/GBFS, architecture ouverte, suivi CO2 agregeable."],
            ],
            widths=[90, 105, 120, CONTENT_WIDTH - 315],
        ),
        p("1.4 Ce que le document engage", "h2"),
        p(
            "J'ai essaye de ne pas repondre uniquement au besoin immediat. Derriere chaque choix (architecture en "
            "adaptateurs, standards ouverts, modele de donnees type GTFS/GBFS, PWA installable), il y a une question que je "
            "me suis posee : que se passe-t-il quand un nouvel operateur arrive, quand il faudra une API metropolitaine, "
            "quand la charge ou la reglementation evoluera ? Les sections 4 et 8 detaillent ces trajectoires pour que la "
            "solution ne reste pas figee dans ses choix initiaux.",
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
                 "profil : modes preferes, marche max, priorite PMR, sensibilite pluie, budget CO2 et objectifs "
                 "hebdomadaires de trajets et de CO2 évité."],
                ["F2", "Planificateur d'itineraires multimodal avec geolocalisation temps reel",
                 "Moteur planRoutes : six options (a pied, velo partage, trottinette, transport en commun, combinaison "
                 "velo + transport en commun, covoiturage) comparees et scorees ; position GPS temps reel utilisable comme "
                 "point de depart (watchPosition, precision affichee) ; trajets programmables a une date ou en routines "
                 "recurrentes (aller-retour, pause/reprise) avec marquage fait/annule."],
                ["F3", "Integration d'APIs de transport (GTFS, velos/trottinettes partages)",
                 "GTFS statique reel TCL-SYTRAL (ODbL) integre au build ; GBFS v3 Velo'v et GBFS v2.3 Dott interroges en "
                 "direct dans le navigateur ; fallback local documente en cas de coupure reseau."],
                ["F4", "Fonctionnalite au choix : calculateur d'empreinte carbone avec suivi personnel",
                 "CO2 par trajet (facteurs g/km par mode), CO2 évité vs voiture individuelle, historique alimente par les "
                 "trajets marques faits, objectifs hebdomadaires et mensuels avec jauges de progression, suppression en un "
                 "clic (RGPD)."],
            ],
            widths=[34, 150, CONTENT_WIDTH - 184],
        ),
        p(
            "Pour s'y retrouver : <b>F1 a F3</b> sont les fonctionnalites obligatoires du sujet et <b>F4</b> la "
            "fonctionnalite au choix que j'ai retenue. Je garde ces identifiants tout au long du dossier (sections 7, 11, "
            "12 et 13) et dans la checklist du depot, pour qu'on puisse suivre chaque exigence jusqu'a sa preuve.",
        ),
        p("2.2 Exigences non fonctionnelles (contraintes C1 a C12)", "h2"),
        p(
            "J'ai integre les douze contraintes du sujet dans le backlog au meme titre que les fonctionnalites, plutot "
            "que de les traiter en fin de projet. La matrice de couverture complete est en section 12. Trois d'entre elles "
            "ont vraiment façonne la conception :",
        ),
        bullet("<b>C1 PWA / C10 performances</b> : l'application s'installe, le service worker garde en cache le shell et les fallbacks locaux (stale-while-revalidate), et une page hors-ligne prend le relais. Je n'annonce pas les flux tiers comme caches, ce serait faux ; en revanche chaque appel externe a un timeout de 8 s et un repli prevu."),
        bullet("<b>C2 responsive / UX mobile first</b> : j'ai conçu d'abord pour un smartphone tenu d'une main, avec la carte en plein ecran, une feuille de trajets glissable et les actions principales sous le pouce. La version bureau en decoule, sous forme de shell a trois colonnes."),
        bullet("<b>C7 accessibilite / C12 normes transport</b> : navigation clavier complete, libelles ARIA, contrastes AA, et surtout la qualification PMR de chaque itineraire a partir du champ GTFS wheelchair_boarding, parce qu'un badge d'accessibilite faux est pire que pas de badge."),
        p("2.3 Hors perimetre assume de cette version", "h2"),
        bullet("Reservation et paiement unifies : necessite des accords billettiques operateurs ; l'architecture cible (section 8) reserve l'emplacement d'un service dedie."),
        bullet("Covoiturage dynamique et gamification : demandent une masse critique d'utilisateurs simultanes et un backend de comptes centralises ; le mode covoiturage est deja present dans le moteur de scoring pour une activation future."),
        bullet("Guidage GPS pas-a-pas embarque : le produit assume un positionnement de pur planificateur (comparer, programmer, suivre ses objectifs) ; le guidage temps reel releve des applications de navigation dediees vers lesquelles un trajet peut etre exporte a terme."),
        p("2.4 Optimisation par IA : une phase 1 a base de regles, assumee", "h2"),
        p(
            "Le sujet evoque une IA d'optimisation des itineraires. J'ai choisi pour ce MVP un moteur de recommandation "
            "<b>a base de regles ponderees</b> (section 7.1) plutot qu'un modele appris, et ce n'est pas un renoncement "
            "par facilite. Voici mon raisonnement :",
        ),
        bullet("<b>Demarrage a froid</b> : un modele appris a besoin de donnees d'usage (trajets proposes, choisis, abandonnes), et au lancement il n'y en a aucune. Le moteur a regles produit justement ces donnees labellisees."),
        bullet("<b>Tension avec le RGPD</b> : personnaliser par apprentissage suppose de centraliser les donnees de deplacement, exactement ce que ma strategie de minimisation locale (C8, C11) s'interdit. J'ai tranche en faveur du RGPD."),
        bullet("<b>Explicabilite</b> : quand l'application ecarte une option pour une personne PMR, je peux montrer la regle (arret non accessible). Un score appris serait indefendable devant une collectivite garante d'un service universel."),
        bullet("<b>Trajectoire</b> : le scoring pondere est de toute facon la phase 1 de n'importe quel systeme de recommandation. Un re-ordonnancement appris sur les donnees collectees viendra au palier 2, une fois le backend et une base legale en place."),
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
                 "Infrastructure serveur Java a operer dès le jour 1 ; surdimensionne pour prouver les parcours en phase MVP."],
                ["Developpement sur mesure PWA + open data",
                 "Maitrise totale, standards ouverts, cout marginal faible, eco-conception possible.",
                 "Effort de developpement initial ; necessite une trajectoire claire vers une API pour passer a l'echelle."],
            ],
            widths=[105, 145, CONTENT_WIDTH - 250],
        ),
        p("3.1 bis Donnees comparatives chiffrées et sourcées", "h2"),
        p(
            "Pour objectiver le panorama, les criteres discriminants sont chiffrés a partir de sources publiques "
            f"vérifiables, datees de consultation au 18/07/2026. Les mesures locales sont extraites automatiquement du build livré du {BUILD_DATE}.",
        ),
        table(
            [
                ["Critere", "Solution proprietaire (reference Google)", "OTP auto-heberge", "PWA + open data (choix)"],
                ["Cout de licence / d'usage",
                 "Tarification publique a la requete : SKU Routes en categorie Pro, quota gratuit par SKU puis de l'ordre de 2 a 30 USD / 1 000 appels selon les options (grille révisée en mars 2025) [S10]. A 100 000 planifications/mois, l'ordre de grandeur se situe en centaines a milliers d'USD par mois.",
                 "Licence LGPL : 0 EUR de licence, mais un serveur Java a opérer en continu.",
                 "0 EUR de licence sur les jeux ouverts (sous reserve de leur licence propre, ex. ODbL pour le GTFS TCL)."],
                ["Infrastructure minimale",
                 "Aucune (SaaS), en contrepartie d'une dependance contractuelle et tarifaire.",
                 "JVM avec 1 Go de RAM pour un petit reseau, et de l'ordre de 10 Go et plus pour une couverture nationale, d'apres la documentation officielle [S11].",
                 "Hebergement statique au MVP (~150-300 EUR/an, hypothese H4) ; serveur reporté au palier 2."],
                ["Maitrise des donnees usagers",
                 "Donnees de deplacement traitees par un tiers, hors du controle de la collectivite.",
                 "Totale (auto-hebergement).",
                 "Comptes, profils et historiques restent dans le navigateur ; les APIs publiques appelees voient l'IP et des coordonnees ponctuelles, sans identifiant de compte (9.2)."],
                ["Cartographie",
                 "SDK proprietaire : chargements de carte facturés au volume selon la grille publique [S10].",
                 "Au choix de l'intégrateur.",
                 f"MapLibre GL, licence BSD-3, sans cle : {MAPLIBRE_KB} kB gzip mesurés, chargés a la demande apres l'ecran de connexion."],
                ["Delai de mise en oeuvre constaté",
                 "Integration SDK rapide, personnalisation politique publique limitée.",
                 "Graphe GTFS+OSM a construire et a opérer dès le jour 1.",
                 "MVP démontré en 6 sprints : parcours reels a l'appui (section 11)."],
            ],
            widths=[72, 145, 118, CONTENT_WIDTH - 335],
        ),
        p(
            "Le prix de la solution MaaS en marque blanche (type Moovit) n'est pas public : il releve du devis. Cette "
            "opacité tarifaire est elle-meme un critere de decision pour un acheteur public, qui doit pouvoir comparer et "
            "renégocier. Les chiffres ci-dessus ne remplacent pas une consultation formelle : ils bornent les ordres de "
            "grandeur et rendent l'arbitrage auditable.",
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
                 "Limitee sans backend : persistance locale, secrets operateurs cantonnes a un endpoint proxy du serveur."],
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
                 "Compatibilite verifiee avec MapLibre, Radix et shadcn/ui ; choix coherent avec les competences du projet. La perennite depend du suivi des versions, pas d'une garantie implicite."],
                ["Langage", "TypeScript, JavaScript", "TypeScript strict",
                 "Contrats de donnees transport types (GTFS/GBFS), erreurs detectees a la compilation, refactorings surs."],
                ["Cartographie", "MapLibre GL, Leaflet, Google Maps SDK", "MapLibre GL",
                 "Rendu WebGL, styles personnalisables, aucune cle proprietaire. La performance est mesuree par poids de bundle et parcours, sans promesse generique de 60 fps."],
                ["Build / outillage", "Vite 7, Webpack, Parcel", "Vite 7 + ESLint + Vitest",
                 "Demarrage instantane, bundle optimise, tests unitaires rapides integres au meme outillage."],
                ["Donnees transport", "Scraping, licences privees, open data GTFS/GBFS", "Open data + standards",
                 "GTFS [S4] et GBFS [S5] rendent les formats interoperables ; le droit de reutilisation reste determine par la licence de chaque jeu."],
            ],
            widths=[70, 118, 78, CONTENT_WIDTH - 266],
        ),
        p("3.4 Approches methodologiques comparees", "h2"),
        table(
            [
                ["Approche", "Forces", "Limites dans ce projet", "Decision"],
                ["Cycle en V", "Jalons et documentation previsibles", "Retour tardif sur les APIs instables ; cout eleve d'une hypothese invalide", "Ecarte pour le MVP"],
                ["Kanban", "Flux visible, peu de ceremonies, adaptation continue", "Cadence et objectif d'increment moins explicites pour six semaines", "Conserve comme tableau de suivi"],
                ["XP", "Tests, refactoring, integration continue, feedback technique", "Pair programming non applicable au projet individuel", "Pratiques techniques retenues"],
                ["Scrum adapte", "Sprints courts, revue, retrospective, objectif demonstrable", "Risque de ceremonies artificielles si les roles simules ne sont pas annonces", "Retenu avec sprints d'une semaine et roles analytiques"],
            ],
            widths=[82, 130, 160, CONTENT_WIDTH - 372],
        ),
        p(
            "Au final, je n'ai pas choisi une methode contre les autres, j'ai pioche. Scrum adapte me donne des sprints "
            "d'une semaine, ce qui limite a quelques jours le cout d'une hypothese fausse sur une API. Kanban m'apporte la "
            "visibilite quotidienne, et les pratiques XP (tests, integration continue, refactoring) securisent chaque "
            "increment. Je ne pretends pas avoir reproduit une equipe : les roles decrits plus loin sont des angles de "
            "responsabilite que j'ai portes seul.",
        ),
        Spacer(1, 10),
    ]


def section_4() -> list:
    return [
        p("4. Recommandation et arbitrages", "h1"),
        p("4.1 Recommandation", "h2"),
        p(
            "Ma recommandation tient en une phrase : <b>lancer le scenario B (PWA autonome) comme MVP, en s'interdisant "
            "tout choix qui bloquerait le scenario C (PWA + API modulaire), qui reste la cible</b>. Concretement, la PWA "
            "livree prouve les parcours critiques avec de vraies donnees open data, et j'ai isole toute la couche d'acces "
            "aux donnees dans des adaptateurs (transportApi, externalApis) dont la signature ne changera pas le jour ou "
            "les appels passeront par l'API metropolitaine.",
        ),
        p("4.2 Consequences explicites de chaque arbitrage", "h2"),
        table(
            [
                ["Arbitrage", "Cout", "Delais", "Performance", "Perennite"],
                ["PWA plutot que natif",
                 "1 seule base de code ; -44 % dans l'hypothese interne de charge, non presentee comme devis",
                 "MVP planifie en 6 sprints ; estimation native a confirmer",
                 "Rendu WebGL et parcours mesurés ; limites iOS a recetter sur les appareils cibles",
                 "Socle web standard ; wrapper natif possible, sous reserve de tester les APIs de plateforme."],
                ["Open data + standards plutot que licences",
                 "0 EUR de licence ; integration d'un nouvel operateur = 1 adaptateur",
                 "Aucune negociation commerciale bloquante au demarrage",
                 "Dependance aux SLA des services publics : mitigee par cache + fallback local",
                 "Le jeu TCL est annonce ODbL ; GBFS normalise le format mais chaque flux conserve sa licence propre [S5]."],
                ["Calcul d'itineraire client (MVP) puis service dedie (cible)",
                 "Pas de serveur a operer au lancement",
                 "Fonctionnel dès le sprint 3",
                 "Serveur OSRM communautaire de demonstration, sans SLA et non autorise pour un usage applicatif a volume : acceptable pour prouver les parcours, a remplacer dès le palier 2",
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
                ["Indisponibilite d'une API publique (OSRM, GBFS)", "<b>Elevee</b>", "<b>Fort</b> (100 % des fonctionnalites obligatoires en dependent)",
                 "Timeout 8 s sur chaque appel, degradation gracieuse : trace directe + fallback local, statut visible dans l'UI. Regle de DoD : aucune dependance externe sans repli teste."],
                ["Changement de schema d'un flux operateur", "Faible", "Moyen",
                 "Mappings isoles, tests unitaires sur la fusion GBFS et fallback. TypeScript seul ne valide pas un JSON recu a l'execution ; une validation runtime reste a ajouter."],
                ["Depreciation de l'API Adresse BAN", "Actee", "Moyen",
                 "L'API actuelle est isolee dans externalApis.ts ; migration planifiee vers le service de geocodage de la Geoplateforme, sans modifier l'UI [S8]."],
                ["Montee en charge au-dela du client seul", "Certaine a terme", "Fort",
                 "Trajectoire scenario C documentee (section 8) ; aucun couplage UI/donnees bloquant."],
                ["Indisponibilite du flux alertes TCL (SIRI, compte data.grandlyon.com)", "Possible", "Faible",
                 "Endpoint proxy avec cache memoire servi en cas d'erreur amont ; sans compte configure, repli sur des "
                 "incidents simules explicitement etiquetes dans l'interface."],
            ],
            widths=[140, 65, 70, CONTENT_WIDTH - 275],
        ),
        PageBreak(),
    ]


def section_5() -> list:
    return [
        p("5. Pilotage : methode, roles, outils, amelioration continue", "h1"),
        p("5.1 Approche iterative retenue : Scrum adapte", "h2"),
        p(
            "J'ai conduit le projet en <b>Scrum</b> avec des sprints d'une semaine, adaptes a un contexte individuel de "
            "certification : j'ai garde les ceremonies mais en les resserrant (le deroulement precis est au paragraphe "
            "5.2). Pourquoi un cycle aussi court ? Parce que mon principal risque etait la dependance a des APIs open data "
            "dont le comportement reel ne se decouvre qu'a l'usage. Avec une semaine par sprint, une mauvaise hypothese me "
            "coute au pire cinq jours. À côté, un kanban (A faire / En cours / En revue / Termine) me rend l'avancement "
            "visible en continu, et la checklist de tracabilite (5.4) relie chaque exigence du sujet a sa preuve.",
        ),
        sprint_timeline(),
        p("Figure 1 - Planification des 6 sprints du MVP, avec revue de conformite et retrospective a chaque iteration.", "caption"),
        KeepTogether([
            p("5.2 Deroulement precis d'un cycle d'iteration", "h2"),
            sprint_zoom_diagram(),
            p(
                "Figure 2 - Zoom sur un sprint type d'une semaine. Chaque ceremonie a une duree, un horaire et un livrable "
                "opposable : le sprint backlog est <b>gele</b> a l'issue du planning (toute demande arrivant en cours de sprint "
                "part au backlog produit, jamais dans l'iteration en cours) ; la demonstration du vendredi confronte "
                "l'increment aux criteres d'acceptation du sujet ; la retrospective doit produire au moins <b>une action "
                "d'amelioration datee et assignee</b>, reprise en tete du sprint suivant. Capacite analytique : <b>32 h</b> par "
                "sprint, soit 24 h de developpement, 4 h 15 de ceremonies et 3 h 45 de QA/documentation.",
                "caption",
            ),
        ]),
        p("5.3 Roles, responsabilites et charges (matrice RACI)", "h2"),
        p(
            "Sur ce projet, je cumule evidemment tous les roles. Je les distingue quand meme, parce qu'ils correspondent "
            "a des <b>moments de decision differents</b> (prioriser n'est pas coder, accepter n'est pas tester) et parce "
            "que la trajectoire cible (section 8.2) suppose une vraie equipe. La charge indiquee est une <b>ventilation "
            "analytique de mes 32 h hebdomadaires</b>, pas la somme de cinq personnes ; elle couvre developpement, "
            "ceremonies, QA et documentation. <b>R</b> = realise, <b>A</b> = approuve (responsable final), "
            "<b>C</b> = consulte, <b>I</b> = informe.",
        ),
        table(
            [
                ["Activite", "PO", "Tech Lead", "Dev front", "Dev data", "QA"],
                ["Priorisation du backlog", "<b>A/R</b>", "C", "I", "I", "C"],
                ["Choix d'architecture et arbitrages", "C", "<b>A/R</b>", "C", "C", "I"],
                ["Developpement UI / PWA / carte", "I", "A", "<b>R</b>", "C", "I"],
                ["Adaptateurs GTFS / GBFS / ingestion", "I", "A", "C", "<b>R</b>", "I"],
                ["Strategie de tests et recette", "C", "A", "C", "C", "<b>R</b>"],
                ["Acceptation sur criteres du sujet", "<b>A/R</b>", "C", "I", "I", "C"],
                ["Charge mesuree (h / sprint)", "3 h", "6 h", "12 h", "6 h", "5 h"],
            ],
            widths=[CONTENT_WIDTH - 200, 40, 40, 40, 40, 40],
        ),
        table(
            [
                ["Role", "Responsabilite dans l'approche", "Traduction sur ce projet individuel"],
                ["Product Owner (metropole)", "Priorise le backlog par valeur citoyenne, valide les demos, arbitre le perimetre.", "Role analytique simule : chaque increment est confronte au sujet officiel ; aucune validation d'un client reel n'est revendiquee."],
                ["Scrum Master", "Garantit la methode, leve les blocages, anime les retrospectives.", "Role analytique : checklist et journal de decisions ; actions de retrospective verifiees au sprint suivant."],
                ["Tech Lead / architecte", "Tranche les choix techniques, contient la dette, revoit le code.", "Decisions consignees en sections 3, 4 et 8 ; auto-revue structuree, historique Git et CI. Aucune revue par un pair n'est inventee."],
                ["Developpeur front / PWA", "Implemente UI, accessibilite, service worker, cartographie.", "Sprints 2, 3 et 5 (auth, carte, planificateur et routines, suivi carbone)."],
                ["Developpeur data / API", "Adaptateurs GTFS/GBFS, scripts d'ingestion, contrats de donnees.", "Sprint 4 (fetch_gtfs.py, transportApi.ts et ses tests)."],
                ["QA", "Strategie de tests, non-regression, recette de preproduction.", "Tests Vitest, scenario E2E de planification, verification terminale avant chaque livraison."],
            ],
            widths=[92, 168, CONTENT_WIDTH - 260],
        ),
        p("5.4 Environnement et outils de travail", "h2"),
        table(
            [
                ["Categorie", "Outils", "Role dans le cycle iteratif"],
                ["Developpement", "Node 26, Vite 7, TypeScript 5.8, React 19", "Boucle locale instantanee, typage strict des contrats de donnees."],
                ["Gestion de version", "Git (branche <i>main</i>), commits <b>Conventional Commits</b> (feat / fix / docs / chore) avec portee explicite",
                 "Historique lisible et decoupe par increment fonctionnel : chaque commit correspond a un element du backlog ou a un correctif trace (section 10.3)."],
                ["Integration continue", "GitHub Actions (<i>.github/workflows/ci.yml</i>) : lint + tests + build, puis audit axe-core et scenario E2E bloquants sur le build servi, sur chaque push et pull request vers main",
                 "Verrou automatique : un increment ne peut etre fusionne si l'un de ces controles echoue. Localement, la meme chaine est rejouee par <i>npm run check</i> et les scripts d'audit."],
                ["Suivi du backlog", "Backlog et tracabilite exigence &rarr; preuve tenus dans <i>CHECKLIST.md</i> versionne ; kanban (A faire / En cours / En revue / Termine) pour l'avancement",
                 "L'etat d'avancement est revu a chaque daily ; la checklist conditionne la definition of done et sert de support a la recette."],
                ["Qualite", "ESLint (react-hooks, jsx-a11y), Vitest + jsdom, Playwright (E2E planification, audit axe-core, banc de performance)", f"Lint bloquant et {TEST_COUNT} tests unitaires executes avant tout build ; parcours de planification, audit WCAG et mesures de charge rejouables a la demande et rejoues en CI (npm run e2e / audit:a11y / bench:perf)."],
                ["UI / design", "Tailwind CSS 4, shadcn/ui, MapLibre GL, Bricolage Grotesque / Figtree", "Systeme de design tokenise (oklch), composants accessibles."],
                ["Donnees", "python3 stdlib (fetch_gtfs.py), APIs open data", "Ingestion GTFS reproductible au build, flux GBFS live au runtime."],
                ["Livraison", "npm run check (lint + test + build)", "Une commande unique valide l'ensemble avant livraison."],
            ],
            widths=[70, 150, CONTENT_WIDTH - 220],
        ),
        p("5.5 Demarche d'amelioration continue : DMAIC applique", "h2"),
        table(
            [
                ["Phase", "Application concrete sur UrbanFlow"],
                ["Define", "Irritant cible par sprint, ex. sprint 4 : les donnees transport simulees ne prouvent pas l'interoperabilite reelle. "],
                ["Measure", "Indicateurs objectifs : nombre de tests verts, temps de build, poids du bundle, nombre d'arrets/stations reels charges, avertissements lint."],
                ["Analyze", "Analyse de cause : le blocage venait du format GTFS (zip CSV volumineux) inadapte a un client web."],
                ["Improve", "Solution : ingestion au build (600 arrets TCL reels sur toute la metropole) + GBFS interroge en direct ; verification par captures et tests."],
                ["Control", "Verrouillage : tests unitaires sur la fusion GBFS, npm run check bloquant, statut des sources visible dans l'UI."],
            ],
            widths=[58, CONTENT_WIDTH - 58],
        ),
        p(
            "Dans l'esprit Kaizen, je me suis impose que chaque retrospective produise au moins un ajustement applique "
            "des le sprint suivant. Quelques exemples vecus : j'ai reduit la taille des marqueurs de la carte apres avoir "
            "constate la surcharge visuelle avec les donnees reelles, ajoute un message de statut des sources apres m'etre "
            "moi-meme demande si je regardais du live ou du simule, et remplace un select natif par un composant "
            "accessible. Les frictions restantes et leur traitement sont en section 10.",
        ),
        Spacer(1, 10),
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
        scaled(use_case_diagram(), 0.92),
        p(
            "Figure 2 - Le citoyen accede a cinq cas d'utilisation apres authentification. Trois relations normalisees "
            "structurent le modele : <b>&lt;&lt;include&gt;&gt;</b> de « Programmer trajets et routines » vers « Comparer options "
            "multimodales » (programmer un trajet - a une date ou en routine recurrente - reutilise obligatoirement une option "
            "comparee) ; <b>&lt;&lt;include&gt;&gt;</b> de « Comparer options multimodales » vers « Gerer profil et objectifs » "
            "(toute comparaison charge les preferences qui alimentent le scoring, RG1/RG2/RG5) ; <b>&lt;&lt;extend&gt;&gt;</b> de "
            "« Suivre empreinte carbone » vers « Suivre trajets faits et historique » (le marquage fait est volontaire, donc un "
            "comportement optionnel qui etend le cas de base). L'operateur de mobilite alimente le systeme en flux GTFS/GBFS et "
            "signale les incidents (alertes SIRI) ; la metropole administre et consulte les indicateurs d'usage.",
            "caption",
        ),
        KeepTogether([
            p("6.2 Diagramme de sequence : planifier puis enregistrer un trajet", "h2"),
            scaled(sequence_diagram(), 0.86),
            p(
                "Figure 3 - Sequence du parcours cle. Fleches pleines : appels ; pointillees : retours ; rectangles bleus sur les "
                "lignes de vie : barres d'activation (execution specification). Le moteur RoutePlanner croise le profil et la "
                "position (2), puis interroge les APIs externes. Le <b>fragment combine alt</b> formalise les deux branches "
                "specifiees au paragraphe 7.1 : si les APIs repondent, les geometries OSRM et disponibilites GBFS alimentent le "
                "scoring (3-4) ; en cas de timeout de 8 s ou d'erreur reseau, le moteur bascule par auto-appel sur son fallback "
                "local et remonte un statut degrade (4'). Les options scorees sont ensuite affichees (5-6). L'enregistrement "
                "volontaire (7-8) declenche le calcul du CO2 évité et la mise a jour de l'objectif hebdomadaire (9-10).",
                "caption",
            ),
        ]),
        PageBreak(),
        p("6.3 Diagramme de communication", "h2"),
        communication_diagram(),
        p(
            "Figure 4 - Collaboration entre objets (notation « :Classe » pour les instances), numerotee selon l'ordre "
            "hierarchique des messages. <b>1</b> : la PWA delegue l'authentification a :AuthService, qui derive le mot de passe "
            "et persiste la session dans :LocalStorage (<b>1.1</b>). <b>2</b> : la planification appelle :RoutePlanner, qui obtient "
            "le reseau aupres de :TransportApi (<b>2.1</b> : GTFS TCL, GBFS Velo'v/Dott, meteo) et les geometries aupres "
            "d':ExternalApis (<b>2.2</b> : OSRM, BAN). <b>3</b> : l'enregistrement d'un trajet passe par :CarbonTracker, qui "
            "persiste l'historique minimal (<b>3.1</b>). La numerotation hierarchique (2, puis 2.1 et 2.2) exprime "
            "l'imbrication des appels, la ou le diagramme de sequence exprime leur chronologie. Ce decoupage en services a "
            "responsabilite unique est la cle de la maintenabilite : chaque adaptateur est remplacable par un appel a l'API "
            "cible sans toucher les autres objets.",
            "caption",
        ),
        p("6.4 Nomenclature : table de correspondance", "h2"),
        p(
            "La nomenclature repose sur trois conventions explicites. <b>(1)</b> Les entites de donnees conservent "
            "<b>strictement</b> le nom et la casse des standards GTFS et GBFS (<i>snake_case</i> : stop_id, "
            "wheelchair_boarding, num_vehicles_available) : aucune traduction, aucun renommage, ce qui garantit "
            "l'interoperabilite (C9) et rend le mapping verifiable ligne a ligne face aux specifications officielles. "
            "<b>(2)</b> Les types et les objets sont en <i>PascalCase</i>, les modules et les fonctions en <i>camelCase</i>. "
            "<b>(3)</b> Un concept metier porte <b>un seul nom</b> du dossier au code, en passant par les diagrammes. La table "
            "ci-dessous est la reference opposable de cette correspondance.",
        ),
        table(
            [
                ["Concept metier", "Type / objet TypeScript", "Objet dans les diagrammes", "Fichier source"],
                ["Point geographique", "GeoPoint", "—", "src/types.ts"],
                ["Profil de mobilite", "MobilityProfile", "Gerer profil de mobilite (Fig. 2)", "src/types.ts"],
                ["Arret de transport public", "GtfsStop (stop_id, wheelchair_boarding)", "Publier flux GTFS / GBFS (Fig. 2)", "src/types.ts"],
                ["Station de mobilite partagee", "SharedStation", "Publier flux GTFS / GBFS (Fig. 2)", "src/types.ts"],
                ["Option d'itineraire proposee", "RouteOption (+ RouteLeg, RouteInstruction)", "message 5 (Fig. 3)", "src/types.ts"],
                ["Trajet enregistre", "TripRecord", "message 8 (Fig. 3)", "src/types.ts"],
                ["Service d'authentification", "AuthService", ":AuthService (Fig. 4)", "src/lib/auth.ts"],
                ["Moteur d'itineraires", "RoutePlanner (fonction planRoutes)", ":RoutePlanner (Fig. 3 et 4)", "src/lib/routePlanner.ts"],
                ["Adaptateur transport", "TransportApi (loadTransportNetwork)", ":TransportApi (Fig. 4)", "src/lib/transportApi.ts"],
                ["Adaptateur APIs externes", "ExternalApis (searchPlaces, enhanceRoutes...)", ":ExternalApis (Fig. 4)", "src/lib/externalApis.ts"],
                ["Trajet programme / routine", "PlannedTrip, RecurringTrip (plannedTrips.ts)", "Programmer trajets et routines (Fig. 2)", "src/lib/plannedTrips.ts"],
                ["Suivi carbone", "CarbonTracker (saveTripRecord, summarizeCarbon)", ":CarbonTracker (Fig. 3 et 4)", "src/lib/carbon.ts"],
            ],
            widths=[95, 130, 105, CONTENT_WIDTH - 330],
        ),
        p(
            "Lecture : un service est designe par son nom conceptuel (RoutePlanner) dans le dossier et les diagrammes, et par "
            "son module (routePlanner.ts) quand le propos porte sur le fichier — la relation entre les deux est donnee par "
            "cette table, sans ambiguite possible. Les identifiants fonctionnels <b>F1 a F4</b> (section 2.1) et les regles de "
            "gestion <b>RG1 a RG5</b> (section 7.1) completent cette nomenclature et sont utilises sans variante dans tout le "
            "document.",
        ),
        Spacer(1, 10),
    ]


def section_7() -> list:
    return [
        p("7. Specifications de la fonctionnalite cle", "h1"),
        p(
            "J'ai choisi de specifier en detail <b>le planificateur d'itineraires multimodal avec geolocalisation temps "
            "reel</b> (F2). C'est le coeur de la proposition de valeur, et c'est la que tout converge : le profil (F1) "
            "alimente le scoring, les donnees transport (F3) alimentent les options, et le suivi carbone (F4) en decoule.",
        ),
        p("7.1 Specification fonctionnelle", "h2"),
        table(
            [
                ["Rubrique", "Specification"],
                ["Declencheur", "L'utilisateur definit un depart (recherche d'adresse, point d'interet, ou position GPS) et une destination."],
                ["Entrees", "Depart, arrivee (GeoPoint), profil de mobilite : modes preferes, marche maximale (min), priorite PMR, sensibilite pluie ; reseau transport (arrets GTFS, stations GBFS, incidents, meteo)."],
                ["Regles de gestion", "RG1 : seuls les modes actives par l'utilisateur produisent des options. RG2 : si priorite PMR, tout segment transport public doit partir et arriver a un arret wheelchair_boarding=1, sinon l'option est marquee non accessible (et si aucun arret accessible n'est a proximite, l'option n'est pas proposee). RG3 : un segment velo/trottinette n'est propose que si une station avec au moins 1 vehicule disponible (GBFS live) est a moins de 400 m ; sinon l'option est ecartee. RG4 : en cas de pluie signalee et sensibilite activee, les options concernees portent un avertissement et voient leur score penalise. RG5 : au-dela de la marche maximale du profil, un avertissement est ajoute et le score penalise d'un point par minute excedentaire (le curseur de marche du profil agit donc directement sur le classement)."],
                ["Scoring", "Modele additif a penalites, borne sur 0-100. On part de la fiabilite de l'option, on ajoute un bonus par mode prefere (+8 chacun), puis on retranche : la duree (x0,85 par minute), le carbone (/55), une penalite d'inaccessibilite sur profil PMR (-45), et les avertissements (-6 chacun, dont le depassement de marche RG5). Les six coefficients sont regroupes dans une constante SCORING_WEIGHTS en tete de routePlanner.ts et couverts par un test unitaire."],
                ["Sorties", "Jusqu'a 6 options RouteOption ordonnees : titre, resume, segments detailles (from/to, distance, duree, CO2), avertissements, score, badge PMR, geometrie affichable et instructions pas-a-pas."],
                ["Geolocalisation", "Position temps reel utilisable comme point de depart (« Ma position ») : premiere acquisition getCurrentPosition puis suivi watchPosition (haute precision, timeout 10 s) qui maintient le repere sur la carte, precision affichee dans la barre de statut ; hors metropole, bandeau explicite d'offre reduite."],
                ["Etats d'erreur", "Permission GPS refusee : saisie manuelle du depart via la recherche, statut affiché. API de routage indisponible : trace directe locale avec statut degradé affiché. Flux GBFS indisponible : fallback local date et signale. Aucune option possible : message explicite et suggestions de modes a activer."],
            ],
            widths=[78, CONTENT_WIDTH - 78],
        ),
        PageBreak(),
        p("7.2 Specification technique", "h2"),
        table(
            [
                ["Composant", "Contrat et implementation"],
                ["Types de domaine (types.ts)", "GeoPoint, MobilityProfile, GtfsFeed, SharedMobilityFeed, RouteOption, RouteLeg, RouteInstruction, TripRecord : contrats TypeScript stricts partages par toute l'application, alignes sur les champs GTFS/GBFS officiels."],
                ["Moteur (routePlanner.ts)", f"Fonctions pures sans effet de bord : haversineDistanceKm, generation d'options par mode, scoring a penalites. Testable unitairement ({PLANNER_TEST_COUNT} tests couvrant le scoring et les cinq regles RG1 a RG5), deterministe, independant du DOM : migrable tel quel cote serveur."],
                ["Adaptateur transport (transportApi.ts)", "loadTransportNetwork() : GTFS local genere depuis le zip officiel TCL + fusion GBFS live : mergeVelovStations (station_information x station_status, GBFS v3) et mapDottVehicles (free_bike_status, v2.3) ; timeout 8 s et fallback local ; source de chaque flux exposee a l'UI."],
                ["APIs externes (externalApis.ts)", "searchPlaces : fusion BAN (api-adresse, adresses et rues) + Photon/OSM (quartiers, gares, lieux), resultats types et bornes a la metropole (departement 69 + bbox), debounce 220 ms et AbortController ; enhanceRoutesWithLiveRouting : OSRM profils foot/bike/driving, geometries GeoJSON, instructions traduites en francais, recalcul duree/CO2/score."],
                ["Ingestion GTFS (fetch_gtfs.py)", "Telecharge le GTFS officiel TCL (ODbL, ~43 Mo), filtre metro/tram/funiculaire et 600 arrets dans un rayon de 16 km (toute la metropole), genere public/data/gtfs-feed.json ; cache 24 h, stdlib uniquement, reproductible (npm run generate:gtfs)."],
                ["Rendu carte (UrbanMap.tsx)", "MapLibre GL, sources GeoJSON reactives (traces, arrets, stations, incidents, position), mise a jour differentielle sans recreation de carte, ajustement de vue automatique sur le trajet selectionne."],
                ["Performances", f"Debounce des recherches, annulation des requetes obsoletes, timeout reseau de 8 s, plafonds (600 arrets, 500 stations, 300 trottinettes). Build du {BUILD_DATE} : entree JS {ENTRY_KB} kB gzip ; MapLibre {MAPLIBRE_KB} kB gzip charge a la demande. Banc local reproductible ({PERF_RUNS} chargements a froid, Chromium) : premier rendu médian {FCP_MED} ms, p95 {FCP_P95} ms. Le service worker cache le shell et les fallbacks locaux, pas les reponses CORS tierces."],
            ],
            widths=[105, CONTENT_WIDTH - 105],
        ),
        p("7.3 Limites assumees du MVP heuristique", "h2"),
        p(
            "Je prefere nommer moi-meme les limites de mon moteur plutot que de laisser un lecteur les decouvrir. Elles "
            "ne remettent pas en cause les parcours, mais elles disent honnetement jusqu'ou vont les resultats, et elles "
            "dessinent en creux le service d'itineraires cible (section 8.2).",
        ),
        table(
            [
                ["Limite assumee", "Raison", "Levee prevue (palier 2)"],
                ["Pas de graphe horaire GTFS", "stop_times.txt represente des centaines de milliers de lignes, incompatibles avec un traitement cote navigateur.", "Service d'itineraires serveur (OTP ou RAPTOR sur PostGIS) chargeant les horaires reels."],
                ["Desserte approchee par frequence", "Sans horaires, on ne sait pas quelle ligne dessert quel arret : on retient un mode (metro/tram) sans afficher de numero de ligne, jamais garanti.", "Correspondances calculees sur la desserte reelle."],
                ["Geometrie transit via profil OSRM voirie", "OSRM ne route pas le transport public ; le profil voirie approche la geometrie entre deux arrets (plus realiste que la ligne droite).", "Traces issus des shapes.txt du GTFS."],
                ["Delais et occupation derives", "Les alertes trafic SIRI (SX) sont integrees en temps reel, mais sans GTFS-RT complet (Estimated Timetables), frequence et occupation restent estimees.", "Branchement SIRI ET/VM (prochains passages, positions vehicules) via le meme compte data.grandlyon.com."],
            ],
            widths=[110, CONTENT_WIDTH - 280, 170],
        ),
        p("7.4 Criteres d'acceptation verifies", "h2"),
        bullet(f"Un trajet Bellecour vers Part-Dieu produit six options multimodales scorees (je le montre en section 11). Mon banc local ({PERF_RUNS} repetitions, cache froid) mesure un premier rendu médian de {FCP_MED} ms (p95 {FCP_P95} ms) ; il faudra rejouer la meme campagne sur un vrai telephone et un reseau 4G avant de s'engager sur un seuil."),
        bullet("Le CO2 est ventile par leg : une option velo + transport public affiche une empreinte inferieure a une option 100 % transport public sur la meme distance (verifie section 11.2 sur le trajet Bellecour vers Part-Dieu)."),
        bullet("Le profil PMR ne propose que des correspondances accessibles et l'affiche explicitement ; les cinq regles de gestion RG1 a RG5 sont couvertes par des tests unitaires (filtrage des modes, arrets accessibles, station a 400 m, pluie, marche maximale)."),
        bullet("La coupure du reseau apres chargement initial laisse l'application utilisable : shell servi par le service worker, fallback transport local signale."),
        bullet("Le parcours complet de planification (recherche, options, programmation datee, marquage fait, statistiques mises a jour) est couvert par le scenario E2E que je peux rejouer a la demande (npm run e2e)."),
        Spacer(1, 10),
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
        bullet("<b>Separation des responsabilites</b> : j'ai decoupe l'interface en modules fonctionnels (auth, planification, trajets programmes, carbone, profil, tutoriel, layout) orchestrés par MobilityMapApp, avec App.tsx ramené a un simple shell. Les services metier (routePlanner, plannedTrips, carbon), les adaptateurs de donnees (transportApi, externalApis) et la securite (auth) vivent a part : je ne mets aucune logique metier dans les composants d'affichage."),
        bullet("<b>Contrats de donnees standards</b> : les types GTFS/GBFS reprennent les champs utiles des references [S4-S5]. Un nouvel operateur conforme passe par un adaptateur ; la validation runtime complete des schemas reste un verrou du palier 2."),
        bullet("<b>Degradation gracieuse systematique</b> : je me suis fixe la regle qu'aucune dependance externe n'existe sans comportement de repli (fallback local, trace directe, incidents simules etiquetes) ni statut visible. L'application ne doit jamais avoir d'etat mort."),
        bullet(f"<b>Mobile first et eco-conception</b> : bundle d'entree mesuré a {ENTRY_KB} kB gzip sur le build courant, carte chargee a la demande, polices auto-hebergees, donnees plafonnees, cache offline et zero tracker. Ces indicateurs montrent une vraie reduction des transferts initiaux ; je ne pretends pas pour autant avoir fait un bilan environnemental complet."),
        p("8.2 Evolutivite : trajectoire en trois paliers", "h2"),
        table(
            [
                ["Palier", "Declencheur", "Evolution", "Ce qui ne change pas"],
                ["1. MVP livré", "Preuve des parcours", "PWA + open data directs", "-"],
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
        bullet("TypeScript strict detecte les incoherences internes a la compilation ; il ne valide pas les JSON externes a l'execution. Les adaptateurs, tests de mapping et fallbacks bornent ce risque ; une validation de schema runtime est planifiee au palier 2."),
        bullet(f"J'ai concentre mes {TEST_COUNT} tests unitaires sur les fonctions ou une regression ferait le plus mal : scoring et regles RG1 a RG5, trajets programmes et routines recurrentes, mapping des alertes TCL (SIRI), authentification PBKDF2, effacement RGPD, carbone, fusion GBFS, fallbacks reseau, adaptateurs BAN/OSRM mockés. La campagne Vitest complete tient en moins de 2 secondes et tourne a chaque build."),
        bullet("Interface modulaire : le plus grand module UI (l'orchestrateur MobilityMapApp) reste sous les 600 lignes ; chaque domaine fonctionnel est un module indépendant, remplaçable et révisable isolément."),
        bullet("ESLint avec regles react-hooks et jsx-a11y bloquantes : les regressions d'accessibilite sont traitees comme des erreurs de build."),
        bullet("Enfin, une commande unique de verification (npm run check) et des scripts reproductibles (generate:gtfs, screens) : n'importe quel contributeur, moi compris dans six mois, reconstruit l'ensemble a l'identique."),
        Spacer(1, 10),
    ]


def section_9() -> list:
    return [
        p("9. Securite (OWASP) et protection des donnees (RGPD)", "h1"),
        p("9.1 Couverture raisonnee de l'OWASP Top 10:2025 [S1]", "h2"),
        p(
            "Je prefere etre clair sur le statut de l'authentification : la version livree est un demonstrateur autonome "
            "sans backend. La session locale prouve F1, mais je ne pretends pas qu'elle constitue une frontiere "
            "d'autorisation pour un service public. C'est pourquoi le tableau distingue ce que j'ai reellement mis en "
            "place de ce qui devra exister dans l'architecture metropolitaine.",
        ),
        table(
            [
                ["Risque OWASP", "Mesure appliquee dans la version livree", "Complement en architecture cible"],
                ["A01 Broken Access Control", "Session locale et purge des donnees pour le prototype ; aucune autorisation serveur n'est revendiquee.", "Controle d'acces par ressource, politique deny-by-default et tests d'autorisation."],
                ["A02 Security Misconfiguration", "Configuration TypeScript stricte, secrets de build hors depot, .env ignoré et flux runtime publics.", "CSP, en-tetes de securite, configuration durcie et verifiee par environnement."],
                ["A03 Software Supply Chain", "package-lock versionne, npm ci en CI et versions bornees.", "Audit de dependances, SBOM et politique de mise a jour documentee."],
                ["A04 Cryptographic Failures", "PBKDF2-SHA-256 avec sel évite le mot de passe en clair, mais 120 000 iterations restent un choix de demonstration inferieur au repere OWASP actuel [S6].", "Authentification OIDC ; Argon2id serveur ou PBKDF2-HMAC-SHA256 calibre, stockage protege."],
                ["A05 Injection", "Pas d'evaluation dynamique ; React echappe le rendu ; URLs construites par URLSearchParams.", "Validation de schema, requetes parametrees et tests d'entrees hostiles."],
                ["A06 Insecure Design", "Minimisation locale, architecture par adaptateurs, limites et modes de repli documentes.", "Threat model formel, exigences d'abus et revue de conception avant palier 2."],
                ["A07 Authentication Failures", "Erreurs generiques et mot de passe minimum 12 caracteres ; authentification locale explicitement bornee au prototype.", "MFA administrateur, rate limiting, rotation et revocation de session."],
                ["A08 Software/Data Integrity", "Lint, tests et build bloquants ; historique Git par increment.", "Artefacts signes, protections de branche et verification d'integrite des feeds."],
                ["A09 Logging and Alerting", "Statuts explicites dans l'UI pour GPS, routage et sources de donnees.", "Logs structures sans coordonnees brutes, SLO, alertes et journal d'audit."],
                ["A10 Exceptional Conditions", "Timeout 8 s, AbortController, fallbacks etiquetes et absence d'etat mort.", "Circuit breakers, budgets de retries et tests de chaos sur les dependances."],
            ],
            widths=[105, 184, CONTENT_WIDTH - 289],
        ),
        p("9.2 RGPD : donnees de geolocalisation et minimisation", "h2"),
        table(
            [
                ["Principe", "Application concrete"],
                ["Consentement prealable", "La geolocalisation n'est jamais activee sans action explicite ; refus = mode manuel etiquete, sans perte de fonctionnalite de planification."],
                ["Minimisation", "Seuls sont conserves les agregats utiles au suivi carbone (mode, distance, CO2, date) : jamais de trace GPS brute persistee."],
                ["Localite des donnees", "Dans cette version, profils et historiques restent dans le navigateur de l'usager : aucune transmission a un serveur UrbanFlow."],
                ["Droit a l'effacement", "Suppression de l'historique en un clic ; la suppression de compte purge par balayage toutes les clés locales de l'utilisateur (profil, trajets programmes et routines, itineraires sauvegardés, historique carbone, session), comportement verifié par test unitaire."],
                ["Transparence", "La provenance de chaque flux (live ou simule) et l'usage de la position sont affiches dans l'interface."],
            ],
            widths=[92, CONTENT_WIDTH - 92],
        ),
        p(
            "Un point auquel je tiens : les appels aux APIs publiques (BAN, Photon, OSRM, GBFS, Open-Meteo) passent en "
            "HTTPS et ne portent aucun identifiant de compte UrbanFlow, mais ils ne sont <b>pas anonymes</b> pour autant. "
            "Les tiers voient l'adresse IP et, pour le geocodage, le routage ou la meteo, des lieux ponctuels. La notice "
            "de transparence devra donc nommer ces destinataires, finalites et durees, et un proxy metropolitain reste la "
            "cible [S3]. J'ai d'ailleurs deja applique ce principe pour le flux d'alertes TCL : les identifiants du compte "
            "data.grandlyon.com restent cote serveur (endpoint /api/tcl-alertes avec cache) et n'atteignent jamais le "
            "navigateur.",
        ),
        Spacer(1, 10),
    ]


def section_10() -> list:
    return [
        p("10. Qualite logicielle, tests et traitement des bogues", "h1"),
        p("10.1 Strategie de tests deployee", "h2"),
        table(
            [
                ["Niveau", "Outillage", "Perimetre couvert"],
                [f"Tests unitaires ({TEST_COUNT}, {TEST_FILES} fichiers)", "Vitest + jsdom", "Moteur d'itineraires (scoring, regles RG1 a RG5), trajets programmes (occurrences recurrentes, pause, annulation idempotente, agregats hebdo/mensuels), authentification (PBKDF2, sel, messages generiques, bornes de profil, effacement RGPD), calcul carbone (facteurs, objectif, plafonds, corruption localStorage), fusion GBFS (Velo'v v3, Dott, plafonds), alertes TCL (mapping SIRI, severites, expiration), fallbacks de loadTransportNetwork, geocodage BAN + Photon avec reseau mocké, classification meteo."],
                ["Analyse statique", "TypeScript strict + ESLint (react-hooks, jsx-a11y)", "Contrats de donnees, regles des hooks, accessibilite des composants : bloquant en build."],
                ["Audit accessibilite automatisé", "axe-core injecté par Playwright sur le build de production (npm run audit:a11y)", f"{A11Y_SCREENS} ecrans audités (authentification, carte/planification, hub planificateur, profil), regles WCAG 2.1 A et AA : {A11Y_VIOLATIONS} violation au {A11Y_DATE}. Ne remplace pas l'audit manuel clavier + lecteur d'ecran (protocole en 14.2)."],
                ["Test de bout en bout (E2E)", "Playwright + Chromium, geolocalisation simulée (npm run e2e)", "Parcours complet de planification sur build de production et APIs reelles, verrouille par 5 assertions bloquantes (echec du script si l'une echoue) : options calculees, dialog de programmation, hub ouvert avec occurrence a venir, marquage fait, statistiques incrementees."],
                ["Banc de performance", "Navigation Timing / Paint Timing, 10 chargements a froid (npm run bench:perf)", f"Premier rendu médian {FCP_MED} ms (p95 {FCP_P95} ms), ~{TRANSFER_KB} kB transférés sur build local : protocole a rejouer sur appareil et reseau cibles."],
                ["Tests manuels structures", "Scenarios de recette par sprint", "Parcours complets mobile et desktop : auth, planification, routines recurrentes, objectifs, offline, PMR, suppression RGPD."],
                ["Verification de bout en bout", "npm run check + captures automatisees (Playwright)", f"Lint + {TEST_COUNT} tests + build production ; les ecrans de la section 11 sont generes par script, donc reproductibles."],
            ],
            widths=[92, 118, CONTENT_WIDTH - 210],
        ),
        p("10.2 Processus de traitement des bogues", "h2"),
        bug_workflow_diagram(),
        p("Figure 6 - Cycle de vie d'un bogue, de la detection a la recette en preproduction.", "caption"),
        bullet("<b>Qualification</b> : chaque ticket contient environnement, etapes de reproduction, resultat attendu/observe, capture et criticite (bloqueur / majeur / mineur)."),
        bullet("<b>Regle de non-regression</b> : pour tout bogue sur une fonction pure (scoring, carbone, fusion de flux), j'ecris d'abord le test unitaire qui le reproduit, puis le correctif. Comme ca, le bogue ne peut pas revenir sans que je le sache."),
        bullet("<b>Preproduction</b> : recette sur donnees figees (GTFS cache, GBFS fallback) pour etre deterministe, smoke tests PWA (installation, offline, permissions GPS refusees), audit contrastes et navigation clavier."),
        bullet("<b>Criteres de sortie</b> : zero bloqueur, les majeurs restants explicitement acceptes cote produit, npm run check vert et checklist de deploiement signee."),
        p("10.3 Exemples reels traites pendant la production", "h2"),
        table(
            [
                ["Bogue constate", "Cause racine", "Correctif et verrouillage"],
                ["Ecrans perimes et HMR casse en developpement malgre les correctifs livres",
                 "Service worker PWA enregistre aussi en dev : strategie cache-first servant d'anciens modules",
                 "Enregistrement limité a la production, desinscription et purge du cache en dev ; verrouille par revue de configuration."],
                ["Carte illisible apres branchement des donnees reelles (300+ marqueurs)",
                 "Rayon de marqueur fixe calibre pour quelques arrets simules, pas pour 600 arrets + 500 stations reels",
                 "Rayons interpoles par niveau de zoom et contrastes de couleur renforces par couche ; controle visuel par capture avant/apres."],
                ["Erreurs lint 'process is not defined' apres ajout du script de captures",
                 "Script Node analyse avec l'environnement navigateur par defaut d'ESLint",
                 "Perimetre lint explicite (ignore du script outillage) : le check global reste bloquant."],
                ["Onglets Connexion/Inscription non conformes ARIA (violation critique aria-required-children relevée par l'audit axe-core)",
                 "Conteneur déclaré role=tablist sans enfants role=tab : structure invalide pour les technologies d'assistance, non détectable par le lint statique",
                 "Attributs role=tab et aria-selected ajoutés ; l'audit axe-core scripté (0 violation) verrouille la non-regression."],
            ],
            widths=[140, 140, CONTENT_WIDTH - 280],
        ),
        PageBreak(),
    ]


def section_11() -> list:
    return [
        p("11. Realisation : parcours applicatifs commentes", "h1"),
        p(
            "Plutot que de decrire l'application, je prefere la montrer. Les captures suivantes sont prises par script "
            "(Playwright + Chromium) sur l'application en fonctionnement reel, connectee aux flux publics : n'importe qui "
            "peut les regenerer a l'identique depuis le depot.",
        ),
        p("11.1 Authentification et identite visuelle", "h2"),
        screenshot("01-auth-desktop-crop.png", 152,
                   "Ecran d'authentification (desktop) : identite 'eco-urbaine' (vert pin, creme, accent lime, Bricolage Grotesque), "
                   "connexion et inscription sans aucun champ pre-rempli. Mot de passe derive PBKDF2 avant tout stockage."),
        screenshot_pair("02-auth-mobile.png", "07-hub-mobile.png", 45,
                        "A gauche : authentification mobile (mobile first, cibles tactiles genereuses). A droite : hub planificateur "
                        "mobile : statistiques, objectifs hebdomadaires et mensuels avec progression, occurrences a venir a marquer "
                        "faites ou a annuler."),
        PageBreak(),
        p("11.2 Planification multimodale sur donnees reelles", "h2"),
        screenshot("03-planner-desktop.png", 168,
                   "Planificateur (desktop) : trajet Place Bellecour vers la gare Part-Dieu. Six options multimodales scorees "
                   "(velo + transport en commun, transport en commun, velo, trottinette, a pied, covoiturage), segments detailles : "
                   "approche velo vers une station Velo'v reelle (disponibilites GBFS live), correspondance vers un arret GTFS TCL "
                   "(mode affiche sans numero de ligne, non garanti par le MVP, cf. section 7.3), CO2 ventile par segment, badge PMR "
                   "et alertes trafic TCL temps reel affichees sur l'option concernee."),
        screenshot("06-planner-mobile.png", 54,
                   "Meme parcours en mobile first : carte plein ecran, GPS utilisable comme point de depart (precision affichee), "
                   "feuille d'options glissable qui n'apparait qu'une fois depart et arrivee choisis, actions Planifier et Enregistrer."),
        PageBreak(),
        p("11.3 Planificateur, objectifs et profil de mobilite", "h2"),
        screenshot("04-planificateur-desktop.png", 168,
                   "Hub planificateur (desktop) : routine 'Aller-retour travail' creee (jours ouvres, aller 08:30 / retour 18:00), "
                   "occurrences materialisees sur 7 jours glissants, premier trajet marque fait qui alimente les objectifs "
                   "hebdomadaires et mensuels (barres de progression) ainsi que le suivi carbone. En arriere-plan : une alerte "
                   "trafic TCL temps reel (SIRI, data.grandlyon.com) remontee sur l'option transport en commun."),
        screenshot("05-profile-desktop.png", 148,
                   "Profil et preferences : modes favoris, marche maximale, budget carbone hebdomadaire, priorite PMR, relance du "
                   "tutoriel, deconnexion et suppression de compte. Ces preferences alimentent directement le scoring (RG1, RG2, RG5)."),
        PageBreak(),
    ]


def section_12() -> list:
    return [
        p("12. Couverture des contraintes C1 a C12", "h1"),
        table(
            [
                ["ID", "Contrainte", "Preuve concrete dans le projet"],
                ["C1", "PWA installable", "manifest.webmanifest (standalone, icones 192/512, theme-color aligne), sw.js en stale-while-revalidate + page offline, installable Chrome/Android et iOS."],
                ["C2", "Responsive / UX", "Mobile first : carte plein ecran + bottom sheet ; desktop : shell 3 colonnes ; memes parcours, zero fonctionnalite perdue selon le support."],
                ["C3", "Normes et standards", "TypeScript strict, ESLint bloquant, standards GTFS/GBFS/GeoJSON, composants shadcn/Radix accessibles, conventions de nommage univoques."],
                ["C4", "Securite OWASP", "Cartographie complete OWASP Top 10:2025, mesures livrees et controles cibles distingues. Auth locale explicitement limitee au demonstrateur (section 9.1)."],
                ["C5", "Eco-conception", f"Bundle decoupe (entree {ENTRY_KB} kB gzip, carte a la demande), source maps desactivees en production, polices auto-hebergees, plafonds de donnees, cache offline, aucune ressource tierce superflue (pas de trackers)."],
                ["C6", "Geolocalisation fiable", "Position temps reel (getCurrentPosition puis watchPosition haute precision), precision affichee en metres, repere carte maintenu a jour, bandeau hors-metropole, fallback manuel via la recherche."],
                ["C7", "Accessibilite (cible WCAG 2.1 AA)", f"Navigation clavier, focus visible, libelles ARIA, jsx-a11y bloquant, filtrage PMR (RG2) et audit axe-core automatisé sans violation A/AA sur {A11Y_SCREENS} ecrans (10.1). L'audit manuel clavier + lecteur d'ecran reste requis pour la conformite complete ; protocole formalise en section 14.2 [S2]."],
                ["C8", "RGPD", "Consentement geolocalisation, minimisation (pas de trace GPS persistee), donnees locales, effacement historique et compte (section 9.2)."],
                ["C9", "Interoperabilite", "Champs GTFS/GBFS officiels dans les types, adaptateurs par operateur, GTFS TCL reel + GBFS Velo'v/Dott reels + alertes SIRI SX TCL integres sans modification du moteur."],
                ["C10", "Performances / connectivite variable", f"Service worker, fallback local des flux, debounce et annulation des requetes, timeouts 8 s, etats de chargement et statuts visibles ; banc de charge local reproductible (premier rendu médian {FCP_MED} ms, p95 {FCP_P95} ms, 10.1)."],
                ["C11", "Securite des donnees de deplacement", "Aucune trace GPS brute persistee ni serveur UrbanFlow. Les tiers recoivent IP et coordonnees ponctuelles : transparence requise et proxy cible documentes (section 9.2) [S3]."],
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
                ["Tests unitaires", "npm run test", f"{TEST_FILES} fichiers, {TEST_COUNT}/{TEST_COUNT} tests verts ; rejoués par la CI a chaque push."],
                ["Build production", "npm run build", f"Build du {BUILD_DATE} : entree JS {ENTRY_KB} kB gzip, MapLibre differe {MAPLIBRE_KB} kB gzip (mesure par scripts/build-metrics.mjs)."],
                ["Audit accessibilite", "npm run audit:a11y", f"{A11Y_DATE} : axe-core WCAG 2.1 A/AA sur {A11Y_SCREENS} ecrans du build de production, {A11Y_VIOLATIONS} violation."],
                ["Scenario E2E planification", "npm run e2e", f"{E2E_DATE} : parcours de planification complet sur APIs reelles, {E2E_STATUS} (options, programmation, hub, marquage fait, statistiques)."],
                ["Banc de performance", "npm run bench:perf", f"{PERF_DATE} : {PERF_RUNS} chargements a froid, premier rendu médian {FCP_MED} ms, p95 {FCP_P95} ms (protocole local documente)."],
                ["Chaine complete", "npm run check", "Lint + tests + build en une commande, bloquante avant toute livraison."],
                ["Donnees reelles", "npm run generate:gtfs", "600 arrets et 14 lignes TCL reels (toute la metropole) regeneres depuis le GTFS officiel (ODbL)."],
            ],
            widths=[85, 118, CONTENT_WIDTH - 203],
        ),
        p("13.2 Bilan au regard du besoin", "h2"),
        p(
            "Au moment de conclure, je crois pouvoir dire que la version livree couvre le perimetre impose : F1, F2, F3 "
            "et F4 se demontrent sur des parcours complets, alimentes par des donnees reelles partout ou elles sont "
            "accessibles (GTFS statique TCL, alertes trafic SIRI via le compte data.grandlyon.com, disponibilites GBFS "
            "Velo'v et Dott, geometries OSRM, geocodage BAN + Photon, meteo Open-Meteo), dans une PWA installable, mobile "
            "first, concue vers WCAG 2.1 AA et econome en donnees personnelles. Je maintiens ce bilan dans les limites que "
            "j'ai documentees en section 7.3 : la partie transport public reste heuristique (pas de graphe horaire), "
            "certains delais sont encore estimés (pas de SIRI Estimated Timetables branché), et les alertes simulées ne "
            "servent plus que de repli quand aucun compte operateur n'est configure. Surtout, aucun choix d'architecture "
            "n'hypotheque la suite : la trajectoire vers l'API metropolitaine est ecrite et les contrats de donnees sont "
            "stables.",
        ),
        p("13.3 Perspectives", "h2"),
        bullet("Etendre l'integration SIRI aux prochains passages et aux positions des vehicules (Estimated Timetables / Vehicle Monitoring) : le compte data.grandlyon.com que j'utilise deja pour les alertes ouvre ces flux."),
        bullet("Migrer l'API Adresse depreciee vers le service de geocodage de la Geoplateforme, l'adaptateur isolant ce changement [S8]."),
        bullet("Deployer l'API metropolitaine (palier 2) : comptes centralises, historique multi-appareils, notifications push."),
        bullet("Ajouter une validation runtime des schemas externes et des tests de contrat : TypeScript me protege a la compilation, pas contre un JSON inattendu recu a l'execution."),
        bullet("Ouvrir la reservation unifiee et le covoiturage dynamique (palier 3), puis mesurer le report modal reel via les indicateurs agreges anonymises."),
        bullet("Etendre les preuves : tests de composants React, audit manuel clavier/lecteur d'ecran complétant l'audit axe-core deja vert (et rejoué en CI a chaque push), et campagne de performance rejouée sur appareil mobile et reseau 4G documentes."),
        Spacer(1, 14),
        table(
            [
                ["UrbanFlow Mobility - synthese"],
                ["Une plateforme de mobilite urbaine sobre et interoperable : je l'ai concue mobile first, construite sur "
                 "les standards ouverts du transport, verifiee par des preuves que chacun peut rejouer, et pensee pour "
                 "grandir avec la metropole."],
            ],
            widths=[CONTENT_WIDTH],
            header=True,
            zebra=False,
        ),
    ]


def section_14() -> list:
    return [
        PageBreak(),
        p("14. Sources, hypotheses et preparation aux criteres oraux", "h1"),
        p("14.1 References officielles consultees", "h2"),
        p(
            "J'ai date toutes mes references au jour de consultation (18/07/2026). Elles etayent les standards que "
            "j'utilise et les limites que je reconnais ; je ne m'en sers pas pour transformer une preuve de conception en "
            "certification automatique.",
        ),
        table(
            [
                ["Ref.", "Objet", "Source officielle"],
                ["S1", "Risques applicatifs", "OWASP Top 10:2025 - https://owasp.org/Top10/2025/"],
                ["S2", "Accessibilite", "W3C, WCAG 2.1 - https://www.w3.org/TR/WCAG21/"],
                ["S3", "Geolocalisation et tiers", "CNIL - https://www.cnil.fr/fr/geolocalisation-applications-mobiles-quelles-regles"],
                ["S4", "Format transport public", "GTFS officiel - https://gtfs.org/documentation/overview/"],
                ["S5", "Format mobilite partagee et licences", "GBFS Reference - https://gbfs.org/documentation/reference/"],
                ["S6", "Stockage des mots de passe", "OWASP Password Storage Cheat Sheet - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"],
                ["S7", "Facteurs d'emission", "ADEME Base Empreinte - https://base-empreinte.ademe.fr/"],
                ["S8", "Geocodage", "Documentation API Adresse - https://adresse.data.gouv.fr/outils/api-doc/adresse (API annoncee depreciee)"],
                ["S9", "Exigences de certification", "Sujet UrbanFlow Mobility et grille T6 CDSD, session septembre 2026, fichiers officiels fournis."],
                ["S10", "Tarification des APIs cartographiques propriétaires", "Google Maps Platform, grille publique (catégories Essentials/Pro/Enterprise, mars 2025) - https://developers.google.com/maps/billing-and-pricing/pricing"],
                ["S11", "Exigences d'exploitation OpenTripPlanner", "OTP2, System Requirements - https://docs.opentripplanner.org/en/latest/System-Requirements/"],
                ["S12", "Moteur d'audit accessibilité", "axe-core (Deque Systems), règles WCAG - https://github.com/dequelabs/axe-core"],
            ],
            widths=[34, 125, CONTENT_WIDTH - 159],
        ),
        p("14.2 Registre des preuves et protocole de mesure", "h2"),
        table(
            [
                ["Theme", "Preuve disponible", "Condition pour une revendication formelle"],
                ["Accessibilite", f"jsx-a11y sans erreur, audit axe-core WCAG 2.1 A/AA exécuté sur {A11Y_SCREENS} ecrans du build de production : {A11Y_VIOLATIONS} violation (npm run audit:a11y) [S12] ; focus visible, ARIA, parcours clavier et regle PMR.", "Completer par l'audit manuel de tous les etats : clavier + lecteur d'ecran + contrastes sur cas reels ; journal des ecarts WCAG 2.1 AA [S2]."],
                ["Performance", f"Build mesuré : {ENTRY_KB} kB gzip initial ; MapLibre differe {MAPLIBRE_KB} kB gzip. Banc exécuté : {PERF_RUNS} chargements a froid sur build local, premier rendu médian {FCP_MED} ms, p95 {FCP_P95} ms (npm run bench:perf).", "Rejouer le protocole sur appareil mobile, navigateur et profil reseau 4G nommes ; publier mediane, p95, erreurs et cache chaud/froid."],
                ["Carbone", "Calcul par mode et ventilation par segment, tests unitaires.", "Versionner facteur, unite, date et source ADEME ; afficher l'hypothese de reference voiture [S7]."],
                ["Economie", "Charge analytique 192 h et sensibilite de TJM 350-600 EUR.", "Remplacer les hypotheses par devis et couts d'infrastructure apres test de charge."],
                ["Donnees externes", "Sources et versions exposees dans l'UI, fallbacks locaux.", "Tracer licence, date de collecte, schema attendu, SLO et destinataires de donnees pour chaque flux."],
            ],
            widths=[78, 175, CONTENT_WIDTH - 253],
        ),
        PageBreak(),
        p("14.3 Simulation C2.3 : perte des services critiques avant lancement", "h2"),
        p(
            "<b>Le scenario que je me suis pose.</b> Sept jours avant le pilote citoyen, le serveur OSRM communautaire "
            "refuse l'usage applicatif et l'API Adresse depreciee devient instable. F2, le coeur de la valeur, est menacee. "
            "Pour y repondre, je combine les 5 pourquoi (cause racine), une matrice impact/probabilite et une ideation "
            "contrainte par le delai.",
        ),
        table(
            [
                ["Attendu de la grille", "Reponse defendable a l'oral"],
                ["Sources reelles du probleme", "Dependances publiques sans SLA, appels directs navigateur, absence de service de routage contractuel et migration BAN non encore executee. La cause n'est pas l'UI mais le choix d'exploitation du MVP."],
                ["Impact sur la survie", "F2 ne peut plus garantir geocodage ni geometrie ; F1, GTFS local, profils, suivi carbone et architecture d'adaptateurs restent recuperables. Risques : pilote reporte, confiance client et objectifs de mobilite non mesurés."],
                ["Actions a court terme (0-48 h)", "Geler la livraison, activer le trace direct et la saisie manuelle avec statut degrade, desactiver toute promesse temps reel non tenue, informer le commanditaire, conserver F1/F3/F4 et executer la recette hors ligne."],
                ["Actions a moyen terme (2-6 semaines)", "Remplacer BAN par l'adaptateur Geoplateforme ; deployer ou contracter un moteur de routage avec SLO ; ajouter validation runtime, circuit breaker, supervision et test de bascule automatise."],
                ["Arbitrage et gains preserves", "Ne pas reecrire l'UI ni le moteur de scoring : seuls externalApis et l'URL d'adaptateur changent. Relancer le pilote lorsque le parcours critique, le fallback et les seuils p95 sont prouves sur l'environnement cible."],
            ],
            widths=[145, CONTENT_WIDTH - 145],
        ),
        p(
            "Ce qui me semble important dans cette reponse : elle preserve ce qui a deja ete construit, elle traite "
            "d'abord la continuite de service, et elle transforme un incident en exigences d'exploitation mesurables. "
            "Elle couvre les quatre attendus du critere C2.3 : source, impact, court terme et moyen terme.",
        ),
    ]


def section_15() -> list:
    return [
        PageBreak(),
        p("15. Matrice d'evaluation et dossier de preuves", "h1"),
        p(
            "Cette annexe relie chaque critere du dossier ecrit a une preuve localisable. Je rappelle l'echelle de la "
            "grille (<b>non satisfait = 0 %, partiellement satisfait = 50 %, satisfait = 100 %</b>) pour faciliter la "
            "lecture, mais je ne me note pas moi-meme : pour chaque critere, je propose une preuve et je laisse au jury "
            "l'attribution du niveau. Les criteres qui se jouent a l'oral, en simulation ou en revue de code sont prepares "
            "en 15.5.",
        ),
        p("15.1 Matrice des criteres evaluables sur le dossier ecrit", "h2"),
        table(
            [
                ["Critere de la grille", "Preuve directement verifiable", "Position"],
                ["C1.1 - Hierarchiser objectifs, besoins, enjeux metiers et objectifs economiques",
                 "Sections 1.1 a 1.4 : priorites P1/P2/P3, objectifs mesurables, retombees economiques, personas et besoins non fonctionnels.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C1.1 - Integrer les evolutions probables sans figer la solution",
                 "Sections 1.4, 4.1, 8.2 et 13.3 : architecture en adaptateurs et trajectoire MVP, API metropolitaine, services operateurs.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C1.2 - Etat de l'art et recommandations technologiques et methodologiques",
                 "Sections 3.1 a 3.4 : solutions du marché avec donnees comparatives chiffrées et sourcées (3.1 bis, [S10-S11]), quatre scenarios d'architecture, briques logicielles et Scrum/Kanban/XP compares.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C1.2 - Consequences des arbitrages : cout, delai, performance et perennite",
                 "Sections 1.2, 3.2, 4.2, 4.3 et 15.4 : sensibilite budgetaire, matrice d'arbitrage, risques et portes de decision.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C1.3 - Nomenclatures univoques et homogenes",
                 "Sections 2.1, 6.4 et 7.1 : identifiants F1-F4, RG1-RG5 et table concept metier, type TypeScript, objet UML, fichier.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C1.3 - Specifications structurees, lisibles et appuyees par des representations graphiques",
                 "Sections 6 et 7 : cas d'utilisation, sequence avec fragment alt, communication numerotee, specifications fonctionnelles et techniques.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C1.3 - Evolutivite au coeur des choix architecturaux",
                 "Sections 4.1 et 8 : separation UI/metier/adaptateurs, contrats stables et trois paliers d'evolution avec declencheurs.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C2.1 - Regles et contraintes issues des standards et bonnes pratiques",
                 "Sections 2.2, 5.4, 9, 10 et 12 : TypeScript strict, ESLint, GTFS/GBFS, OWASP, RGPD, WCAG et definition of done.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C2.1 - Outils et processus coherents avec l'approche methodologique",
                 "Sections 5.1, 5.4 et 5.5 : Scrum adapte, kanban, pratiques XP, CI, tests, livraison et boucle DMAIC.",
                 "<b>Preuve proposée<br/>au jury</b>"],
                ["C2.1 - Etapes, ressources, regles, cycle d'iteration et roles expliques aux parties prenantes",
                 "Sections 5.2 et 5.3 : sprint type heure par heure, livrables, capacite 32 h, matrice RACI et traduction des roles en contexte individuel.",
                 "<b>Preuve proposée<br/>au jury</b>"],
            ],
            widths=[170, CONTENT_WIDTH - 242, 72],
        ),
        p(
            "<b>Ce que cette matrice dit, et ce qu'elle ne dit pas :</b> chacun des 10 criteres evaluables sur l'ecrit a "
            "une preuve localisable, citee dans la colonne centrale et verifiable dans le depot ou dans ce document. "
            "L'appreciation elle-meme, sur l'echelle de la grille, appartient au jury et aux epreuves en face-a-face.",
        ),
        PageBreak(),
        p("15.2 Artefacts de pilotage datés et versionnés", "h2"),
        p(
            "Le journal ci-dessous vient de mon historique Git. Chaque identifiant court permet de retrouver le diff, la "
            "motivation et les fichiers touches par l'increment : c'est ma memoire de projet, telle quelle.",
        ),
        table(
            [
                ["Commit", "Increment / decision", "Ce qu'on peut y verifier"],
                ["63a2129", "Socle Vite, React et TypeScript", "Configuration stricte, lint et build : point de depart reproductible."],
                ["1a21f5d", "Application UrbanFlow complete", "F1-F4, architecture UI/services et premier parcours de bout en bout."],
                ["7dcf047", "Etat d'arrivee mobile et premier scenario E2E", "Increment issu d'une friction de parcours ; test rejouable par npm run e2e."],
                ["742f613", "Secret GTFS sorti du code", "Decision de securite : variable GTFS_SOURCE_URL, .env ignoré, feed versionné."],
                ["0107bd3", "Scoring centralise, RG3/RG5 et CO2 par segment", "Correctifs metier accompagnes de tests unitaires de non-regression."],
                ["7568701", "MapLibre chargé a la demande", "Arbitrage performance : la carte est isolee dans un chunk differe, hors du chemin critique initial."],
                ["e23cd97", "Pipeline CI lint, tests et build", "Workflow .github/workflows/ci.yml exécuté sur push et pull request vers main."],
                ["025b4d7", "Durcissement du dossier apres revue croisee", "Alignement grille, RACI, economie, UML et limites explicites."],
                ["15679a0", "Pivot planificateur metropole (trajets programmes, routines, objectifs, SIRI live)", "Increment majeur : hub planificateur, alertes TCL temps reel via proxy, e2e planification 5 assertions."],
            ],
            widths=[62, 165, CONTENT_WIDTH - 227],
        ),
        p(
            "Pour verifier par vous-memes : <i>CHECKLIST.md</i> (exigence vers preuve), <i>.github/workflows/ci.yml</i> "
            "(verrou qualite), les tests <i>src/lib/*.test.ts</i>, les scripts de generation et les captures "
            "reproductibles dans <i>output/screens/</i>. Et une regle que je me suis fixee : je ne revendique aucune "
            "validation d'un client ou d'un pair qui n'a pas eu lieu.",
        ),
        p("15.3 Proces-verbal de verification terminale", "h2"),
        table(
            [
                [f"Execution locale du {BUILD_DATE}", "Resultat factuel", "Preuve / seuil de sortie"],
                ["npm run lint", "Code de sortie 0, aucune erreur ESLint", "react-hooks et jsx-a11y inclus ; controle bloquant."],
                ["npm run test", f"{TEST_FILES} fichiers, {TEST_COUNT}/{TEST_COUNT} tests verts", "Scoring et RG1 a RG5, trajets programmes et routines, alertes TCL (SIRI), authentification PBKDF2, effacement RGPD, carbone, GBFS, fallbacks, BAN/Photon/OSRM et meteo."],
                ["npm run build", f"Build du {BUILD_DATE} sans avertissement", f"TypeScript valide ; entree {ENTRY_KB} kB gzip, carte differee {MAPLIBRE_KB} kB gzip."],
                ["npm run audit:a11y", f"{A11Y_VIOLATIONS} violation WCAG 2.1 A/AA (axe-core, {A11Y_SCREENS} ecrans)", "Une violation critique relevée par ce meme audit est corrigée et tracée en 10.3."],
                ["npm run e2e", "Parcours de planification complet, 5/5 assertions", "Scenario Playwright sur build de production et APIs reelles : options, programmation, hub, marquage fait, statistiques."],
                ["npm run bench:perf", f"Premier rendu médian {FCP_MED} ms, p95 {FCP_P95} ms ({PERF_RUNS} essais a froid)", "Protocole local documente ; a rejouer sur appareil et reseau cibles avant tout engagement de seuil."],
                ["npm run check", "Chaine complete terminee avec code 0", "Lint, tests puis build executes sequentiellement ; echec de l'un bloque la livraison."],
                ["Controle de tracabilite", "Checklist projet integralement renseignee", "Chaque exigence F1-F4 et C1-C12 renvoie vers un fichier ou une section du dossier."],
            ],
            widths=[118, 155, CONTENT_WIDTH - 273],
        ),
        PageBreak(),
        p("15.4 Registre des hypotheses financieres et portes de decision", "h2"),
        p(
            "Je le redis ici : mes valeurs budgetaires ne sont pas des prix de marché. Ce registre precise sur quoi "
            "chaque hypothese repose, jusqu'ou elle est valable, et surtout quelle action la transformerait en engagement "
            "opposable.",
        ),
        table(
            [
                ["ID", "Hypothese et calcul", "Validite / sensibilite", "Validation avant engagement"],
                ["H1", "Charge MVP : 6 sprints x 32 h = 192 h = 24 j.h", "Plan de charge analytique du candidat ; derive de +/- 20 % suivie par sprint.", "Re-estimer le reste a faire a chaque revue et journaliser tout ecart superieur a 10 %."],
                ["H2", "TJM central 450 EUR ; fourchette 350-600 EUR", "Convention interne de comparaison, jamais un devis fournisseur.", "Obtenir le taux DSI et au moins deux estimations comparables avant arbitrage d'achat."],
                ["H3", "MVP PWA : 10,8 k EUR ; sensibilite 8,4-14,4 k EUR", "Decision robuste tant que la charge et le TJM restent dans H1/H2.", "Repasser en comite si le plafond 14,4 k EUR ou six semaines est depasse."],
                ["H4", "Run statique : 150-300 EUR/an", "Ordre de grandeur pour hebergement sans backend ni donnee personnelle serveur.", "Comparer trois offres, inclure domaine, sauvegarde, trafic, support et localisation avant commande."],
                ["H5", "Natif iOS + Android : facteur de charge interne +80 %", "Scenario de sensibilite, pas un fait de marché ni une economie acquise.", "Faire estimer le meme backlog par une equipe mobile ; conserver la PWA si le surcout et le delai restent superieurs."],
            ],
            widths=[28, 145, 132, CONTENT_WIDTH - 305],
        ),
        table(
            [
                ["Porte", "Conditions cumulatives de passage", "Decision si une condition echoue"],
                ["G0 - MVP", "F1-F4 acceptés, npm run check vert, budget dans H3, aucun bloqueur ouvert.", "Corriger ou reduire le perimetre optionnel ; ne pas masquer l'ecart."],
                ["G1 - Pilote citoyen", "Test de charge et p95 mesurés, trois offres d'infrastructure, flux critiques avec SLO ou fallback accepté, analyse RGPD.", "Pilote limité ou reporté ; conserver le MVP local démontrable."],
                ["G2 - Production metropolitaine", "Audit WCAG complet, test d'intrusion, DPIA si necessaire, supervision, sauvegardes et plan de reprise testés.", "Interdire la generalisation ; traiter les ecarts selon criticite et responsable nommé."],
            ],
            widths=[82, 245, CONTENT_WIDTH - 327],
        ),
        p("15.5 Preparation des criteres reserves a l'epreuve", "h2"),
        table(
            [
                ["Competence", "Preuve deja preparee", "Action attendue en face-a-face"],
                ["C1.2 - argumentation economique", "Sections 1.2, 3, 4 et 15.4 : hypotheses, sensibilite et arbitrages.", "Defendre les seuils, recalculer un scenario demandé et accepter une hypothese alternative du jury."],
                ["C2.2 - bilan et optimisation", "Sections 5.5, 10.3 et historique Git : frictions, causes, ajustements et verrouillage, dont un bogue ARIA detecte puis corrigé par l'audit automatisé.", "Présenter un cas avant/apres et justifier sa faisabilite dans le sprint."],
                ["C2.3 - situation critique", "Section 14.3 structuree exactement par source, impact, court terme et moyen terme.", "Conduire l'investigation, prioriser sous contrainte et preserver les actifs existants."],
                ["C3.1 - programmation", "Specifications sections 7-8, TypeScript strict, tests et build verts.", "Parcourir le code de la specification au test et traiter les remarques de revue."],
                ["C3.2 - framework et APIs", "React/PWA, MapLibre, GTFS/GBFS, OSRM, BAN et Open-Meteo visibles sections 8 et 11.", "Expliquer les contrats, fallbacks, limites runtime et choix d'integration."],
                ["C3.3 - bogues et optimisation", "Section 10.3 et commits 0107bd3/7568701 : causes, correctifs, tests et performance.", "Rejouer un bogue, montrer le test rouge/vert et argumenter la non-regression."],
            ],
            widths=[115, 190, CONTENT_WIDTH - 305],
        ),
        p(
            "<b>Conclusion de preparation :</b> le dossier couvre integralement les preuves attendues a l'ecrit et fournit "
            "un chemin de demonstration precis pour chaque critere oral ou technique. La validation finale reste du ressort "
            "exclusif du jury, competence par competence et sans compensation entre blocs.",
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
    story.extend(section_14())
    story.extend(section_15())
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
