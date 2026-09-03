// Drapeaux de compilation.
//
// `import.meta.env` etait une invention du bundler precedent : sous Bun, la
// valeur est injectee par `define` au moment de la construction, et les blocs
// reserves au developpement disparaissent du paquet de production.
//
// Passer par une constante nommee plutot que par `process.env` disperse dans
// le code garde un seul point a definir, et rend la substitution visible.
export const IS_DEV: boolean = process.env.NODE_ENV !== 'production';
export const IS_PROD: boolean = !IS_DEV;
