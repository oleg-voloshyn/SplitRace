import { expect, test } from '@playwright/test';
import { seedAdminCatalog } from './helpers';

test('admin can sign in and search core resources', async ({ page }) => {
  const catalog = seedAdminCatalog(`e2e-admin-${Date.now()}`);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'SplitRace' })).toBeVisible();

  await page.getByLabel('Email').fill(catalog.admin_email);
  await page.getByLabel('Password').fill(catalog.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const sidebar = page.locator('.sidebar');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Pending tournament reviews')).toBeVisible();

  await page.getByRole('link', { name: /tournaments/i }).click();
  await expect(page.getByRole('heading', { name: 'Tournaments' })).toBeVisible();
  await page.getByPlaceholder('Search by name, status, city, country, description').fill(catalog.tournament_name);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('link', { name: catalog.tournament_name })).toBeVisible();
  await expect(page.getByText('pending_review')).toBeVisible();
  await expect(page.getByText('Review', { exact: true })).toBeVisible();

  await sidebar.getByRole('link', { name: /^segments$/i }).click();
  await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  await page.getByPlaceholder('Search by name, city, country, description').fill(catalog.segment_name);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(catalog.segment_name)).toBeVisible();
  await expect(page.getByText('Kyiv, UA')).toBeVisible();

  await sidebar.getByRole('link', { name: /^users$/i }).click();
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await page.getByPlaceholder('Search by name, email, role, city, country').fill(catalog.admin_email);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(catalog.admin_email)).toBeVisible();
  await expect(page.getByText('admin', { exact: true })).toBeVisible();
});
