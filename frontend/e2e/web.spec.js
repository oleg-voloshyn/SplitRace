import { expect, test } from '@playwright/test';
import { mockMapNetwork, password, registerViaApi, seedAdminCatalog, uniqueEmail } from './helpers';

test('landing page starts club registration flow', async ({ page }) => {
  const email = uniqueEmail('e2e-club');

  await page.goto('/');
  const clubRegisterLink = page.getByRole('link', { name: /register a running club/i }).first();
  await expect(clubRegisterLink).toBeVisible();

  await clubRegisterLink.click();
  await expect(page).toHaveURL(/\/login\?mode=register&type=club/);
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  await expect(page.getByLabel('Running club')).toBeChecked();
  await expect(page.getByPlaceholder('First Name')).toHaveCount(0);
  await expect(page.getByPlaceholder('Last Name')).toHaveCount(0);
  await expect(page.getByText('Gender *')).toHaveCount(0);
  await expect(page.getByText('Or continue with')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Google' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Apple' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Strava' })).toHaveCount(0);

  await page.getByPlaceholder('Club name').fill('E2E Running Club');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page).toHaveURL(/\/tournaments/);
  await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
});

test('runner auth offers Google and Apple without Strava', async ({ page }) => {
  await page.goto('/login?mode=register');

  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Apple' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Strava' })).toHaveCount(0);
});

test('runner can join active tournament and open tournament detail', async ({ page, request }) => {
  const catalog = seedAdminCatalog(`e2e-web-${Date.now()}`);
  await registerViaApi(request, page, { email: uniqueEmail('e2e-joiner') });

  await page.goto('/tournaments');
  await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
  await expect(page.getByText(catalog.active_tournament_name)).toBeVisible();

  const card = page.locator('.sr-card', { hasText: catalog.active_tournament_name });
  await card.getByRole('button', { name: 'Join Tournament' }).click();
  await expect(card.getByText(/joined/i)).toBeVisible();

  await page.getByRole('heading', { name: catalog.active_tournament_name }).click();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${catalog.active_tournament_slug}`));
  await expect(page.getByRole('heading', { name: catalog.active_tournament_name })).toBeVisible();
  await expect(page.getByLabel('Share tournament')).toBeVisible();
  await expect(page.getByText('Leaderboard')).toBeVisible();
});

test('profile edit saves runner details', async ({ page, request }) => {
  await registerViaApi(request, page, { email: uniqueEmail('e2e-profile') });

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByPlaceholder('First Name').fill('Edited');
  await page.getByPlaceholder('Last Name').fill('Runner');
  await page.getByLabel('Units:').selectOption('miles');
  await page.getByPlaceholder('Country').fill('UA');
  await page.getByPlaceholder('City').fill('Cherkasy');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Edited Runner' })).toBeVisible();
  await expect(page.getByText('Miles')).toBeVisible();
  await expect(page.getByText('Cherkasy')).toBeVisible();
});

test('creator can draw a segment on the map and submit rich text description', async ({ page, request }) => {
  await mockMapNetwork(page);
  await registerViaApi(request, page, { email: uniqueEmail('e2e-creator') });

  await page.goto('/creator');
  await expect(page.getByRole('heading', { name: 'Create' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /New segment/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /New tournament/i })).toHaveAttribute('href', '/creator/tournaments/new');

  await page.getByRole('link', { name: /New segment/i }).click();
  await expect(page).toHaveURL(/\/creator\/segments\/new/);
  await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'Create' })).toBeVisible();
  await page.getByPlaceholder('Segment name').fill(`E2E Map Segment ${Date.now()}`);
  await page.locator('[contenteditable="true"]').fill('Safe rich text from Playwright');

  const map = page.locator('.sr-creator-map');
  await expect(map).toBeVisible();
  // Spread the two clicks far enough that the resulting route clears
  // Segment::MIN_DISTANCE_METERS (400 m) regardless of map zoom in CI.
  await map.click({ position: { x: 40, y: 40 } });
  await map.click({ position: { x: 520, y: 360 } });
  await expect(page.getByText(/Route points:\s*2/)).toBeVisible();

  await page.getByRole('button', { name: 'Create segment' }).click();
  await expect(page.getByText('Segment created')).toBeVisible();
});

test('creator can create a tournament through the five step wizard', async ({ page, request }) => {
  const auth = await registerViaApi(request, page, { email: uniqueEmail('e2e-tournament-creator') });
  const prefix = `E2E Wizard ${Date.now()}`;

  for (let index = 1; index <= 4; index += 1) {
    // ~1.1 km north/south between the two points clears the 400 m server-side
    // minimum that Segment::MIN_DISTANCE_METERS enforces.
    const response = await request.post('/api/v1/segments', {
      headers: { Authorization: `Bearer ${auth.token}` },
      data: {
        name: `${prefix} Segment ${index}`,
        city: 'Kyiv',
        country: 'UA',
        points: [
          { lat: 50.45 + index / 100, lng: 30.52 },
          { lat: 50.46 + index / 100, lng: 30.521 }
        ]
      }
    });

    expect(response.ok()).toBeTruthy();
  }

  await page.goto('/creator/tournaments/new');
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await page.getByPlaceholder('Example: Cherkasy Spring Challenge').fill(`${prefix} Tournament`);
  await page.getByRole('button', { name: /next/i }).click();

  await expect(page.getByText('Step 2 of 5')).toBeVisible();
  await page.locator('[contenteditable="true"]').fill('Tournament wizard description');
  await page.getByRole('button', { name: /next/i }).click();

  await expect(page.getByText('Step 3 of 5')).toBeVisible();
  await page.getByPlaceholder('Country').fill('UA');
  await page.getByPlaceholder('City').fill('Kyiv');
  await page.getByRole('button', { name: /next/i }).click();

  await expect(page.getByText('Step 4 of 5')).toBeVisible();
  await page.getByRole('button', { name: /next/i }).click();

  await expect(page.getByText('Step 5 of 5')).toBeVisible();
  for (let index = 1; index <= 4; index += 1) {
    await page
      .locator('.sr-wizard-segment-row:not(.selected)', { hasText: `${prefix} Segment ${index}` })
      .getByRole('button', { name: '+' })
      .click();
  }

  await expect(page.getByText('4 / 4 selected')).toBeVisible();
  await page.locator('.sr-wizard-segment-row.selected').nth(0).getByRole('checkbox').check();
  await page.locator('.sr-wizard-segment-row.selected').nth(1).getByRole('checkbox').check();
  await expect(page.getByText('2 / 2 rated')).toBeVisible();

  await page.getByRole('button', { name: 'Create tournament' }).click();
  await expect(page.getByText('Tournament created')).toBeVisible();
});
