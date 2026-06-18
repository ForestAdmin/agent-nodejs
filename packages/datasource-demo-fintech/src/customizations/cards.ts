import type { CollectionCustomizer, TSchema } from '@forestadmin/datasource-customizer';

import { byId, byIds, now } from './utils';

export default function customizeCards(collection: CollectionCustomizer<TSchema, 'cards'>): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addOneToManyRelation('chargebacks', 'chargebacks', { originKey: 'card_id' });

  // Block one or more cards (bulk).
  collection.addAction('Block Card', {
    scope: 'Bulk',
    form: [
      {
        label: 'Info',
        type: 'String',
        isReadOnly: true,
        isRequired: false,
        value: async context => {
          const count = await context.collection.aggregate(context.filter, { operation: 'Count' });

          return `This action will block ${count[0]?.value ?? 0} card(s).`;
        },
      },
      {
        label: 'Block Reason',
        type: 'Enum',
        enumValues: ['LOST', 'STOLEN', 'FRAUD', 'AML_FREEZE', 'CUSTOMER_REQUEST'],
        isRequired: true,
      },
    ],
    execute: async (context, resultBuilder) => {
      const ids = await context.getRecordIds();
      const reason = context.formValues['Block Reason'];

      await context.collection.update(byIds(ids), {
        status: 'BLOCKED',
        blocked_reason: reason,
        blocked_at: now(),
      });

      return resultBuilder.success(`${ids.length} card(s) blocked (${reason}).`);
    },
  });

  // Unblock one or more cards (bulk).
  collection.addAction('Unblock Card', {
    scope: 'Bulk',
    form: [
      {
        label: 'Info',
        type: 'String',
        isReadOnly: true,
        isRequired: false,
        value: async context => {
          const count = await context.collection.aggregate(context.filter, { operation: 'Count' });

          return `This action will unblock ${count[0]?.value ?? 0} card(s).`;
        },
      },
      { label: 'Unblock Reason', type: 'String', isRequired: false },
    ],
    execute: async (context, resultBuilder) => {
      const ids = await context.getRecordIds();

      await context.collection.update(byIds(ids), {
        status: 'ACTIVE',
        blocked_reason: null,
        blocked_at: null,
      });

      return resultBuilder.success(`${ids.length} card(s) reactivated.`);
    },
  });

  // Cancel a card and issue a fresh one for the same account.
  collection.addAction('Replace Card', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const card = await context.getRecord(['customer_id', 'card_type', 'status']);

      await context.collection.update(byId(id), { status: 'CANCELLED' });

      const lastFour = String(Math.floor(1000 + Math.random() * 9000));
      const expiry = new Date();
      expiry.setUTCFullYear(expiry.getUTCFullYear() + 3);

      // id is auto-assigned by the in-memory collection when omitted.
      await context.collection.create([
        {
          customer_id: card.customer_id,
          card_type: card.card_type,
          status: 'ACTIVE',
          last_four_digits: lastFour,
          issued_at: now(),
          expires_at: expiry.toISOString().slice(0, 10),
          blocked_reason: null,
          blocked_at: null,
        },
      ]);

      return resultBuilder.success(
        `Old card cancelled. Replacement ••${lastFour} issued — arrives in 3–5 business days.`,
      );
    },
  });
}
