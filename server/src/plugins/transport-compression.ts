// Les ressources cartographiques publiques peuvent dépasser 1 Mo. Les compresser
// évite que leur transfert mobile dépasse le délai du client, sans tronquer la flotte.
import { Elysia } from 'elysia';

const PUBLIC_TRANSPORT_PATHS = new Set(['/api/transport/context', '/api/transport/stops', '/api/transport/nearby-stops']);
const MIN_COMPRESSION_BYTES = 1024;

function acceptsGzip(header: string | null): boolean {
    const encodings = (header ?? '').toLowerCase().split(',').map(entry => {
        const [name, ...parameters] = entry.trim().split(';').map(part => part.trim());
        const quality = parameters.find(parameter => parameter.startsWith('q='))?.slice(2) ?? '1';
        return { name, quality: Number(quality) };
    });
    const encoding = encodings.find(entry => entry.name === 'gzip') ?? encodings.find(entry => entry.name === '*');
    return Boolean(encoding && encoding.quality > 0 && encoding.quality <= 1);
}

export function transportCompression() {
    return new Elysia({ name: 'transport-compression' })
        // mapResponse intervient après validation : les contrats restent ceux du JSON décompressé.
        .mapResponse(({ request, path, response, set }) => {
            if (request.method !== 'GET' || !PUBLIC_TRANSPORT_PATHS.has(path) || (set.status ?? 200) !== 200) return;
            set.headers.vary = 'Accept-Encoding';
            if (!acceptsGzip(request.headers.get('accept-encoding'))) return;
            const json = new TextEncoder().encode(JSON.stringify(response));
            if (json.byteLength < MIN_COMPRESSION_BYTES) return;
            set.headers['content-type'] = 'application/json;charset=utf-8';
            set.headers['content-encoding'] = 'gzip';
            return new Response(Bun.gzipSync(json));
        })
        .as('scoped');
}
