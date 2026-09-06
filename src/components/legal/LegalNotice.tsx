// Conditions d'utilisation et information sur les données personnelles
// (RGPD art. 13). Le texte est embarqué : lisible avant l'inscription et hors
// ligne. Les durées et bornes citées viennent des constantes du code, pour
// qu'une phrase ne puisse pas contredire ce que le serveur fait.
import type { ReactNode } from 'react';
import {
    PAST_TRIP_RETENTION_MONTHS,
    PLANNED_LIMIT,
    RECURRING_LIMIT,
    SAVED_ROUTES_LIMIT,
    TERMS_VERSION,
    TRIP_HISTORY_LIMIT,
} from '../../contracts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

export const CONTROLLER_CONTACT = 'vitrice91@gmail.com';

interface Treatment {
    purpose: string;
    data: string;
    basis: string;
    retention: string;
}

const TREATMENTS: Treatment[] = [
    {
        purpose: 'Compte et préférences de mobilité',
        data: 'email, nom affiché, empreinte du mot de passe, modes préférés, besoin PMR, objectifs carbone',
        basis: 'exécution du contrat (art. 6.1.b)',
        retention: 'durée de vie du compte',
    },
    {
        purpose: 'Calcul d’itinéraires',
        data: 'origine et destination de la recherche, dont ta position si tu la partages',
        basis: 'exécution du contrat',
        retention: 'ni stockées ni journalisées',
    },
    {
        purpose: 'Trajets planifiés',
        data: 'lieux, date, modes, mesures de distance, durée et carbone',
        basis: 'exécution du contrat',
        retention: `${PAST_TRIP_RETENTION_MONTHS} mois après la date prévue pour les trajets passés, ${PLANNED_LIMIT} trajets au plus`,
    },
    {
        purpose: 'Routines et itinéraires enregistrés',
        data: 'lieux, horaires, modes, mesures',
        basis: 'exécution du contrat',
        retention: `jusqu’à leur suppression, ${RECURRING_LIMIT} routines et ${SAVED_ROUTES_LIMIT} itinéraires au plus`,
    },
    {
        purpose: 'Historique carbone',
        data: 'titre du trajet, modes, mesures, sans coordonnées',
        basis: 'exécution du contrat',
        retention: `${TRIP_HISTORY_LIMIT} dernières entrées, effaçable à tout moment`,
    },
    {
        purpose: 'Session',
        data: 'empreinte du jeton de session, dans un cookie strictement nécessaire',
        basis: 'exécution du contrat',
        retention: 'sept jours, ou jusqu’à la déconnexion',
    },
    {
        purpose: 'Protection contre les abus',
        data: 'adresse IP, en mémoire du serveur uniquement',
        basis: 'intérêt légitime : sécurité du service (art. 6.1.f)',
        retention: 'soixante secondes',
    },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {children}
        </section>
    );
}

export function LegalNotice() {
    return (
        <article className="grid gap-5 text-sm leading-6 text-muted-foreground">
            <Section title="Conditions d’utilisation">
                <p>
                    UrbanFlow Mobility est un prototype réalisé dans le cadre d’une certification. Il propose un planificateur
                    d’itinéraires multimodaux dans la métropole de Lyon, la planification de trajets et le suivi d’objectifs
                    carbone. Le service est gratuit et fourni en l’état : les horaires, durées et émissions affichés sont des
                    mesures indicatives, pas un engagement de transport.
                </p>
                <p>
                    Un compte est personnel. Tu peux le supprimer à tout moment depuis « Profil et préférences » ; la
                    suppression est immédiate et définitive.
                </p>
            </Section>

            <Section title="Responsable du traitement">
                <p>
                    UrbanFlow Mobility, projet de certification Titre 6, représenté par son auteur. Contact pour toute
                    question sur tes données : <span className="text-foreground">{CONTROLLER_CONTACT}</span>.
                </p>
            </Section>

            <Section title="Ce que nous traitons, pourquoi, et combien de temps">
                <p>
                    Aucune donnée n’est utilisée à d’autres fins que le service que tu utilises : ni statistiques, ni
                    publicité, ni transmission à des tiers. Ta position en temps réel n’est jamais enregistrée.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-muted text-foreground">
                            <tr>
                                <th scope="col" className="px-3 py-2 font-semibold">Finalité</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Données</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Base légale</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Conservation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {TREATMENTS.map((treatment) => (
                                <tr key={treatment.purpose} className="border-t border-border align-top">
                                    <th scope="row" className="px-3 py-2 font-medium text-foreground">{treatment.purpose}</th>
                                    <td className="px-3 py-2">{treatment.data}</td>
                                    <td className="px-3 py-2">{treatment.basis}</td>
                                    <td className="px-3 py-2">{treatment.retention}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            <Section title="Géolocalisation">
                <p>
                    Ta position n’est lue que lorsque tu appuies sur « Ma position », après l’autorisation demandée par ton
                    navigateur (consentement, art. 6.1.a). Tu peux la refuser ou la retirer dans les réglages du navigateur :
                    la saisie manuelle d’une adresse reste possible. La position sert à afficher ton repère et à calculer un
                    itinéraire ; elle n’est conservée que si tu planifies ou enregistres toi-même un trajet qui en part.
                </p>
            </Section>

            <Section title="Services appelés par ton navigateur">
                <ul className="list-disc space-y-1 pl-5">
                    <li>Base Adresse Nationale (api-adresse.data.gouv.fr, France) : les adresses que tu tapes et les points choisis sur la carte.</li>
                    <li>Photon (photon.komoot.io, Allemagne) : la recherche de lieux et de quartiers.</li>
                    <li>Tuiles OpenStreetMap (tile.openstreetmap.org) : la zone de carte affichée.</li>
                </ul>
                <p>Ces services reçoivent ton adresse IP. Le calcul d’itinéraires est exécuté par le serveur de la plateforme.</p>
            </Section>

            <Section title="Tes droits">
                <p>
                    Accès et portabilité : « Exporter mes données » télécharge tout ce que le serveur détient sur toi.
                    Rectification : le profil se modifie librement. Effacement : « Supprimer le compte », ou l’effacement de
                    l’historique carbone seul. Pour toute autre demande, écris au contact ci-dessus. Tu peux aussi saisir la
                    CNIL (cnil.fr).
                </p>
            </Section>

            <p className="text-xs">Version du {TERMS_VERSION}.</p>
        </article>
    );
}

export function LegalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Conditions d’utilisation et données personnelles</DialogTitle>
                    <DialogDescription>Ce que fait UrbanFlow de tes données, et ce que tu peux en faire.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-5 pb-5">
                    <LegalNotice />
                </div>
            </DialogContent>
        </Dialog>
    );
}
