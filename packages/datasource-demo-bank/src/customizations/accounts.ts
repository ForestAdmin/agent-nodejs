import { tables } from '../model/schema';

// The freeze reasons are the dropdown of accounts.freeze_reason in the data model.
const FREEZE_REASONS = tables.accounts.fields.find(f => f.name === 'freeze_reason').enum;

/** Accounts: freeze and unfreeze. */
export default function customizeAccounts(collection) {
  collection.addAction('Freeze account', {
    scope: 'Single',
    form: [
      { label: 'Reason', type: 'Enum', enumValues: FREEZE_REASONS, isRequired: true },
      { label: 'Note', type: 'String' },
    ],
    execute: async (context, resultBuilder) => {
      const account = await context.getRecord(['id', 'iban', 'status']);

      if (account.status === 'FROZEN' || account.status === 'CLOSED') {
        return resultBuilder.error(
          `Account ${account.iban} is ${account.status.toLowerCase()} already.`,
        );
      }

      const { Reason: reason, Note: note } = context.formValues;
      await context.collection.update(context.filter, {
        status: 'FROZEN',
        frozen_at: new Date().toISOString(),
        freeze_reason: reason,
        freeze_note: note || null,
      });

      return resultBuilder.success(`Account ${account.iban} frozen (${reason}).`);
    },
  });

  collection.addAction('Unfreeze account', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const account = await context.getRecord(['id', 'iban', 'status', 'freeze_reason']);

      if (account.status !== 'FROZEN') {
        return resultBuilder.error(`Account ${account.iban} is not frozen.`);
      }

      // The rule: a SAR freeze holds until TRACFIN's answer is recorded on the SAR.
      if (account.freeze_reason === 'SAR_FILED') {
        return resultBuilder.error(
          `Account ${account.iban} is frozen since a SAR was filed: it opens again once TRACFIN's answer is recorded on the SAR.`,
        );
      }

      await context.collection.update(context.filter, {
        status: 'ACTIVE',
        frozen_at: null,
        freeze_reason: null,
        freeze_note: null,
      });

      return resultBuilder.success(`Account ${account.iban} is active again.`);
    },
  });
}
