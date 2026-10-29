import type { Locator, Page } from '@playwright/test';

export type BenefitType = 'Health' | 'Dental';

export class BenefitsPage {
  private readonly healthBalance: Locator;
  private readonly dentalBalance: Locator;
  private readonly benefitTypeSelect: Locator;
  private readonly claimAmountInput: Locator;
  private readonly claimDescriptionInput: Locator;
  private readonly submitClaimButton: Locator;
  readonly claimError: Locator;
  readonly claimConfirmation: Locator;

  constructor(page: Page) {
    this.healthBalance = page.getByLabel('Health remaining balance');
    this.dentalBalance = page.getByLabel('Dental remaining balance');
    this.benefitTypeSelect = page.getByLabel('Benefit type');
    this.claimAmountInput = page.getByLabel('Claim amount');
    this.claimDescriptionInput = page.getByLabel('Claim description');
    this.submitClaimButton = page.getByRole('button', {
      name: 'Submit claim',
      exact: true,
    });
    this.claimError = page.getByRole('alert');
    this.claimConfirmation = page.getByRole('status').filter({
      hasText: /claim submitted successfully/i,
    });
  }

  async readRemainingBalance(benefit: BenefitType): Promise<number> {
    const balanceLocator = benefit === 'Health' ? this.healthBalance : this.dentalBalance;
    const balanceText = await balanceLocator.innerText();
    const balance = Number(balanceText.replace(/[^\d.-]/g, ''));

    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error(`Could not read a valid ${benefit.toLowerCase()} balance from "${balanceText}".`);
    }

    return balance;
  }

  async submitClaim(
    benefit: BenefitType,
    amount: number,
    description: string,
  ): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError(`Claim amount must be a positive number; received ${amount}.`);
    }

    await this.benefitTypeSelect.selectOption(benefit);
    await this.claimAmountInput.fill(amount.toFixed(2));
    await this.claimDescriptionInput.fill(description);
    await this.submitClaimButton.click();
  }
}
