// L'heure choisie doit traverser le calcul, le cache et la planification.
import assert from 'node:assert/strict';

export async function checkSearchDeparture(page) {
    await page.getByRole('tab', { name: 'Transport en commun', exact: true }).click();
    const local = await page.evaluate(() => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(12, 15, 0, 0);
        return { input: new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16), iso: date.toISOString() };
    });
    await page.getByRole('button', { name: /^Départ :/ }).click();
    await page.getByLabel('Date et heure de départ', { exact: true }).fill(local.input);
    const calculated = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys')
        && response.request().postDataJSON().departureAt === local.iso);
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    const response = await calculated;
    assert(response.ok());
    const options = await response.json();
    assert(options.length > 0, 'Aucun TCL à l’heure choisie');
    assert(options.every(option => option.departureAt === local.iso));
    await page.getByRole('button', { name: 'Planifier', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Planifier ce trajet', exact: true });
    assert.equal(await dialog.getByLabel('Heure', { exact: true }).inputValue(), '12:15');
    await dialog.getByRole('tab', { name: 'Récurrent', exact: true }).click();
    assert.equal(await dialog.getByLabel('Heure de départ', { exact: true }).inputValue(), '12:15');
    await dialog.getByRole('tab', { name: 'Une fois', exact: true }).click();
    const saved = page.waitForResponse(response => response.url().includes('/api/trips/planned/') && response.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Planifier', exact: true }).click();
    const planned = await saved;
    assert(planned.ok());
    assert.equal((await planned.json()).scheduledFor, local.iso);
    console.log('Départ : date et heure transmises à MOTIS, reprises en ponctuel et récurrent, date persistée sans décalage.');
}
