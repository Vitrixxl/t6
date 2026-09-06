// Vérifie le hub sur de vrais écrans Chromium et les annulations sur l’API locale.
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
mkdirSync('tmp/screenshots', { recursive: true });

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
async function put(path, data) {
    const response = await context.request.put(`${baseURL}/api${path}`, { data });
    assert(response.ok(), `${path} : ${response.status()} ${await response.text()}`);
    return response.json();
}
async function readAccountResources() {
    const [plannedTrips, recurringTrips, tripRecords, savedRoutes, profile] = await Promise.all(
        ['/trips/planned', '/trips/recurring', '/trips/history', '/saved-routes', '/me/profile'].map(async path => {
            const response = await context.request.get(`${baseURL}/api${path}`);
            assert(response.ok(), `${path} : ${response.status()}`);
            return response.json();
        }),
    );
    return { plannedTrips, recurringTrips, tripRecords, savedRoutes, profile };
}
async function openHub() {
    await page.getByRole('button', { name: /passer le tutoriel/i }).click({ timeout: 1500 }).catch(() => undefined);
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('dialog', { name: 'Planificateur de trajets' }).waitFor();
}
async function confirmCancellation() {
    const confirmation = page.getByRole('dialog', { name: /^Annuler (ces passages|ce trajet)/ });
    await confirmation.getByRole('button', { name: 'Confirmer l’annulation', exact: true }).click();
}
async function tab(name) {
    await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('tab', { name: new RegExp(`^${name}`), selected: true }).waitFor();
}
async function assertFits(label) {
    const overflow = await page.getByRole('dialog', { name: 'Planificateur de trajets' }).evaluate((dialog) => {
        const bounds = dialog.getBoundingClientRect();
        return [...dialog.querySelectorAll('*')].filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.left < bounds.left - 1 || box.right > bounds.right + 1);
        }).map((element) => `${element.tagName}.${element.className}`).slice(0, 5);
    });
    assert(overflow.length === 0, `${label} : débordement ${overflow.join(', ')}`);
}

try {
    const email = `test-trajets-${randomUUID()}@example.test`;
    const registered = await context.request.post(`${baseURL}/api/auth/register`, {
        data: { email, password: 'UrbanFlow2026!', displayName: 'Test trajets', termsAccepted: true },
    });
    assert(registered.status() === 201, 'Création du compte de test impossible');
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);
    const createdAt = `${yesterday}T00:00:00.000Z`;
    const trip = {
        label: 'Domicile — Travail : trajet de vérification avec une longue adresse',
        origin: { label: 'Rue d’Arménie 69003 Lyon, Lyon 3e Arrondissement', lat: 45.75, lon: 4.85 },
        destination: { label: '105 Rue Garibaldi 69006 Lyon, Lyon 6e Arrondissement', lat: 45.76, lon: 4.85 },
        modes: ['bike'], distanceKm: 3, durationMinutes: 22, carbonGrams: 30, carbonSavedGrams: 400, createdAt,
    };
    await put('/trips/recurring/work', {
        ...trip, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '08:00', returnTime: '18:00',
        timeZone: 'Europe/Paris', periods: [{ from: createdAt, to: `${yesterday}T23:59:00.000Z` }],
    });
    await put('/trips/planned/past', { ...trip, scheduledFor: `${yesterday}T09:00:00.000Z`, status: 'planned', completedAt: null });
    await readAccountResources();
    await put('/trips/planned/future', { ...trip, scheduledFor: new Date(today.getTime() + 86_400_000).toISOString(), status: 'planned', completedAt: null });
    await put('/saved-routes/saved', { ...trip, routeId: 'bike', routeTitle: trip.label, score: 80 });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await openHub();
    for (const width of [320, 390, 540, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const label of ['Une fois', 'Récurrents', 'Historique', 'Enregistrés']) {
            await tab(label);
            await assertFits(`${width}px / ${label}`);
        }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tab('Récurrents');
    const dialog = page.getByRole('dialog', { name: 'Planificateur de trajets' });
    assert(await dialog.getByRole('button', { name: /^(fait|annuler)/i }).count() === 0, 'Une routine ne doit pas être cochable');
    await page.screenshot({ path: 'tmp/screenshots/trips-recurring-mobile.png' });
    await tab('Historique');
    await dialog.getByRole('button', { name: 'Annuler les deux', exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tmp/screenshots/trips-history-mobile.png' });
    await dialog.getByRole('button', { name: 'Annuler l’aller', exact: true }).click();
    const undoDialog = page.getByRole('dialog', { name: 'Annuler ces passages ?', exact: true });
    await undoDialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert((await readAccountResources()).recurringTrips[0].cancelledPassages.length === 0, 'Une annulation a été envoyée sans confirmation');
    const waitCancel = page.waitForResponse((response) => response.url().includes('/cancellations/') && response.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Annuler l’aller', exact: true }).click();
    await confirmCancellation();
    assert((await waitCancel).ok(), 'Annulation aller refusée');
    let remote = await readAccountResources();
    assert(remote.recurringTrips[0].cancelledPassages.length === 1, 'L’aller n’est pas persisté seul');
    assert(remote.recurringTrips[0].cancelledPassages[0].direction === 'outbound', 'Mauvais sens annulé');
    await page.reload({ waitUntil: 'networkidle' });
    await openHub();
    await tab('Historique');
    assert(await dialog.getByRole('button', { name: 'Annuler l’aller', exact: true }).count() === 0, 'L’annulation aller disparaît au rechargement');
    const waitReturn = page.waitForResponse((response) => response.url().includes('/cancellations/') && response.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Annuler le retour', exact: true }).click();
    await confirmCancellation();
    assert((await waitReturn).ok(), 'Annulation retour refusée');
    const waitOnce = page.waitForResponse((response) => response.url().endsWith('/past/cancellation'));
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await confirmCancellation();
    assert((await waitOnce).ok(), 'Annulation ponctuelle refusée');
    remote = await readAccountResources();
    assert(remote.recurringTrips[0].cancelledPassages.length === 2, 'Les deux sens ne sont pas conservés');
    assert(remote.tripRecords.length === 0, 'Le ponctuel annulé contribue encore au carbone');
    assert(remote.plannedTrips.find((item) => item.id === 'past').status === 'cancelled', 'Trace ponctuelle perdue');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tmp/screenshots/trips-cancelled-mobile.png' });
    await put('/trips/recurring/both', {
        ...trip, label: 'Annulation groupée', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        departureTime: '08:00', returnTime: '18:00', timeZone: 'Europe/Paris',
        periods: [{ from: createdAt, to: `${yesterday}T23:59:00.000Z` }],
    });
    await page.reload({ waitUntil: 'networkidle' });
    await openHub();
    await tab('Historique');
    const waitBoth = page.waitForResponse((response) => response.url().includes('/both/cancellations/'));
    await dialog.getByRole('button', { name: 'Annuler les deux', exact: true }).click();
    await confirmCancellation();
    assert((await waitBoth).ok(), 'Annulation des deux sens refusée');
    remote = await readAccountResources();
    assert(remote.recurringTrips.find((item) => item.id === 'both').cancelledPassages.length === 2, 'Les deux sens ne sont pas annulés ensemble');
    const bothCard = dialog.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Annulation groupée', exact: true }) });
    const restored = page.waitForResponse((response) => response.url().includes('/both/cancellations/') && response.request().method() === 'DELETE');
    await bothCard.getByRole('button', { name: 'Rétablir l’aller', exact: true }).click();
    assert((await restored).ok(), 'Rétablissement refusé');
    remote = await readAccountResources();
    assert(remote.recurringTrips.find((item) => item.id === 'both').cancelledPassages.length === 1, 'Le retour a été rétabli avec l’aller');
    await page.reload({ waitUntil: 'networkidle' });
    await openHub();
    await tab('Historique');
    assert(await bothCard.getByRole('button', { name: 'Annuler l’aller', exact: true }).count() === 1, 'Rétablissement perdu au rechargement');
    // La recette du budget part ensuite sans contribution des routines.
    await put(`/trips/recurring/both/cancellations/${yesterday}`, { directions: ['outbound'] });
    const deleteRequests = [];
    page.on('request', (request) => {
        if (request.method() === 'DELETE') deleteRequests.push(request.url());
    });
    for (const target of [
        { tab: 'Une fois', title: 'Supprimer ce trajet ?', path: '/trips/planned/future', collection: 'plannedTrips', id: 'future', width: 390 },
        { tab: 'Récurrents', title: 'Supprimer ce trajet récurrent ?', path: '/trips/recurring/work', collection: 'recurringTrips', id: 'work', width: 1280 },
        { tab: 'Enregistrés', title: 'Supprimer cet itinéraire enregistré ?', path: '/saved-routes/saved', collection: 'savedRoutes', id: 'saved', width: 390 },
    ]) {
        await page.setViewportSize({ width: target.width, height: 844 });
        await tab(target.tab);
        const name = target.tab === 'Récurrents' ? `Supprimer le trajet récurrent ${trip.label}` : `Supprimer ${trip.label}`;
        const remove = dialog.getByRole('button', { name, exact: true });
        const confirmation = page.getByRole('dialog', { name: target.title, exact: true });
        const before = deleteRequests.length;
        await remove.click();
        await confirmation.waitFor();
        await confirmation.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
        assert((await confirmation.innerText()).includes(trip.label), 'La confirmation doit identifier le trajet');
        assert(deleteRequests.length === before, 'Suppression déclenchée avant confirmation');
        const bounds = await confirmation.boundingBox();
        assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= target.width && bounds.y >= 0 && bounds.y + bounds.height <= 844, 'Confirmation hors écran');
        await page.screenshot({ path: `tmp/screenshots/confirmation-${target.id}-${target.width}.png` });
        await confirmation.getByRole('button', { name: 'Annuler', exact: true }).click();
        await confirmation.waitFor({ state: 'hidden' });
        assert((await readAccountResources())[target.collection].some((item) => item.id === target.id), 'Annuler a supprimé le trajet');
        await remove.click();
        await confirmation.waitFor();
        await confirmation.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
        await confirmation.getByRole('button', { name: 'Annuler', exact: true }).focus();
        await page.keyboard.press('Escape');
        await confirmation.waitFor({ state: 'hidden' });
        await dialog.waitFor();
        assert(deleteRequests.length === before, 'Annuler ou Échap a envoyé une suppression');
        await remove.click();
        const response = page.waitForResponse((result) => result.url().endsWith('/api' + target.path) && result.request().method() === 'DELETE');
        await confirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
        assert((await response).ok(), 'Suppression confirmée refusée');
        await remove.waitFor({ state: 'hidden' });
        assert(!(await readAccountResources())[target.collection].some((item) => item.id === target.id), 'Suppression non persistée');
        assert(deleteRequests.length === before + 1, 'La confirmation doit envoyer une seule suppression');
    }
    await put('/trips/planned/carbon-clear', { ...trip, scheduledFor: new Date(Date.now() - 1000).toISOString(), status: 'planned', completedAt: null });
    await readAccountResources();
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-tour="route-detail"]').waitFor();
    const clear = page.getByRole('button', { name: "Effacer l'historique", exact: true });
    const clearDialog = page.getByRole('dialog', { name: 'Effacer l’historique carbone ?', exact: true });
    const beforeClear = deleteRequests.length;
    await clear.click();
    await clearDialog.waitFor();
    await clearDialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await clearDialog.waitFor({ state: 'hidden' });
    assert(deleteRequests.length === beforeClear && (await readAccountResources()).tripRecords.length > 0, 'Annuler a effacé l’historique');
    await clear.click();
    const cleared = page.waitForResponse((response) => response.url().endsWith('/api/trips/history') && response.request().method() === 'DELETE');
    await clearDialog.getByRole('button', { name: 'Effacer l’historique', exact: true }).click();
    assert((await cleared).ok(), 'Effacement confirmé refusé');
    assert((await readAccountResources()).tripRecords.length === 0, 'Historique non effacé');
    assert((await readAccountResources()).recurringTrips.some((item) => item.id === 'both'), 'L’effacement carbone a supprimé une récurrence');
    console.log('Confirmations : ponctuel, récurrent, enregistré et historique carbone ; annulation sans DELETE, Échap et suppression persistée vérifiés.');
    const profileResponse = await context.request.put(`${baseURL}/api/me/profile`, {
        data: { ...(await readAccountResources()).profile, carbonGoalGramsPerWeek: 250 },
    });
    assert(profileResponse.ok(), 'Budget de recette refusé');
    await put('/trips/planned/budget', { ...trip, label: 'Vérification budget', carbonGrams: 300, carbonSavedGrams: 5000, scheduledFor: createdAt, status: 'planned', completedAt: null });
    await readAccountResources();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await openHub();
    const budget = dialog.getByRole('region', { name: 'Budget carbone de la semaine' });
    for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await budget.scrollIntoViewIfNeeded();
        assert(await budget.getByTestId('carbon-spent').innerText() === '300 gCO₂e', 'Les économies ne doivent pas être soustraites aux dépenses');
        assert(await budget.getByTestId('carbon-limit').innerText() === '250 gCO₂e', 'Mauvais maximum hebdomadaire');
        assert((await budget.getByTestId('carbon-remaining').innerText()).includes('Dépassement de 50 gCO₂e · 120 %'), 'Dépassement mal indiqué');
        assert(await budget.getByRole('progressbar').getAttribute('aria-valuenow') === '100', 'La barre doit rester bornée au maximum');
        await page.screenshot({ path: `tmp/screenshots/budget-depasse-${width}.png` });
    }
    await budget.locator('summary').click();
    const reference = budget.getByRole('link', { name: /Source : SDES-Insee/ });
    assert(await reference.getAttribute('href') === 'https://www.statistiques.developpement-durable.gouv.fr/le-quart-des-menages-les-plus-aises-lorigine-de-35-des-emissions-de-gaz-effet-de-serre-des', 'Source statistique absente');
    assert((await budget.innerText()).includes('2019'), 'Millésime statistique absent');
    await page.screenshot({ path: 'tmp/screenshots/budget-reference.png' });
    await tab('Historique');
    const budgetTrip = dialog.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Vérification budget', exact: true }) });
    const cancelledBudget = page.waitForResponse((response) => response.url().endsWith('/api/trips/planned/budget/cancellation') && response.request().method() === 'PUT');
    await budgetTrip.getByRole('button', { name: 'Annuler', exact: true }).click();
    await confirmCancellation();
    assert((await cancelledBudget).ok(), 'Annulation du trajet de recette refusée');
    await page.waitForFunction(() => [...globalThis.document.querySelectorAll('[data-testid="carbon-spent"]')].every((element) => element.textContent === '0 gCO₂e'));
    assert((await budget.getByTestId('carbon-remaining').innerText()).includes('250 gCO₂e restants · 0 %'), 'L’annulation ne libère pas le budget');
    const restoredBudget = page.waitForResponse((response) => response.url().endsWith('/api/trips/planned/budget/cancellation') && response.request().method() === 'DELETE');
    await budgetTrip.getByRole('button', { name: 'Rétablir', exact: true }).click();
    assert((await restoredBudget).ok(), 'Rétablissement du ponctuel refusé');
    await page.waitForFunction(() => [...globalThis.document.querySelectorAll('[data-testid="carbon-spent"]')].every((element) => element.textContent === '300 gCO₂e'));
    assert((await budgetTrip.innerText()).includes('Fait automatiquement'), 'Le ponctuel rétabli n’est pas automatiquement fait');
    await page.reload({ waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 390, height: 844 });
    await openHub();
    await tab('Historique');
    assert((await budgetTrip.innerText()).includes('Fait automatiquement'), 'Rétablissement perdu après rechargement');
    const recancel = page.waitForResponse((response) => response.url().endsWith('/api/trips/planned/budget/cancellation') && response.request().method() === 'PUT');
    await budgetTrip.getByRole('button', { name: 'Annuler', exact: true }).click();
    await confirmCancellation();
    assert((await recancel).ok(), 'Nouvelle annulation refusée');
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    const sidebarBudget = page.locator('[data-tour="route-detail"]').getByRole('region', { name: 'Budget carbone de la semaine' });
    await sidebarBudget.waitFor();
    assert(await sidebarBudget.getByTestId('carbon-spent').innerText() === '0 gCO₂e', 'La dépense réapparaît après rechargement');
    console.log('Budget : plafond persisté, dépenses distinctes des économies, dépassement, référence sourcée et annulation vérifiés.');
    assert(errors.length === 0, `Erreurs navigateur : ${errors.join(', ')}`);
    console.log('Hub : 4 onglets × 5 largeurs sans débordement ; annulations aller/retour/ponctuel persistées après rechargement.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/trips-failure.png' });
    throw error;
} finally {
    await context.request.delete(`${baseURL}/api/me`).catch(() => undefined);
    await browser.close();
}
