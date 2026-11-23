import type { CardMerchantsCustomizer } from '../typings';

export default (collection: CardMerchantsCustomizer) =>
  collection
    .addManyToOneRelation('counterparty', 'counterparties', { foreignKey: 'counterparty_id' })
    .addOneToManyRelation('card_transactions', 'card_transactions', { originKey: 'merchant_id' });
