import { expect, it } from 'bun:test';

function line(overrides: Record<string, unknown> = {}) {
    return { properties: {
        gid: 1, ligne: 'C1', famille_transport: 'BUS', code_type_ligne: 'REG', type_trace: 'NOM', sens: 'Aller',
        nom_origine: 'Alpha', nom_destination: 'Beta', nom_trace: 'Alpha - Beta', date_debut: '20260101', ...overrides,
    }, geometry: { type: 'MultiLineString', coordinates: [[[4.83, 45.75], [4.84, 45.75], [4.85, 45.75]]] } };
}
const stops = ['Alpha', 'Milieu', 'Beta'].map((nom, index) => ({
    properties: { id: index, nom, desserte: 'C1:A', pmr: true },
    geometry: { type: 'Point', coordinates: [4.83 + index / 100, 45.75] },
}));
async function imported(lines: ReturnType<typeof line>[], sourceStops = stops) {
    const process = Bun.spawn(['python3', '-c', 'import json,sys; from fetch_tcl_bus import build_bus_network; data=json.load(sys.stdin); print(json.dumps(build_bus_network(data[0],data[1],"20260905")))'], {
        cwd: 'scripts', stdin: new Blob([JSON.stringify([lines, sourceStops])]), stdout: 'pipe', stderr: 'pipe',
    });
    const [output, error, code] = await Promise.all([new Response(process.stdout).json(), new Response(process.stderr).text(), process.exited]);
    expect(error).toBe('');
    expect(code).toBe(0);
    return output;
}

it('importe les quais par sens, conserve le tracé et ne fusionne pas des homonymes', async () => {
    const [routes, importedStops] = await imported([line()], [...stops, {
        properties: { id: 9, nom: 'Milieu', desserte: 'C1:R', pmr: true },
        geometry: { type: 'Point', coordinates: [4.84, 45.7501] },
    }]);
    expect(routes[0].stopSequence).toEqual(['bus-stop:0', 'bus-stop:1', 'bus-stop:2']);
    expect(importedStops).toHaveLength(3);
    expect(routes[0].route_type).toBe(3);
});

it('exclut les services futurs, expirés, spéciaux et sans sens documenté', async () => {
    const [routes] = await imported([
        line({ date_debut: '20260906' }), line({ date_fin: '20260904' }),
        line({ type_trace: 'NUI' }), line({ code_type_ligne: 'SCO' }), line({ sens: null }),
    ]);
    expect(routes).toEqual([]);
});

it('refuse un tracé discontinu et un terminus sans desserte vérifiable', async () => {
    const discontinuous = line();
    discontinuous.geometry.coordinates.push([[4.86, 45.75], [4.87, 45.75]]);
    const [routes] = await imported([discontinuous, line({ nom_destination: 'Absent' })]);
    expect(routes).toEqual([]);
});

it('oriente la géométrie depuis le terminus publié et ignore les quais trop éloignés', async () => {
    const reversed = line();
    reversed.geometry.coordinates[0].reverse();
    const [routes] = await imported([reversed], stops.map(stop => stop.properties.nom === 'Milieu'
        ? { ...stop, geometry: { ...stop.geometry, coordinates: [4.84, 45.76] } } : stop));
    expect(routes[0].shape[0]).toEqual([4.83, 45.75]);
    expect(routes[0].stopSequence).toEqual(['bus-stop:0', 'bus-stop:2']);
});
