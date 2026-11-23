import type { TransactionsCustomizer } from '../typings';

export default (collection: TransactionsCustomizer) =>
  collection.addManyToOneRelation('account', 'accounts', { foreignKey: 'account_id' });
