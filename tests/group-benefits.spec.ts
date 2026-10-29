import { expect, test as base } from '@playwright/test';
import { BenefitsPage } from '../pages/BenefitsPage';
import { LoginPage } from '../pages/LoginPage';

type BenefitsFixtures = {
  loginPage: LoginPage;
  benefitsPage: BenefitsPage;
  authenticatedBenefitsPage: BenefitsPage;
};

const test = base.extend<BenefitsFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  benefitsPage: async ({ page }, use) => {
    await use(new BenefitsPage(page));
  },
  authenticatedBenefitsPage: async ({ loginPage, benefitsPage }, use) => {
    const email = process.env.BENEFITS_TEST_EMAIL || 'test.user@example.com';
    const password = process.env.BENEFITS_TEST_PASSWORD || 'TestPassword123!';

    await loginPage.goto();
    await loginPage.login(email, password);
    await use(benefitsPage);
  },
});

test.describe('Group Benefits Portal', () => {
  test('shows available health and dental coverage balances', async ({
    authenticatedBenefitsPage,
  }) => {
    const healthBalance = await authenticatedBenefitsPage.readRemainingBalance('Health');
    const dentalBalance = await authenticatedBenefitsPage.readRemainingBalance('Dental');

    expect(healthBalance).toBeGreaterThan(0);
    expect(dentalBalance).toBeGreaterThan(0);
  });

  for (const benefit of ['Health', 'Dental'] as const) {
    test(`submits a ${benefit.toLowerCase()} claim within its coverage limit`, async ({
      authenticatedBenefitsPage,
    }) => {
      const balance = await authenticatedBenefitsPage.readRemainingBalance(benefit);
      const claimAmount = Math.floor(Math.min(1, balance) * 100) / 100;

      expect(claimAmount).toBeGreaterThan(0);
      await authenticatedBenefitsPage.submitClaim(
        benefit,
        claimAmount,
        `Automated ${benefit.toLowerCase()} test claim`,
      );

      await expect(authenticatedBenefitsPage.claimConfirmation).toBeVisible();
    });

    test(`rejects a ${benefit.toLowerCase()} claim above its coverage limit`, async ({
      authenticatedBenefitsPage,
    }) => {
      const balance = await authenticatedBenefitsPage.readRemainingBalance(benefit);
      const overLimitAmount = Math.round((balance + 0.01) * 100) / 100;

      await authenticatedBenefitsPage.submitClaim(
        benefit,
        overLimitAmount,
        `Automated over-limit ${benefit.toLowerCase()} test claim`,
      );

      await expect(authenticatedBenefitsPage.claimError).toContainText(/exceeds|limit/i);
    });
  }
});
