import { api, treatyRequest } from './client';

export async function downloadAccountExport(): Promise<void> {
    const data = await treatyRequest(api.me.export.get());
    const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'urbanflow-export.json';
    document.body.append(link);
    try {
        link.click();
    } finally {
        link.remove();
        // Laisser le navigateur prendre en charge le téléchargement avant de libérer le fichier.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
