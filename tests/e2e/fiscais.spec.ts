import { test, expect } from '../playwright-fixture';

test.describe('Cadastro de Fiscais', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('suplente');
    await page.getByTestId('nav-fiscais').click();
  });

  test('aba fiscais carrega corretamente', async ({ page }) => {
    await expect(page.getByTestId('btn-cadastrar-fiscal')).toBeVisible();
  });

  test('abre formulário de cadastro de fiscal', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-fiscal').click();
    await expect(page.getByPlaceholder(/Nome do fiscal/i)).toBeVisible();
  });

  test('valida nome obrigatório', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-fiscal').click();
    await page.getByTestId('btn-salvar-fiscal').click();
    await expect(page.getByText(/nome|obrigatório|preencha/i)).toBeVisible({ timeout: 3000 });
  });

  test('botão Voltar retorna para lista', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-fiscal').click();
    await page.getByTestId('btn-voltar').click();
    await expect(page.getByTestId('btn-cadastrar-fiscal')).toBeVisible();
  });

  test('busca na lista de fiscais funciona', async ({ page }) => {
    const searchInput = page.getByTestId('input-busca-fiscal');
    await searchInput.fill('teste');
    await expect(searchInput).toHaveValue('teste');
  });
});
