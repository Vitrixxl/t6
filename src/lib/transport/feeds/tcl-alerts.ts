// Alertes trafic TCL (SIRI Situation Exchange).
//
// L'endpoint /api/tcl-alertes est relaye par l'API, qui detient les
// identifiants du compte Grand Lyon. Sans compte configure, il repond en
// erreur et les incidents simules du feed prennent le relais.
import type { TransportIncident } from '../../../types';
import { fetchJson } from './fetch-json';

// Schema observe du flux tclalertetrafic_2 (extrait): titre, message, cause,
// type (Information/Perturbation...), mode (Metro/Tramway/Bus...), ligne_cli,
// ligne_com, typeseverite (effets type GTFS-RT: NO_SERVICE, OTHER_EFFECT...),
// niveauseverite (numerique), debut, fin ("YYYY-MM-DD HH:MM:SS").
export interface TclAlertRecord {
  [key: string]: unknown;
}

export function alertText(record: TclAlertRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

export function alertSeverity(record: TclAlertRecord): TransportIncident['severity'] {
  const effect = alertText(record, ['typeseverite']).toUpperCase();
  if (['NO_SERVICE', 'SIGNIFICANT_DELAYS', 'STOP_MOVED'].includes(effect)) {
    return 'high';
  }
  if (['REDUCED_SERVICE', 'DETOUR', 'MODIFIED_SERVICE'].includes(effect)) {
    return 'medium';
  }
  // Simple information (renfort d'offre, prolongation...) ou effet inconnu.
  return alertText(record, ['type']).toLowerCase() === 'information' ? 'low' : 'medium';
}

export function alertStillActive(record: TclAlertRecord, now: Date): boolean {
  const end = alertText(record, ['fin']);
  if (!end) {
    return true;
  }
  const parsed = Date.parse(end.replace(' ', 'T'));
  return Number.isNaN(parsed) ? true : parsed >= now.getTime();
}

/** Convertit les enregistrements bruts du flux alertes TCL en incidents types. */
export function mapTclAlerts(
  payload: { values?: TclAlertRecord[] },
  now: Date = new Date(),
): TransportIncident[] {
  const records = payload.values ?? [];
  return records
    .filter((record) => alertStillActive(record, now))
    .map((record, index): TransportIncident | null => {
      const title = alertText(record, ['titre', 'cause', 'type']);
      const message = alertText(record, ['message']);
      if (!title && !message) {
        return null;
      }
      const line = alertText(record, ['ligne_com', 'ligne_cli']);
      const recordNumber = record.n;
      return {
        id: `tcl-alerte-${typeof recordNumber === 'number' || typeof recordNumber === 'string' ? recordNumber : index}`,
        severity: alertSeverity(record),
        // Le reseau TCL est du transport public quel que soit le sous-mode.
        affected_modes: ['transit'],
        title: line ? `${line} - ${title || 'Perturbation'}` : title || 'Perturbation TCL',
        message: message || title,
      };
    })
    .filter((incident): incident is TransportIncident => incident !== null)
    .slice(0, 40);
}

export async function fetchTclIncidents(fetcher: typeof fetch): Promise<TransportIncident[]> {
  const payload = await fetchJson<{ values?: TclAlertRecord[] }>('/api/tcl-alertes', fetcher);
  const incidents = mapTclAlerts(payload);
  if (incidents.length === 0) {
    throw new Error('Flux alertes TCL vide.');
  }
  return incidents;
}
