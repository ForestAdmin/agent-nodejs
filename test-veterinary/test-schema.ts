/**
 * Veterinary Service Schema Test
 *
 * This script tests the schema-manager plugin by creating
 * a complete database schema for a veterinary service.
 */

import { Sequelize } from 'sequelize';
import { SequelizeSchemaExecutor } from '../packages/plugin-schema-manager/src/executors/sequelize-executor';
import type { ColumnDefinition, TableDefinition } from '../packages/plugin-schema-manager/src/types';

async function createVeterinarySchema() {
  console.log('🏥 Veterinary Service - Schema Creation Test\n');
  console.log('='.repeat(70));

  // Initialize SQLite database
  const sequelize = new Sequelize('sqlite://./veterinary.db', {
    logging: (sql) => console.log(`   SQL: ${sql}`),
  });

  await sequelize.authenticate();
  console.log('✅ Connected to SQLite database\n');

  // Create executor
  const executor = new SequelizeSchemaExecutor({ sequelize });
  console.log(`📊 Executor: ${executor.dialect}\n`);

  try {
    // ========================================
    // 1. CREATE CLIENTS TABLE
    // ========================================
    console.log('1️⃣  Creating CLIENTS table...');

    const clientsTable: TableDefinition = {
      name: 'clients',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        {
          name: 'first_name',
          type: 'STRING',
          allowNull: false,
        },
        {
          name: 'last_name',
          type: 'STRING',
          allowNull: false,
        },
        {
          name: 'email',
          type: 'STRING',
          allowNull: false,
          unique: true,
        },
        {
          name: 'phone',
          type: 'STRING',
          allowNull: true,
        },
        {
          name: 'address',
          type: 'TEXT',
          allowNull: true,
        },
        {
          name: 'created_at',
          type: 'DATE',
          allowNull: false,
          defaultValue: 'CURRENT_TIMESTAMP',
        },
      ],
    };

    await executor.createTable('clients', clientsTable);
    console.log('✅ CLIENTS table created\n');

    // ========================================
    // 2. CREATE VETERINARIANS TABLE
    // ========================================
    console.log('2️⃣  Creating VETERINARIANS table...');

    const vetsTable: TableDefinition = {
      name: 'veterinarians',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        {
          name: 'first_name',
          type: 'STRING',
          allowNull: false,
        },
        {
          name: 'last_name',
          type: 'STRING',
          allowNull: false,
        },
        {
          name: 'specialization',
          type: 'STRING',
          allowNull: true,
          comment: 'e.g., Surgery, Dentistry, Dermatology',
        },
        {
          name: 'license_number',
          type: 'STRING',
          allowNull: false,
          unique: true,
        },
        {
          name: 'phone',
          type: 'STRING',
          allowNull: true,
        },
        {
          name: 'email',
          type: 'STRING',
          allowNull: false,
          unique: true,
        },
        {
          name: 'hire_date',
          type: 'DATE',
          allowNull: false,
        },
      ],
    };

    await executor.createTable('veterinarians', vetsTable);
    console.log('✅ VETERINARIANS table created\n');

    // ========================================
    // 3. CREATE PETS TABLE
    // ========================================
    console.log('3️⃣  Creating PETS table...');

    const petsTable: TableDefinition = {
      name: 'pets',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        {
          name: 'name',
          type: 'STRING',
          allowNull: false,
        },
        {
          name: 'species',
          type: 'STRING',
          allowNull: false,
          comment: 'Dog, Cat, Bird, etc.',
        },
        {
          name: 'breed',
          type: 'STRING',
          allowNull: true,
        },
        {
          name: 'birth_date',
          type: 'DATE',
          allowNull: true,
        },
        {
          name: 'weight_kg',
          type: 'FLOAT',
          allowNull: true,
        },
        {
          name: 'microchip_id',
          type: 'STRING',
          allowNull: true,
          unique: true,
        },
        {
          name: 'client_id',
          type: 'INTEGER',
          allowNull: false,
        },
        {
          name: 'is_active',
          type: 'BOOLEAN',
          allowNull: false,
          defaultValue: true,
        },
        {
          name: 'registered_at',
          type: 'DATE',
          allowNull: false,
          defaultValue: 'CURRENT_TIMESTAMP',
        },
      ],
    };

    await executor.createTable('pets', petsTable);
    console.log('✅ PETS table created\n');

    // ========================================
    // 4. CREATE APPOINTMENTS TABLE
    // ========================================
    console.log('4️⃣  Creating APPOINTMENTS table...');

    const appointmentsTable: TableDefinition = {
      name: 'appointments',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        {
          name: 'pet_id',
          type: 'INTEGER',
          allowNull: false,
        },
        {
          name: 'vet_id',
          type: 'INTEGER',
          allowNull: false,
        },
        {
          name: 'appointment_date',
          type: 'DATE',
          allowNull: false,
        },
        {
          name: 'reason',
          type: 'STRING',
          allowNull: false,
          comment: 'Checkup, Vaccination, Emergency, etc.',
        },
        {
          name: 'notes',
          type: 'TEXT',
          allowNull: true,
        },
        {
          name: 'status',
          type: 'STRING',
          allowNull: false,
          defaultValue: 'scheduled',
          comment: 'scheduled, completed, cancelled',
        },
        {
          name: 'created_at',
          type: 'DATE',
          allowNull: false,
          defaultValue: 'CURRENT_TIMESTAMP',
        },
      ],
    };

    await executor.createTable('appointments', appointmentsTable);
    console.log('✅ APPOINTMENTS table created\n');

    // ========================================
    // 5. CREATE INDEXES
    // ========================================
    console.log('5️⃣  Creating indexes...');

    // Index on client email
    await executor.createIndex('clients', {
      name: 'idx_clients_email',
      columns: ['email'],
      unique: true,
    });
    console.log('   ✓ idx_clients_email');

    // Index on pet client_id for faster lookups
    await executor.createIndex('pets', {
      name: 'idx_pets_client_id',
      columns: ['client_id'],
      unique: false,
    });
    console.log('   ✓ idx_pets_client_id');

    // Composite index on appointments (pet_id, appointment_date)
    await executor.createIndex('appointments', {
      name: 'idx_appointments_pet_date',
      columns: ['pet_id', 'appointment_date'],
      unique: false,
    });
    console.log('   ✓ idx_appointments_pet_date');

    // Index on appointment status
    await executor.createIndex('appointments', {
      name: 'idx_appointments_status',
      columns: ['status'],
      unique: false,
    });
    console.log('   ✓ idx_appointments_status');

    console.log('✅ Indexes created\n');

    // ========================================
    // 6. CREATE FOREIGN KEYS
    // ========================================
    console.log('6️⃣  Creating foreign keys...');

    // pets.client_id -> clients.id
    await executor.createForeignKey('pets', {
      name: 'fk_pets_client',
      columns: ['client_id'],
      referencedTable: 'clients',
      referencedColumns: ['id'],
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    console.log('   ✓ fk_pets_client (pets -> clients)');

    // appointments.pet_id -> pets.id
    await executor.createForeignKey('appointments', {
      name: 'fk_appointments_pet',
      columns: ['pet_id'],
      referencedTable: 'pets',
      referencedColumns: ['id'],
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    console.log('   ✓ fk_appointments_pet (appointments -> pets)');

    // appointments.vet_id -> veterinarians.id
    await executor.createForeignKey('appointments', {
      name: 'fk_appointments_vet',
      columns: ['vet_id'],
      referencedTable: 'veterinarians',
      referencedColumns: ['id'],
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    console.log('   ✓ fk_appointments_vet (appointments -> veterinarians)');

    console.log('✅ Foreign keys created\n');

    // ========================================
    // 7. VERIFY SCHEMA
    // ========================================
    console.log('7️⃣  Verifying schema...\n');

    const tables = await executor.listTables();
    console.log(`📊 Tables created: ${tables.length}`);
    tables.forEach((table) => console.log(`   - ${table}`));

    console.log('\n📋 Table descriptions:');
    for (const table of tables) {
      const desc = await executor.describeTable(table);
      console.log(`\n   ${table.toUpperCase()}: ${desc.columns.length} columns`);
      desc.columns.forEach((col) => {
        const nullable = col.allowNull ? 'NULL' : 'NOT NULL';
        const pk = col.primaryKey ? ' [PK]' : '';
        const unique = col.unique ? ' [UNIQUE]' : '';
        console.log(`      - ${col.name}: ${col.type} ${nullable}${pk}${unique}`);
      });
    }

    // ========================================
    // 8. TEST ADDITIONAL OPERATIONS
    // ========================================
    console.log('\n8️⃣  Testing additional operations...\n');

    // Add a new column to clients table
    console.log('   Adding column "loyalty_points" to CLIENTS...');
    await executor.createColumn('clients', {
      name: 'loyalty_points',
      type: 'INTEGER',
      allowNull: false,
      defaultValue: 0,
      comment: 'Reward points for loyal clients',
    });
    console.log('   ✅ Column added\n');

    // Modify column (change weight from FLOAT to DECIMAL for precision)
    console.log('   Modifying column "weight_kg" in PETS...');
    await executor.modifyColumn('pets', 'weight_kg', {
      name: 'weight_kg',
      type: 'DECIMAL',
      allowNull: true,
    });
    console.log('   ✅ Column modified\n');

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('='.repeat(70));
    console.log('\n🎉 VETERINARY SERVICE SCHEMA CREATED SUCCESSFULLY!\n');
    console.log('Summary:');
    console.log('  ✅ 4 tables created (clients, veterinarians, pets, appointments)');
    console.log('  ✅ 4 indexes created');
    console.log('  ✅ 3 foreign keys created');
    console.log('  ✅ 1 column added (loyalty_points)');
    console.log('  ✅ 1 column modified (weight_kg)');
    console.log('\nDatabase file: ./veterinary.db');
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error('\n❌ Error during schema creation:', error.message);
    throw error;
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
if (require.main === module) {
  createVeterinarySchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createVeterinarySchema };
