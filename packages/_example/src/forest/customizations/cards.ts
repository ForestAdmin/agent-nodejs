import type { CardsCustomizer } from '../typings';

import { randomInt, randomUUID } from 'crypto';

import { demoFields } from '../../connections/data-model';

const BLOCKED_REASONS = demoFields('cards').find(field => field.name === 'blocked_reason').enum;
const REASONS_THAT_NEED_A_NEW_CARD = ['LOST', 'STOLEN'];
const AML_FREEZE = 'AML_FREEZE';
const SYSTEMATIC_CHECK_THRESHOLD = 1000;
const CARD_TYPES = demoFields('cards').find(field => field.name === 'card_type').enum;
const CARD_VALIDITY_IN_YEARS = 3;
const LAST_FOUR_DIGITS_UPPER_BOUND = 10000;

export default (collection: CardsCustomizer) =>
  collection
    .removeField('card_token')
    .addManyToOneRelation('account', 'accounts', { foreignKey: 'account_id' })
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('holder', 'individuals', { foreignKey: 'holder_id' })
    .addOneToManyRelation('card_transactions', 'card_transactions', { originKey: 'card_id' })
    .importField('holder_full_name', { path: 'holder:full_name' })

    .addAction('Freeze card', {
      scope: 'Single',
      form: [{ label: 'Reason', type: 'Enum', enumValues: BLOCKED_REASONS, isRequired: true }],
      execute: async (context, resultBuilder) => {
        const card = await context.getRecord(['status', 'last_four_digits']);

        if (card.status !== 'ACTIVE') {
          return resultBuilder.error(
            `Only an active card can be frozen, this one is ${card.status}`,
          );
        }

        await context.collection.update(context.filter, {
          status: 'BLOCKED',
          blocked_at: new Date().toISOString(),
          blocked_reason: context.formValues.Reason,
        });

        return resultBuilder.success(`Card ending ${card.last_four_digits} frozen`);
      },
    })
    .addAction('Unfreeze card', {
      scope: 'Single',
      execute: async (context, resultBuilder) => {
        const card = await context.getRecord([
          'status',
          'blocked_reason',
          'last_four_digits',
          'account:status',
        ]);

        if (card.status !== 'BLOCKED') {
          return resultBuilder.error(
            `Only a frozen card can be unfrozen, this one is ${card.status}`,
          );
        }

        if (REASONS_THAT_NEED_A_NEW_CARD.includes(card.blocked_reason)) {
          return resultBuilder.error(
            `A card blocked as ${card.blocked_reason} cannot be unfrozen: issue a new card`,
          );
        }

        if (card.blocked_reason === AML_FREEZE) {
          return resultBuilder.error(
            "A card blocked by an AML freeze is released with TRACFIN's answer on the SAR",
          );
        }

        if (card.account?.status !== 'ACTIVE') {
          return resultBuilder.error(`The card's account is ${card.account?.status}`);
        }

        await context.collection.update(context.filter, {
          status: 'ACTIVE',
          blocked_at: null,
          blocked_reason: null,
        });

        return resultBuilder.success(`Card ending ${card.last_four_digits} unfrozen`);
      },
    })
    .addAction('Create new card', {
      scope: 'Global',
      execute: async (context, resultBuilder) => {
        const [accountId] = context.formValues.Account as string[];
        const accounts = context.dataSource.getCollection('accounts');
        const [account] = await accounts.list(
          { conditionTree: { field: 'id', operator: 'Equal', value: accountId } },
          ['id', 'iban', 'status', 'customer_id'],
        );

        if (account.status !== 'ACTIVE') {
          return resultBuilder.error(
            `A card can only be issued on an active account, ${account.iban} is ${account.status}`,
          );
        }

        const [holder] = await context.dataSource.getCollection('customer_members').list(
          {
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { field: 'customer_id', operator: 'Equal', value: account.customer_id },
                { field: 'role', operator: 'Equal', value: 'HOLDER' },
              ],
            },
          },
          ['individual_id'],
        );
        const [individual] = holder
          ? await context.dataSource
              .getCollection('individuals')
              .list(
                { conditionTree: { field: 'id', operator: 'Equal', value: holder.individual_id } },
                ['first_name', 'last_name'],
              )
          : [];

        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setFullYear(now.getFullYear() + CARD_VALIDITY_IN_YEARS);
        const lastFourDigits = String(randomInt(LAST_FOUR_DIGITS_UPPER_BOUND)).padStart(4, '0');

        await context.collection.create([
          {
            id: randomUUID(),
            account_id: account.id,
            customer_id: account.customer_id,
            holder_id: holder?.individual_id ?? null,
            card_type: context.formValues['Card type'],
            network: 'VISA',
            status: 'PENDING',
            issued_at: now.toISOString(),
            expires_at: expiresAt.toISOString().slice(0, 10),
            last_four_digits: lastFourDigits,
            embossed_name: individual
              ? `${individual.first_name} ${individual.last_name}`.toUpperCase()
              : null,
          },
        ]);
        await accounts.update(
          { conditionTree: { field: 'id', operator: 'Equal', value: account.id } },
          {
            plan: (context.formValues.Plan as string).toUpperCase() as
              | 'STANDARD'
              | 'PREMIUM'
              | 'METAL',
          },
        );

        return resultBuilder.success(
          `${context.formValues.Plan} card ending ${lastFourDigits} issued on ${account.iban}`,
        );
      },
      form: [
        {
          type: 'Layout',
          component: 'Page',
          elements: [
            {
              type: 'Collection',
              label: 'Account',
              collectionName: 'accounts',
              isRequired: true,
            },
            {
              type: 'Enum',
              label: 'Card type',
              enumValues: CARD_TYPES,
              defaultValue: 'PHYSICAL',
              isRequired: true,
            },
            {
              type: 'String',
              label: 'Card plan',
              id: 'Plan',
              widget: 'Dropdown',
              options: ['Standard', 'Premium', 'Metal'],
              isRequired: true,
            },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: ctx => {
                if (!ctx.formValues.Plan) {
                  return 'Please select a card plan';
                }

                let info = '';

                switch (ctx.formValues.Plan) {
                  case 'Standard':
                    info = `
                            <li>price</li>
                            <li>max withdraw / max payment</li>`;
                    break;
                  case 'Premium':
                    info = `<li>max payment / Systematic check (if max payment > ${SYSTEMATIC_CHECK_THRESHOLD})</li>
                            <li>discount / discount months</li>`;
                    break;
                  case 'Metal':
                    info = `<li>max withdraw</li>`;
                    break;
                  default:
                }

                return `
                  <h3>The <b>${ctx.formValues.Plan}</b> plan requires the following info to be provided:</h3>
                  <ul>${info}</ul>
                  <p>You will be asked to provide them in the next pages</p>
                  `;
              },
            },
          ],
        },
        {
          type: 'Layout',
          component: 'Page',
          nextButtonLabel: 'go to next page',
          previousButtonLabel: 'go to previous page',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: 'This is an empty page',
            },
          ],
        },
        {
          type: 'Layout',
          component: 'Page',
          elements: [],
        },
        {
          type: 'Layout',
          component: 'Page',
          elements: [
            {
              type: 'Number',
              label: 'price',
              defaultValue: 40,
            },
            { type: 'Layout', component: 'Separator' },
            { type: 'Layout', component: 'HtmlBlock', content: '<h3>constraints:</h3>' },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  type: 'Number',
                  label: 'Max withdraw',
                  if: ctx => ['Standard', 'Metal'].includes(ctx.formValues.Plan),
                },
                {
                  type: 'Number',
                  label: 'Max payment',
                  if: ctx => ['Standard', 'Premium'].includes(ctx.formValues.Plan),
                },
                {
                  type: 'Boolean',
                  label: 'Systematic check',
                  if: ctx =>
                    ['Standard', 'Premium'].includes(ctx.formValues.Plan) &&
                    ctx.formValues['Max payment'] > SYSTEMATIC_CHECK_THRESHOLD,
                },
              ],
            },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  type: 'Number',
                  label: 'Discount',
                  widget: 'NumberInput',
                  min: 0,
                  max: 1,
                  description: ctx => `${(ctx.formValues.Discount || 0) * 100}%`,
                  if: ctx => ['Premium'].includes(ctx.formValues.Plan),
                },
                {
                  type: 'Number',
                  widget: 'NumberInput',
                  label: 'Discount duration',
                  min: 1,
                  step: 1,
                  max: 12,
                  description: 'How long should the discount apply for (in month)',
                  if: ctx => ['Premium'].includes(ctx.formValues.Plan),
                },
              ],
            },
          ],
        },
      ],
    });
