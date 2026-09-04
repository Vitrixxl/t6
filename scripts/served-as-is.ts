// Les references absolues du document designent des fichiers servis a leur
// chemin exact — manifeste, icones, polices. Les regrouper leur donnerait une
// empreinte dans le nom, or ces chemins sont ecrits en dur dans le manifeste et
// la feuille de style. Bun les laisse donc intactes.
//
// Le meme greffon sert a la construction et au serveur de developpement : une
// seule regle, sinon les deux montages divergent sans qu'on s'en apercoive.
import type { BunPlugin } from 'bun';

const servedAsIs: BunPlugin = {
    name: 'served-as-is',
    setup(build) {
        build.onResolve({ filter: /^\// }, (args) => ({ path: args.path, external: true }));
    },
};

export default servedAsIs;
