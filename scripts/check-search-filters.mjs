// Les onglets transmettent leur parcours au moteur sans écrire dans le profil.
import assert from 'node:assert/strict';

export async function checkSearchFilters(page, context, base) {
    const profile = await (await context.request.get(base + '/api/me/profile')).json();
    assert.deepEqual(profile.availableModes, ['transit']);
    const writes = [];
    const recordWrite = request => {
        if (request.url().endsWith('/api/me/profile') && request.method() === 'PUT') writes.push(request);
    };
    page.on('request', recordWrite);
    for (const [width, label, kind, modes] of [[390, 'Dott', 'scooter', ['scooter']], [1280, 'Vélo’v', 'bike', ['bike']]]) {
        await page.setViewportSize({ width, height: 844 });
        const tabs = page.getByRole('tablist', { name: 'Moyen de transport pour cette recherche' });
        assert.equal(await tabs.getByRole('tab').count(), 5);
        const calculated = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys')
            && response.request().postDataJSON().kind === kind);
        await tabs.getByRole('tab', { name: label, exact: true }).click();
        const response = await calculated;
        assert(response.ok(), `Onglet ${label} refusé`);
        assert.deepEqual(response.request().postDataJSON().modes, modes);
        assert((await response.json()).every(option => option.modes.includes(kind) && !option.modes.includes('transit')));
        assert.equal(await page.getByRole('button', { name: /^Types de transport/ }).count(), 0);
        assert.deepEqual(await (await context.request.get(base + '/api/me/profile')).json(), profile);
        await page.screenshot({ path: `tmp/screenshots/search-filters-${width}.png` });
        await tabs.getByRole('tab', { name: 'Transport en commun', exact: true }).click();
        assert.equal(await tabs.getByRole('tab', { name: 'Transport en commun', exact: true }).getAttribute('aria-selected'), 'true');
    }
    const combined = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys')
        && response.request().postDataJSON().kind === 'multimodal');
    await page.getByRole('tab', { name: 'Multitransport', exact: true }).click();
    const response = await combined;
    assert(response.ok());
    assert.deepEqual(response.request().postDataJSON().modes, ['bike', 'scooter', 'transit']);
    assert((await response.json()).every(option => option.modes.includes('transit') && (option.modes.includes('bike') || option.modes.includes('scooter'))));
    await page.getByRole('button', { name: /^Types de transport/ }).click();
    assert.equal(await page.getByRole('checkbox').count(), 4);
    await page.keyboard.press('Escape');
    page.off('request', recordWrite);
    assert.equal(writes.length, 0, 'Les onglets temporaires ont écrit dans le profil');
    console.log('Onglets : Dott mobile, Vélo’v bureau, Multitransport, types TCL et profil intact.');
}
