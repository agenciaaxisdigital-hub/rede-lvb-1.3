import { test, expect } from '../playwright-fixture';

test.describe('Funcionalidade Offline', () => {
  test('app abre mesmo com rede desligada após login', async ({ loginAs, page, context }) => {
    // Login online first
    await loginAs('suplente');
    await expect(page).toHaveURL('/');

    // Go offline
    await context.setOffline(true);

    // Reload — should open (from SW cache / persisted query)
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Should NOT show blank white page — at minimum the loading screen or cached data
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('dados persistidos aparecem offline na aba cadastros', async ({ loginAs, page, context }) => {
    await loginAs('suplente');
    await page.getByTestId('nav-cadastros').click();
    // Let data load
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Navigate to cadastros — should still show something (cached or empty state)
    await page.getByTestId('nav-cadastros').click();
    await expect(page.getByText(/Total|Nenhum|Cadastros/i)).toBeVisible({ timeout: 5000 });
  });
});
