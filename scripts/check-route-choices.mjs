import assert from 'node:assert/strict';
import { formatDuration } from '../src/lib/duration.ts';

/** Le deuxième trajet doit piloter les détails et les commandes, même s'il partage les moyens du premier. */
export async function checkRouteChoices(page, options) {
    assert(options.length >= 2, 'Ce parcours doit offrir au moins le TCL et la marche');
    const choices = page.getByRole('group', { name: 'Trajets disponibles', exact: true });
    const buttons = choices.getByRole('button');
    assert.equal(await buttons.count(), options.length, 'La liste ne doit pas être tronquée');
    assert.equal(await buttons.first().getAttribute('aria-pressed'), 'true', 'La première arrivée doit être sélectionnée');
    assert.deepEqual(options.map(option => Date.parse(option.arrivalAt)), options.map(option => Date.parse(option.arrivalAt)).sort((a, b) => a - b));
    const selected = options[1];
    for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await buttons.nth(1).click();
        assert.equal(await buttons.nth(1).getAttribute('aria-pressed'), 'true');
        assert.equal(await buttons.first().getAttribute('aria-pressed'), 'false');
        assert.equal(await choices.getByRole('button', { pressed: true }).count(), 1);
        if (width === 390) {
            const details = page.getByText(/^Détails du trajet/);
            assert((await details.textContent()).includes(formatDuration(selected.durationMinutes)));
            assert.equal(await details.locator('..').getAttribute('open'), null, 'Un changement de choix replie les détails');
            await details.click();
            await page.getByRole('heading', { name: selected.title, exact: true }).waitFor();
            await details.click();
        } else {
            await page.getByRole('heading', { name: selected.title, exact: true }).waitFor();
        }
        const saved = page.waitForResponse(response => response.url().includes('/api/saved-routes/') && response.request().method() === 'PUT');
        await page.getByRole('button', { name: /^(Enregistrer|Enregistré)$/ }).click();
        const response = await saved;
        assert(response.ok(), `Enregistrement de la variante : ${response.status()}`);
        const record = await response.json();
        assert.equal(record.routeId, selected.id);
        assert.equal(record.durationMinutes, selected.durationMinutes);
        assert.equal(record.distanceKm, selected.distanceKm);
        await page.getByRole('button', { name: 'Planifier', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Planifier ce trajet', exact: true });
        await dialog.waitFor();
        assert.equal(await dialog.getByLabel('Nom du trajet').inputValue(), selected.title);
        assert((await dialog.innerText()).includes(`${formatDuration(selected.durationMinutes)} · ${selected.distanceKm.toFixed(1)} km`));
        await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
        await page.screenshot({ path: `tmp/screenshots/route-choices-${width}.png` });
        await buttons.first().click();
    }
    console.log(`${options.length} trajets : liste complète, première arrivée, sélection, détails, enregistrement et formulaire de planification vérifiés sur mobile et bureau.`);
}
