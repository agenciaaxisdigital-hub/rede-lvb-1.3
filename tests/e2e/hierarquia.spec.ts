import { test, expect } from '../playwright-fixture';

test.describe('Hierarquia e Gestão de Usuários (Admin)', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('super_admin');
  });

  test('admin vê aba de perfil com opções de gestão', async ({ page }) => {
    await page.getByTestId('nav-perfil').click();
    await expect(page.getByRole('button', { name: /sair|logout|desconectar/i })).toBeVisible();
  });

  test('admin vê todas as abas de navegação', async ({ page }) => {
    await expect(page.getByTestId('nav-liderancas')).toBeVisible();
    await expect(page.getByTestId('nav-eleitores')).toBeVisible();
    await expect(page.getByTestId('nav-cadastros')).toBeVisible();
    await expect(page.getByTestId('nav-perfil')).toBeVisible();
  });

  test('admin acessa painel administrativo', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin');
  });
});

test.describe('Acesso por Perfil — Coordenador', () => {
  test('coordenador faz login e acessa home', async ({ loginAs, page }) => {
    await loginAs('coordenador');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Acesso por Perfil — Liderança', () => {
  test('liderança faz login e acessa home', async ({ loginAs, page }) => {
    await loginAs('lideranca');
    await expect(page).toHaveURL('/');
  });
});
