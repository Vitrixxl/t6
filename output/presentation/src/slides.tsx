import type { ComponentType } from 'react';
import { Card, Reveal, SlideFrame, Stat, Table } from './ui.tsx';

// Le contenu suit le déroulé de output/soutenance/01-deroule.html, section par
// section. Les chiffres de la diapositive « Depuis la remise » ont été relevés
// le 6 septembre 2026 : git rev-list --count cf07f12..main, gh pr list
// --state merged, bun run test.

function Cover() {
    return (
        <SlideFrame className="cover" eyebrow="Titre 6 CDSD · RNCP 36146 · Session septembre 2026">
            <Reveal as="p" className="cover-brand">
                UrbanFlow
            </Reveal>
            <Reveal className="cover-title">
                <h1>
                    Une plateforme de mobilité multimodale <em>qui rend visible</em> le coût carbone de chaque trajet.
                </h1>
            </Reveal>
            <Reveal as="p" className="cover-sub">
                Progressive Web App · Lyon · démonstration sur téléphone
            </Reveal>
        </SlideFrame>
    );
}

function Problem() {
    return (
        <SlideFrame eyebrow="01 · Le produit, en une phrase" title="Le problème n'est pas l'absence d'offre. C'est sa fragmentation.">
            <div className="tiles">
                <Card kicker="Le contexte" title="Une métropole de 500 000 habitants">
                    Elle veut réduire la voiture individuelle. Vélos, trottinettes, métro et tramway existent déjà.
                </Card>
                <Card kicker="Le frein" title="Chaque service a son application">
                    Comparer un trajet suppose d'ouvrir quatre outils et de refaire le calcul soi-même.
                </Card>
                <Card kicker="La réponse" title="Un seul trajet, tous les modes" tone="pine">
                    La plateforme compare les modes sur un même trajet et affiche ce que chaque choix coûte en CO₂e.
                </Card>
            </div>
        </SlideFrame>
    );
}

function Requirements() {
    return (
        <SlideFrame eyebrow="02 · Ce que le sujet imposait, ce que j'ai livré" title="Trois fonctionnalités obligatoires, une au choix">
            <Table
                head={['Exigence', 'Ce qui est livré']}
                rows={[
                    [
                        <>
                            <b>F1</b> Inscription, connexion, profil de mobilité
                        </>,
                        'Mots de passe argon2id, sessions opaques révocables, profil qui pèse sur le score et la présélection.',
                    ],
                    [
                        <>
                            <b>F2</b> Planificateur multimodal, géolocalisation temps réel
                        </>,
                        'Six options comparées, position en direct, tracé réel segment par segment.',
                    ],
                    [
                        <>
                            <b>F3</b> Intégration d'API transport
                        </>,
                        "GTFS TCL, desserte et tracés SYTRAL, GBFS Vélo'v et Dott, géocodage.",
                    ],
                    [
                        <>
                            <b>Option retenue</b>
                        </>,
                        <b>Calculateur d'empreinte carbone avec suivi personnel.</b>,
                    ],
                ]}
            />
        </SlideFrame>
    );
}

function PhoneDemo() {
    return (
        <SlideFrame className="cover handoff" eyebrow="03 · La démonstration">
            <Reveal className="cover-title">
                <h1>
                    On passe <em>sur le téléphone.</em>
                </h1>
            </Reveal>
            <Reveal as="p" className="cover-sub">
                Le parcours complet, en conditions réelles : connexion, carte, trajet, suivi carbone, coupure réseau.
            </Reveal>
        </SlideFrame>
    );
}

function Stack() {
    return (
        <SlideFrame eyebrow="04 · La pile technique" title="Un seul exécutable, un seul contrat de données">
            <div className="columns">
                <Card kicker="Le client" title="React 19, TypeScript strict">
                    <ul>
                        <li>Tailwind CSS 4 et shadcn/ui sur Radix : navigation clavier et rôles ARIA d'origine.</li>
                        <li>MapLibre GL pour la carte, React Query pour les données distantes, jotai pour l'état d'écran.</li>
                        <li>Eden Treaty : le client HTTP est typé depuis l'arbre Elysia, sans type recopié.</li>
                        <li>Regroupé par Bun.build, sans bundler tiers.</li>
                    </ul>
                </Card>
                <Card kicker="L'API" title="Elysia sur Bun">
                    <ul>
                        <li>Contrats zod partagés : validation, types, OpenAPI et formulaires partent de la même source.</li>
                        <li>Drizzle sur SQLite natif : schéma déclaré une fois, migrations versionnées.</li>
                        <li>argon2id natif, plugins dédiés au contexte, à la session, au débit et aux en-têtes.</li>
                        <li>Le serveur est la seule source de vérité : une commande par ressource.</li>
                    </ul>
                </Card>
            </div>
        </SlideFrame>
    );
}

function ExternalApis() {
    return (
        <SlideFrame eyebrow="04 · Les API externes" title="Ce que chaque service apporte, et ce qu'il se passe s'il tombe">
            <Table
                className="dense"
                head={['Service', "Ce qu'il apporte", "S'il tombe"]}
                rows={[
                    [<b>BAN</b>, 'Géocodage des adresses, service public sans clé.', 'Résultats Photon conservés.'],
                    [<b>Photon</b>, 'Second géocodeur, données OpenStreetMap.', 'Résultats BAN conservés ; erreur si les deux échouent.'],
                    [<b>MOTIS</b>, 'Itinéraires multimodaux sur un graphe unique : voirie OSM, horaires GTFS, flux GBFS. Un moteur local.', 'Aucune option : 503 et message explicite, jamais un tracé inventé.'],
                    [<b>Tuiles OSM</b>, 'Le fond de plan.', "Carte vide, l'itinéraire reste lisible en liste."],
                    [<b>GBFS Vélo'v et Dott</b>, 'Stations, vélos disponibles, trottinettes libres.', 'Message explicite, aucun véhicule partagé ni secours local.'],
                    [<b>GTFS TCL et WFS Grand Lyon</b>, 'Desserte et tracés officiels, ingérés hors ligne.', "Sans effet à l'exécution."],
                ]}
            />
        </SlideFrame>
    );
}

function Docker() {
    return (
        <SlideFrame eyebrow="04 · Ce qu'il y a dans Docker" title="Une image pour l'application, un moteur d'itinéraires">
            <div className="columns">
                <Card kicker="Le service app" title="Client et API sur une seule origine">
                    <ul>
                        <li>Image en deux étages : construction du client, puis serveur et dépendances de production seulement.</li>
                        <li>Un cookie de session de première partie, aucun en-tête CORS.</li>
                        <li>HTTPS avec certificat auto-signé généré au premier démarrage.</li>
                        <li>Deux volumes : la base et le certificat. Compte de recette réinitialisé au démarrage.</li>
                    </ul>
                </Card>
                <Card kicker="Le calculateur d'itinéraires" title="MOTIS : voirie, horaires, engins partagés">
                    <ul>
                        <li>Un seul processus : osr route la voirie (marche, vélo, référence voiture), nigiri exécute RAPTOR sur le GTFS.</li>
                        <li>Les flux GBFS Vélo'v et Dott sont lus à l'exécution : prise et dépose décidées par le moteur.</li>
                        <li>La voiture est une référence carbone invisible, jamais proposée.</li>
                        <li>Appelé par nom de service, aucun port publié, aucun routage public en secours.</li>
                    </ul>
                </Card>
            </div>
        </SlideFrame>
    );
}

interface CostLine {
    label: string;
    price: string;
}

interface CostScenarioProps {
    kicker: string;
    title: string;
    hypothesis: string;
    lines: readonly CostLine[];
    total: string;
    totalNote: string;
    tone?: 'plain' | 'pine';
}

function CostScenario({ kicker, title, hypothesis, lines, total, totalNote, tone = 'plain' }: CostScenarioProps) {
    return (
        <Reveal className={`card card-${tone} cost`}>
            <span className="card-kicker">{kicker}</span>
            <h3 className="card-title">{title}</h3>
            <p className="cost-hypothesis">{hypothesis}</p>
            <ul className="cost-lines">
                {lines.map((line) => (
                    <li key={line.label}>
                        <span>{line.label}</span>
                        <b>{line.price}</b>
                    </li>
                ))}
            </ul>
            <div className="cost-total">
                <b>{total}</b>
                <span>{totalNote}</span>
            </div>
        </Reveal>
    );
}

// Tarifs HT relevés le 5 septembre 2026 sur les pages de prix Scaleway (zone
// Paris) et MapTiler. Mémoire mesurée avec docker stats sur les
// quatre conteneurs au repos : 468 Mio.
function Costs() {
    return (
        <SlideFrame eyebrow="04 · Ce que ça coûte" title="Tel quel, puis à l'échelle de la métropole" className="costs">
            <div className="columns">
                <CostScenario
                    kicker="Scénario 1 · tel quel"
                    title="Une machine, Docker, SQLite"
                    hypothesis="API Bun et un moteur MOTIS : 118 Mio de RAM mesurés au repos pour le moteur sur Lyon, 4 Go suffisent largement."
                    lines={[
                        { label: 'Instance DEV1-M, 3 vCPU, 4 Go', price: '14,74 €' },
                        { label: 'Volume 20 Go et instantanés 10 Go', price: '2,26 €' },
                        { label: 'Adresse IPv4', price: '3,65 €' },
                        { label: 'Tuiles OSM, BAN, Photon', price: '0 €' },
                    ]}
                    total="≈ 21 € HT / mois"
                    totalNote="≈ 250 € par an. Tuiles OSM tolérées avec un User-Agent dédié, pas à l'échelle."
                />
                <CostScenario
                    kicker="Scénario 2 · à l'échelle"
                    title="Kubernetes, PostgreSQL redondé"
                    hypothesis="5 % de la métropole actifs : 25 000 utilisateurs et 200 000 sessions de carte par mois."
                    lines={[
                        { label: 'Kapsule, plan de contrôle mutualisé', price: '0 €' },
                        { label: '3 nœuds PRO2-XS, 4 vCPU, 16 Go', price: '245,70 €' },
                        { label: 'PostgreSQL DB-GP-XS + nœud de secours, 50 Go', price: '198,83 €' },
                        { label: 'Load Balancer et registre d\'images', price: '39,73 €' },
                        { label: 'Tuiles MapTiler Flex, 200 000 sessions', price: '467,50 $' },
                    ]}
                    total="≈ 484 € HT + 468 $ / mois"
                    totalNote="≈ 920 € par mois. Plan de contrôle dédié avec SLA : + 80,30 €."
                    tone="pine"
                />
            </div>
            <Reveal as="p" className="sources">
                Sources, tarifs HT relevés le 5 septembre 2026 : scaleway.com/pricing · maptiler.com/cloud/pricing ·
                osmfoundation.org/policies/tiles · adresse.data.gouv.fr
            </Reveal>
        </SlideFrame>
    );
}

function Reversals() {
    return (
        <SlideFrame eyebrow="05 · Les points de friction" title="Ce que j'ai retiré, ajouté ou remplacé depuis la remise">
            <div className="tiles">
                <Card kicker="Retiré" title="Ce qui ne tenait pas" tone="alert">
                    <ul>
                        <li>Le covoiturage : personne mis en relation, occupants saisis à la main.</li>
                        <li>Le signalement d'incidents : aucun usager pour signaler.</li>
                        <li>Le mode sans serveur, puis la file d'opérations hors ligne : deux copies à tenir d'accord.</li>
                        <li>Trois routes d'API sans appelant, dont l'état global écrasé d'un bloc.</li>
                    </ul>
                </Card>
                <Card kicker="Ajouté" title="Ce que la démo exigeait" tone="pine">
                    <ul>
                        <li>Les bus TCL : 92 lignes régulières, quais et tracés par sens.</li>
                        <li>Le vélo et la trottinette en rabattement vers le réseau : six familles d'options.</li>
                        <li>Les quais chargés par zone visible au lieu du fichier complet.</li>
                        <li>Un moteur MOTIS local après le quota du routage public : horaires, correspondances et rabattements calculés sur un graphe unique.</li>
                        <li>L'information RGPD acceptée à l'inscription, la conservation à six mois et le registre des traitements.</li>
                    </ul>
                </Card>
                <Card kicker="Remplacé" title="Ce qui a changé de forme">
                    <ul>
                        <li>Le serveur est la seule source de vérité : une commande par ressource, React Query en cache.</li>
                        <li>Le clic « Fait » remplacé par la comptabilisation à la date, côté serveur.</li>
                        <li>Le plafond de marche du profil retiré : toutes les options calculables sont proposées.</li>
                        <li>Le moteur maison (huit candidats à vol d'oiseau, fréquences moyennes) et trois OSRM remplacés par MOTIS : deux mille lignes en moins.</li>
                    </ul>
                </Card>
            </div>
        </SlideFrame>
    );
}

interface BugCardProps {
    code: string;
    pr: number;
    title: string;
    children: string;
}

function BugCard({ code, pr, title, children }: BugCardProps) {
    const url = `https://github.com/Vitrixxl/t6/pull/${pr}`;
    return (
        <Reveal className="card bug">
            <span className="card-kicker">
                {code} · PR #{pr}
            </span>
            <h3 className="card-title">{title}</h3>
            <p className="bug-symptom">{children}</p>
            <a className="bug-link" href={url} target="_blank" rel="noreferrer">
                github.com/Vitrixxl/t6/pull/{pr}
            </a>
        </Reveal>
    );
}

// Seul le symptôme est écrit : l'identification, le correctif et les tests se
// disent à l'oral, pendant la revue en face-à-face.
function Bugs() {
    return (
        <SlideFrame eyebrow="05 · Erreurs de pré-production" title="Trois bogues, chacun avec sa PR fusionnée">
            <div className="tiles">
                <BugCard code="B16" pr={1} title="Le suivi hebdomadaire cumulait tout l'historique">
                    La progression ne redescendait pas le lundi, et deux écrans annonçaient des économies différentes pour
                    la même semaine.
                </BugCard>
                <BugCard code="B17" pr={4} title="Une trottinette proposée sur 416 kilomètres">
                    Bellecour vers Paris proposait une trottinette de 23 heures, alors que la bannière annonçait les
                    véhicules partagés indisponibles hors métropole.
                </BugCard>
                <BugCard code="B20" pr={7} title="Les chiffres changeaient selon l'option sélectionnée">
                    Le vélo affichait 32 minutes et 5,0 km une fois sélectionné, 26 minutes et 4,5 km quand une autre
                    option l'était.
                </BugCard>
            </div>
        </SlideFrame>
    );
}

function NextIterations() {
    return (
        <SlideFrame eyebrow="06 · Prochaines itérations" title="Les ajustements à effectuer, dans l'ordre">
            <div className="tiles tiles-4">
                <Card kicker="1 · Données" title="Charger l'archive TCL du jour">
                    MOTIS calcule sur les calendriers de l'archive GTFS chargée ; celle du développement date de 2022.
                    Il reste à automatiser le téléchargement quotidien de l'archive officielle et à brancher le temps
                    réel GTFS-RT quand SYTRAL le publiera.
                </Card>
                <Card kicker="2 · Exploitation" title="Passer à PostgreSQL et Kubernetes">
                    SQLite sur un nœud suffit à la démonstration, pas à une métropole. Le schéma Drizzle migre vers
                    PostgreSQL avec PostGIS pour l'index spatial ; le déploiement suit le scénario chiffré.
                </Card>
                <Card kicker="3 · Conformité" title="Analyse d'impact avant l'échelle">
                    Information, base légale par traitement, registre et conservation à six mois sont en place. À
                    l'échelle d'une métropole, la localisation à grande échelle impose une analyse d'impact et un
                    contrat avec chaque sous-traitant.
                </Card>
                <Card kicker="4 · Dépendances" title="Sortir des services tolérés">
                    Tuiles OSM et géocodeur Photon sont acceptés pour un prototype. À l'échelle : un fournisseur de tuiles
                    sous contrat et un géocodeur auto-hébergé sur la BAN.
                </Card>
            </div>
        </SlideFrame>
    );
}

function SinceDelivery() {
    return (
        <SlideFrame eyebrow="07 · Depuis la remise du dossier" title="Ce qui a été corrigé, vérifié et mesuré">
            <div className="stats">
                <Stat value="156" label="commits depuis le code remis au jury" />
                <Stat value="23" label="PR fusionnées, chacune avec ses tests" />
                <Stat value="191" label="tests, 30 fichiers, 0 échec" />
                <Stat value="9 / 9" label="assertions du parcours de planification" />
                <Stat value="0" label="violation axe-core sur quatre écrans" />
                <Stat value="CI verte" label="sur le dernier commit poussé" />
            </div>
        </SlideFrame>
    );
}

function Closing() {
    return (
        <SlideFrame className="cover" eyebrow="08 · Merci">
            <Reveal className="cover-title">
                <h1>
                    Merci pour votre attention. <em>Je suis à votre écoute</em> pour vos questions.
                </h1>
            </Reveal>
            <Reveal as="p" className="cover-sub">
                UrbanFlow Mobility · code, journal des bogues et supports disponibles pour la revue.
            </Reveal>
        </SlideFrame>
    );
}

export interface SlideProps {
    step: number;
}

export interface SlideDefinition {
    component: ComponentType<SlideProps>;
    steps?: number;
}

export const slides: readonly SlideDefinition[] = [
    { component: Cover },
    { component: Problem },
    { component: Requirements },
    { component: PhoneDemo },
    { component: Stack },
    { component: ExternalApis },
    { component: Docker },
    { component: Costs },
    { component: Reversals },
    { component: Bugs },
    { component: NextIterations },
    { component: SinceDelivery },
    { component: Closing },
];
