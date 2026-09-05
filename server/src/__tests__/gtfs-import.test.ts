import { expect, it } from 'bun:test';

it('importe les calendriers, quais et fréquences sans fabriquer les données manquantes', async () => {
    const ingestion = Bun.spawn(['python3', 'scripts/test_gtfs_timetable.py'], { stdout: 'pipe', stderr: 'pipe' });
    const [status, errors] = await Promise.all([ingestion.exited, new Response(ingestion.stderr).text()]);
    expect({ status, errors: status === 0 ? '' : errors }).toEqual({ status: 0, errors: '' });
});
