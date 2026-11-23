import type { AccountsCustomizer } from '../typings';

import { randomUUID } from 'crypto';

import { demoFields } from '../../connections/data-model';
import sequelizePostgres from '../../connections/sequelize-postgres';

const LARGE_AMOUNT = 1000;
const URGENT_AMOUNT = 5000;
const CONFIRMATION_AMOUNT = 10000;
const OPERATIONS = {
  Transfer: { direction: 'DEBIT', rail: 'TRANSFER', category: 'TRANSFERS' },
  Withdrawal: { direction: 'DEBIT', rail: 'CARD', category: 'CASH' },
  Deposit: { direction: 'CREDIT', rail: 'INTERNAL', category: 'OTHER' },
};

const FREEZE_REASONS = demoFields('accounts').find(field => field.name === 'freeze_reason').enum;
const CLOSED_OR_FROZEN = ['FROZEN', 'CLOSED'];

const BOOKING_FIELDS = [
  'id',
  'iban',
  'status',
  'currency',
  'balance',
  'available_balance',
] as const;

const byId = (id: string) => ({ conditionTree: { field: 'id', operator: 'Equal', value: id } });

async function book(context, account, entry: Record<string, unknown>) {
  const now = new Date().toISOString();
  const signedAmount = entry.direction === 'DEBIT' ? -entry.amount : entry.amount;
  const balanceAfter = Number(account.balance) + (signedAmount as number);

  await context.dataSource.getCollection('transactions').create([
    {
      id: randomUUID(),
      account_id: account.id,
      currency: account.currency,
      status: 'BOOKED',
      booked_at: now,
      created_at: now,
      value_date: now.slice(0, 10),
      balance_after: balanceAfter,
      ...entry,
    },
  ]);
  await context.dataSource.getCollection('accounts').update(byId(account.id), {
    balance: balanceAfter,
    available_balance: Number(account.available_balance) + (signedAmount as number),
    last_activity_at: now,
  });
}

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
    .addAction('Book an operation', {
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
          description: 'IBAN of the destination account',
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
        const type = values['Operation type'] as keyof typeof OPERATIONS;
        const amount = values.Amount as number;
        const { direction, rail, category } = OPERATIONS[type];
        const account = await context.getRecord([...BOOKING_FIELDS, 'overdraft_limit']);

        if (account.status !== 'ACTIVE') {
          return resultBuilder.error(`Account ${account.iban} is ${account.status}`);
        }

        if (
          direction === 'DEBIT' &&
          amount > Number(account.available_balance) + Number(account.overdraft_limit ?? 0)
        ) {
          return resultBuilder.error(`Insufficient funds on ${account.iban}`);
        }

        const description = `${type} (${values.Priority})${
          values['Withdrawal reason'] ? `: ${values['Withdrawal reason']}` : ''
        }`;

        if (type === 'Transfer') {
          const [destination] = await context.dataSource.getCollection('accounts').list(
            {
              conditionTree: {
                field: 'iban',
                operator: 'Equal',
                value: values['Destination account'],
              },
            },
            [...BOOKING_FIELDS],
          );

          if (!destination) {
            return resultBuilder.error(`No account with IBAN ${values['Destination account']}`);
          }

          if (destination.id === account.id) {
            return resultBuilder.error('A transfer needs a destination other than the source');
          }

          const reference = (values['Transfer reference'] as string) || null;
          await book(context, account, {
            direction,
            rail,
            category,
            amount,
            description,
            reference,
          });
          await book(context, destination, {
            direction: 'CREDIT',
            rail,
            category,
            amount,
            description: `Transfer from ${account.iban}`,
            reference,
          });

          return resultBuilder.success(`${amount} transferred to ${destination.iban}`);
        }

        await book(context, account, { direction, rail, category, amount, description });

        return resultBuilder.success(`${type} of ${amount} booked on ${account.iban}`);
      },
    })
    .addAction('Freeze account', {
      scope: 'Single',
      form: [
        { label: 'Reason', type: 'Enum', enumValues: FREEZE_REASONS, isRequired: true },
        { label: 'Note', type: 'String' },
      ],
      execute: async (context, resultBuilder) => {
        const account = await context.getRecord(['id', 'iban', 'status']);

        if (CLOSED_OR_FROZEN.includes(account.status)) {
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
    })
    .addAction('Unfreeze account', {
      scope: 'Single',
      execute: async (context, resultBuilder) => {
        const account = await context.getRecord(['id', 'iban', 'status', 'freeze_reason']);

        if (account.status !== 'FROZEN') {
          return resultBuilder.error(`Account ${account.iban} is not frozen.`);
        }

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
