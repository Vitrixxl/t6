// Les dates d’exception sont civiles : le serveur et le navigateur doivent
// les interpréter dans le fuseau enregistré avec la routine.
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const timeFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(timeZone: string): Intl.DateTimeFormat {
    let format = dateFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        dateFormats.set(timeZone, format);
    }
    return format;
}

function timeFormat(timeZone: string): Intl.DateTimeFormat {
    let format = timeFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-GB', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        });
        timeFormats.set(timeZone, format);
    }
    return format;
}

export function calendarDate(at: Date, timeZone: string): string {
    const parts = dateFormat(timeZone).formatToParts(at);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}

export function nextCalendarDate(date: string): string {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
}

/** Convertit une heure civile en instant, avec le décalage d’été ou d’hiver. */
export function atCalendarTime(date: string, time: string, timeZone: string): Date {
    const target = new Date(`${date}T${time}:00Z`).getTime();
    let instant = target;
    let previous: number | null = null;
    const format = timeFormat(timeZone);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = format.formatToParts(new Date(instant));
        const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
        const local = Date.parse(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}Z`);
        const adjusted = instant + target - local;
        if (adjusted === instant) {
            break;
        }
        // Au saut d’heure, l’heure civile inexistante oscille entre deux
        // instants : retenir celui après le saut, comme une Date locale.
        if (adjusted === previous) {
            return new Date(Math.max(instant, adjusted));
        }
        previous = instant;
        instant = adjusted;
    }
    return new Date(instant);
}
