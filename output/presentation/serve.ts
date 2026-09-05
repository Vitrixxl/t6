// Serveur du diaporama de soutenance.
//
// Bun regroupe lui-même index.html, le code React et les feuilles de style :
// aucun bundler tiers, aucun appel vers l'API UrbanFlow ni vers un service
// distant. Les captures d'écran sont lues dans output/screens/ au moment du
// regroupement et servies comme fichiers statiques.
import index from './index.html';

const port = Number(process.env.PORT ?? 4100);

const server = Bun.serve({
    port,
    routes: {
        '/': index,
        '/favicon.ico': new Response(null, { status: 204 }),
    },
    development: true,
    fetch() {
        return new Response('Introuvable', { status: 404 });
    },
});

console.log(`Présentation ouverte sur ${server.url}`);
console.log('Clavier : → / espace suivant, ← précédent, Début / Fin, F plein écran.');
