import type { PaddingOptions } from 'maplibre-gl';

/** Réserve de la place aux contrôles sans épuiser un petit canvas ou un écran paysage. */
export function routeViewportPadding(width: number, height: number, desktop: boolean): Required<PaddingOptions> {
    const side = Math.min(48, width / 4);
    if (!desktop) {
        // Le panneau reste dans la moitié basse (45 % en paysage). Cadrer le
        // trajet dans la bande de carte entre ce panneau et la recherche.
        return { top: Math.min(140, height * 0.3), bottom: height * (height <= 500 ? 0.45 : 0.5), left: side, right: side };
    }
    const top = 96;
    const bottom = 88;
    // Garder au moins un tiers de la hauteur pour le trajet. Le rapport entre
    // les marges reste stable quand les contrôles occupent plus que ce budget.
    const verticalScale = Math.min(1, (height * 2 / 3) / (top + bottom));
    return { top: top * verticalScale, bottom: bottom * verticalScale, left: side, right: side };
}
