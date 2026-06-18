import Knex from 'knex';

import seedAml from './aml';
import seedCards from './cards';
import seedChargebacks from './chargebacks';
import seedCustomers from './customers';
import seedKyc from './kyc';
import seedRefunds from './refunds';

/**
 * Populates a fresh SQLite database at `filename` with the demo fintech dataset.
 *
 * Tables are built in dependency order — customers first, then everything that
 * references them — so foreign keys resolve and the data stays coherent. The
 * caller owns the file's lifecycle; we own the connection.
 */
export default async function seed(filename: string): Promise<void> {
  const knex = Knex({
    client: 'sqlite3',
    connection: { filename },
    useNullAsDefault: true,
  });

  try {
    const customers = await seedCustomers(knex);
    const { cardsByCust } = await seedCards(knex, customers);
    const { refundsByCust } = await seedRefunds(knex, customers);

    await seedKyc(knex, customers);
    await seedAml(knex, customers);
    await seedChargebacks(knex, customers, cardsByCust, refundsByCust);
  } finally {
    await knex.destroy();
  }
}
