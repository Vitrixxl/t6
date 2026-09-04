// Drapeaux de compilation.
//
// `import.meta.env` était une invention du bundler précédent : sous Bun, la
// valeur est injectée par `define` au moment de la construction, et les blocs
// reserves au développement disparaissent du paquet de production.
//
// Passer par une constante nommée plutôt que par `process.env` disperse dans
// le code garde un seul point a définir, et rend la substitution visible.
export const IS_DEV: boolean = process.env.NODE_ENV !== 'production';
export const IS_PROD: boolean = !IS_DEV;
