// Formats de dates du module trajets : centralises pour rester coherents
// partout (liste a venir, historique, formulaire de planification).

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const FULL_DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "Aujourd'hui · 08:15", "Demain · 18:00", sinon "lun. 7 sept. · 08:15". */
export function formatScheduleLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const dayDelta = Math.floor(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  const day = dayDelta === 0 ? "Aujourd'hui" : dayDelta === 1 ? 'Demain' : dayDelta === -1 ? 'Hier' : DAY_FORMAT.format(date);
  return `${day} · ${TIME_FORMAT.format(date)}`;
}

export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
