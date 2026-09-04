// Les références absolues du document désignent des fichiers servis a leur
// chemin exact — manifeste, icônes, polices. Les regrouper leur donnerait une
// empreinte dans le nom, or ces chemins sont ecrits en dur dans le manifeste et
// la feuille de style. Bun les laisse donc intactes.
//
// Le même greffon sert à la construction et au serveur de développement : une
// seule règle, sinon les deux montages divergent sans qu'on s'en aperçoive.
import type { BunPlugin } from 'bun';

const servedAsIs: BunPlugin = {
    name: 'served-as-is',
    setup(build) {
        build.onResolve({ filter: /^\// }, (args) => ({ path: args.path, external: true }));
    },
};

export default servedAsIs;
