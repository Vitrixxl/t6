declare module '*.png' {
    const url: string;
    export default url;
}

declare module '*.html' {
    import type { HTMLBundle } from 'bun';
    const bundle: HTMLBundle;
    export default bundle;
}
