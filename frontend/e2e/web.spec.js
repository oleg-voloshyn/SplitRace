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
  await expect(page.getByRole('heading', { name: 'Tournaments' })).toBeVisible();
});

test('runner can join active tournament and open tournament detail', async ({ page, request }) => {
  const catalog = seedAdminCatalog(`e2e-web-${Date.now()}`);
  await registerViaApi(request, page, { email: uniqueEmail('e2e-joiner') });

  await page.goto('/tournaments');
  await expect(page.getByRole('heading', { name: 'Tournaments' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Create' })).toBeVisible();

  await page.getByRole('button', { name: 'New segment' }).click();
  await page.getByPlaceholder('Segment name').fill(`E2E Map Segment ${Date.now()}`);
  await page.locator('[contenteditable="true"]').fill('Safe rich text from Playwright');

  const map = page.locator('.sr-creator-map');
  await expect(map).toBeVisible();
  await map.click({ position: { x: 180, y: 170 } });
  await map.click({ position: { x: 260, y: 220 } });
  await expect(page.getByText(/Route points:\s*2/)).toBeVisible();

  await page.getByRole('button', { name: 'Create segment' }).click();
  await expect(page.getByText('Segment created')).toBeVisible();
});
