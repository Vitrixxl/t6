// Python décode le GTFS ; Bun valide et active la ressource en base.
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const output = outputIndex < 0 ? 'tmp/gtfs/timetable.json' : args[outputIndex + 1];
if (!output) throw new Error('Le chemin --output est manquant.');
const ingestion = Bun.spawn(['python3', 'scripts/gtfs_timetable.py', ...args], { stdout: 'inherit', stderr: 'inherit' });
if (await ingestion.exited !== 0) process.exit(1);
const activation = Bun.spawn(['bun', 'scripts/import-timetable.ts', output], { stdout: 'inherit', stderr: 'inherit' });
process.exit(await activation.exited);
