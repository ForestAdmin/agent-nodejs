import type { AccountsCustomizer } from '../typings';

import sequelizePostgres from '../../connections/sequelize-postgres';

const LARGE_AMOUNT = 1000;
const URGENT_AMOUNT = 5000;
const CONFIRMATION_AMOUNT = 10000;

export default (collection: AccountsCustomizer) =>
  collection
    .addOneToManyRelation('cards', 'cards', { originKey: 'account_id' })
    .addOneToManyRelation('transactions', 'transactions', { originKey: 'account_id' })

    .addAction('Raise the overdraft limit', {
      scope: 'Bulk',
      form: [{ label: 'percentage', type: 'Number', defaultValue: 10, isRequired: true }],
      execute: async (context, resultBuilder) => {
        const replacements = {
          multiplier: 1 + context.formValues.percentage / 100,
          ids: await context.getRecordIds(),
        };

        await sequelizePostgres.query(
          'UPDATE accounts SET overdraft_limit = CAST(overdraft_limit * :multiplier AS DECIMAL(14, 2)) WHERE id IN (:ids)',
          { replacements },
        );

        return resultBuilder.success('Overdraft limit raised');
      },
    })
    .addAction('Test Dynamic Form', {
      scope: 'Single',
      form: [
        {
          label: 'Operation type',
          type: 'Enum',
          enumValues: ['Transfer', 'Withdrawal', 'Deposit'],
          isRequired: true,
        },
        {
          label: 'Amount',
          type: 'Number',
          isRequired: true,
          defaultValue: 100,
        },
        {
          label: 'Destination account',
          type: 'String',
          if: ctx => ctx.formValues['Operation type'] === 'Transfer',
          isRequired: ctx => ctx.formValues['Operation type'] === 'Transfer',
        },
        {
          label: 'Transfer reference',
          type: 'String',
          if: ctx => ctx.formValues['Operation type'] === 'Transfer',
          isRequired: ctx =>
            ctx.formValues['Operation type'] === 'Transfer' &&
            (ctx.formValues.Amount || 0) > LARGE_AMOUNT,
          description: ctx =>
            (ctx.formValues.Amount || 0) > LARGE_AMOUNT
              ? `Required for transfers over ${LARGE_AMOUNT}`
              : 'Optional for small transfers',
        },
        {
          label: 'Withdrawal reason',
          type: 'Enum',
          enumValues: ['Personal', 'Business', 'Emergency'],
          if: ctx => ctx.formValues['Operation type'] === 'Withdrawal',
        },
        {
          label: 'Priority',
          type: 'Enum',
          enumValues: ctx => {
            const amount = ctx.formValues.Amount || 0;
            if (amount > URGENT_AMOUNT) return ['Standard', 'Express', 'Urgent'];

            return ['Standard', 'Express'];
          },
          defaultValue: 'Standard',
        },
        {
          label: 'Confirm large amount',
          type: 'Boolean',
          if: ctx => (ctx.formValues.Amount || 0) > CONFIRMATION_AMOUNT,
          isRequired: ctx => (ctx.formValues.Amount || 0) > CONFIRMATION_AMOUNT,
          description: `You must confirm operations over ${CONFIRMATION_AMOUNT}`,
        },
      ],
      execute: async (context, resultBuilder) => {
        const values = context.formValues;

        return resultBuilder.success(
          `Operation ${values['Operation type']} of ${values.Amount} processed`,
        );
      },
    });
