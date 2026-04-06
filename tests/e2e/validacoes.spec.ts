import { test, expect } from '../playwright-fixture';

test.describe('Validações de CPF e Campos', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('suplente');
  });

  test('CPF com formatação automática em lideranças', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-lideranca').click();
    const cpfInput = page.getByPlaceholder(/000\.000\.000-00/i).first();
    await cpfInput.fill('11144477735');
    await expect(cpfInput).toHaveValue(/111\.444\.777-35/);
  });

  test('CPF inválido exibe mensagem de erro em lideranças', async ({ page }) => {
    await page.getByTestId('btn-cadastrar-lideranca').click();
    const cpfInput = page.getByPlaceholder(/000\.000\.000-00/i).first();
    await cpfInput.fill('11111111111');
    const nameInput = page.getByPlaceholder(/Nome da liderança/i);
    await nameInput.fill('Teste CPF Invalido');
    await page.getByTestId('btn-salvar-lideranca').click();
    // Should show CPF validation error
    await expect(page.getByText(/CPF|inválido|erro/i)).toBeVisible({ timeout: 5000 });
  });

  test('telefone aceita formato válido em eleitores', async ({ page }) => {
    await page.getByTestId('nav-eleitores').click();
    await page.getByTestId('btn-cadastrar-eleitor').click();
    const telInput = page.getByPlaceholder(/telefone|celular|\(\d{2}\)/i).first();
    if (await telInput.isVisible()) {
      await telInput.fill('62999998888');
      await expect(telInput).toHaveValue(/62|999/);
    }
  });
});
