declare module '*.png' {
    const url: string;
    export default url;
}

declare module '*.html' {
    import type { HTMLBundle } from 'bun';
    const bundle: HTMLBundle;
    export default bundle;
}

// Les styles sont chargés par Bun ; TypeScript ne leur attribue aucune valeur.
declare module "*.css";
