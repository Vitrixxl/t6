import { openDatabase } from '../server/src/db/index';
import { loadConfig } from '../server/src/config';
import { importTimetable } from '../server/src/services/transit/import';
import { timetableImport } from '../src/contracts/transit';
import { calendarDate } from '../src/lib/trips/calendar';

const path = process.argv[2] ?? 'tmp/gtfs/timetable.json';
const db = openDatabase(loadConfig().databasePath);
try {
    const data = timetableImport.parse(await Bun.file(path).json());
    if (data.metadata.endDate < calendarDate(new Date(), data.metadata.timeZone)) {
        throw new Error('Archive horaire expirée : la version active est conservée.');
    }
    const metadata = importTimetable(db, data);
    console.log(`Horaires activés : ${metadata.startDate} → ${metadata.endDate}, ${metadata.timeZone}, version ${metadata.id}.`);
} finally {
    db.$client.close();
}
