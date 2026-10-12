# Analyse : Extension Schema Manager pour Forest Admin Agent-nodejs

**Date** : 21 octobre 2025
**Objectif** : Créer une extension activable permettant la modification de schéma en live sur les datasources

---

## 📊 Analyse de l'Architecture Existante

### Structure du Repository

**Type** : Monorepo (Lerna + Yarn Workspaces)
**Packages principaux** :

```
agent-nodejs/
├── packages/
│   ├── datasource-toolkit/        # Interfaces de base (DataSource, Collection, Schema)
│   ├── datasource-customizer/     # Layer de personnalisation + système de plugins
│   ├── agent/                     # Orchestrateur principal
│   ├── datasource-sql/            # Datasource SQL avec introspection
│   ├── datasource-sequelize/      # Datasource Sequelize
│   ├── datasource-mongo/          # Datasource MongoDB
│   ├── datasource-mongoose/       # Datasource Mongoose
│   ├── plugin-export-advanced/    # Plugin d'export (exemple)
│   ├── plugin-flattener/          # Plugin de flatten (exemple)
│   └── plugin-aws-s3/             # Plugin S3 (exemple)
```

### Architecture en Couches

```
┌─────────────────────────────────────────────────┐
│ Agent (createAgent)                             │
│ - Orchestration générale                        │
│ - Configuration globale                         │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│ DataSourceCustomizer                            │
│ - Gestion des datasources                       │
│ - Application des plugins (.use())              │
│ - Collections customization                     │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│ DecoratorsStack                                 │
│ - actions (addAction)                           │
│ - computed (addField)                           │
│ - relations (addManyToOneRelation)              │
│ - hook (addHook)                                │
│ - override (replaceFieldWriting)                │
│ - chart, segment, search, etc.                  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│ DataSources (SQL, Sequelize, Mongo, etc.)      │
│ - BaseDataSource / BaseCollection               │
│ - CRUD operations                               │
│ - Schéma introspection                          │
│ - nativeDriver exposure                         │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│ Native Database Connections                     │
│ - Sequelize instances                           │
│ - MongoDB connections                           │
│ - Query interfaces                              │
└─────────────────────────────────────────────────┘
```

---

## 🔌 Système de Plugins Existant

### Interface Plugin

```typescript
// packages/datasource-customizer/src/types.ts
export type Plugin<Options> = (
  dataSourceCustomizer: DataSourceCustomizer<any>,
  collectionCustomizer: CollectionCustomizer<any, any>,
  options?: Options,
  logger?: Logger,
) => Promise<void> | void;
```

### Utilisation

```typescript
// Exemple d'utilisation
import { createAgent } from '@forestadmin/agent';
import { addExportAdvanced } from '@forestadmin/plugin-export-advanced';

createAgent(options)
  .addDataSource(createSqlDataSource(connectionString))
  .use(addExportAdvanced, { format: 'xlsx' })
  .start();
```

### Patterns Observés

1. **Plugin Export Advanced** (`plugin-export-advanced`)
   - Ajoute une action globale sur les collections
   - Utilise un formulaire dynamique
   - Génère des fichiers

2. **Plugin Flattener** (`plugin-flattener`)
   - Transforme la structure des données
   - Utilise des computed fields
   - Pattern de transformation de schéma

---

## 🔓 Accès aux Connexions Natives

### 1. Via `nativeDriver` sur les Collections

**Sequelize Collections** (`datasource-sequelize/src/collection.ts:51-80`) :

```typescript
super(name, datasource, {
  sequelize: model.sequelize,
  model,
  rawQuery: async (sql: string, replacements: Replacements, options?) => {
    const result = await model.sequelize.query(sql, {
      type: QueryTypes.RAW,
      plain: false,
      raw: true,
      ...(opt.syntax === 'bind' ? { bind: replacements } : { replacements }),
    });
    return result?.[0];
  },
});
```

**Accès dans les customizations** (`_example/src/forest/customizations/dvd.ts:12-15`) :

```typescript
.addField('numberOfRentals', {
  columnType: 'Number',
  dependencies: ['id'],
  getValues: async (records, context) => {
    const rows = await context.collection.nativeDriver.rawQuery(
      'SELECT dvd_id, COUNT(*) AS count FROM dvd_rental WHERE dvd_id IN (:ids) GROUP BY dvd_id',
      { ids: records.map(r => r.id) },
    );
    return records.map(record => rows.find(r => r.dvd_id === record.id)?.count ?? 0);
  },
})
```

### 2. Via `nativeQueryConnections` sur les DataSources

**Sequelize DataSource** (`datasource-sequelize/src/datasource.ts:49-66`) :

```typescript
override async executeNativeQuery<R extends object>(
  connectionName: string,
  query: string,
  contextVariables = {},
): Promise<R[]> {
  if (!this.nativeQueryConnections[connectionName]) {
    throw new Error(`Unknown connection name '${connectionName}'`);
  }

  return (this.nativeQueryConnections[connectionName] as NativeQueryConnection).instance.query<R>(
    query,
    {
      bind: contextVariables,
      type: QueryTypes.SELECT,
      raw: true,
    },
  );
}
```

### 3. Introspection SQL

**datasource-sql** expose déjà un système d'introspection (`datasource-sql/src/index.ts:27-41`) :

```typescript
export async function introspect(
  uriOrOptions: PlainConnectionOptionsOrUri,
  logger?: Logger,
): Promise<Introspection> {
  const options = new ConnectionOptions(uriOrOptions, logger);
  let sequelize: Sequelize;

  try {
    sequelize = await connect(options);
    return await Introspector.introspect(sequelize, logger);
  } finally {
    await sequelize?.close();
  }
}
```

**Structure Introspection** (`datasource-sql/src/introspection/types.ts:42-84`) :

```typescript
export type Table = {
  name: string;
  schema: string | undefined;
  unique: string[][];
  columns: {
    name: string;
    type: ColumnType;
    defaultValue: unknown;
    isLiteralDefaultValue: boolean;
    allowNull: boolean;
    autoIncrement: boolean;
    primaryKey: boolean;
    constraints: {
      table: string;
      column: string;
    }[];
  }[];
};

export type Introspection3 = {
  tables: Table[];
  views: Table[];
  source: '@forestadmin/datasource-sql';
  version: 3;
};
```

---

## 🔐 Système de Permissions

### Interface Caller

```typescript
// datasource-toolkit/src/interfaces/caller.ts
export type Caller = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  role: string;
  permissionLevel: 'admin' | 'developer' | 'editor' | 'user';
  timezone: string;
  // ... autres propriétés
};
```

### Utilisation dans les Actions

Les actions reçoivent le `caller` via le contexte, permettant de restreindre l'accès :

```typescript
collection.addAction('Sensitive Operation', {
  scope: 'Global',
  execute: async (context, resultBuilder) => {
    if (context.caller.permissionLevel !== 'admin') {
      return resultBuilder.error('Admin access required');
    }
    // ... opération sensible
  }
});
```

---

## ✅ Faisabilité : CONFIRMÉE

### Points Forts

| Aspect | Disponibilité | Détails |
|--------|---------------|---------|
| **Accès connexions natives** | ✅ Oui | Via `nativeDriver` et `nativeQueryConnections` |
| **Système plugins** | ✅ Mature | Pattern établi avec exemples |
| **Actions customisables** | ✅ Oui | Formulaires + exécution async |
| **Permissions** | ✅ Intégrées | `caller.permissionLevel` |
| **Support multi-DB** | ✅ Oui | SQL, MongoDB, Mongoose supportés |
| **Introspection** | ✅ Existante | `datasource-sql` peut déjà introspecter |
| **QueryInterface Sequelize** | ✅ Accessible | Via `sequelize.getQueryInterface()` |

### Défis Identifiés

| Défi | Criticité | Mitigation |
|------|-----------|------------|
| **Sécurité DDL** | 🔴 Critique | Validations strictes + confirmations multiples |
| **Pas de rollback natif** | 🟠 Élevée | Dry-run mode + backups obligatoires |
| **Cohérence schéma** | 🟡 Moyenne | Re-introspection automatique |
| **Multi-datasource** | 🟡 Moyenne | Factory pattern + executors spécifiques |
| **Validation complexe** | 🟡 Moyenne | Validateurs dédiés par opération |
| **Impact production** | 🔴 Critique | Feature flags + restrictions par environnement |

---

## 📋 Plan d'Implémentation Détaillé

### Phase 1 : Fondations (3-4 jours)

#### 1.1 Structure du Package

```
packages/plugin-schema-manager/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                          # Export principal du plugin
│   ├── types.ts                          # Types TypeScript
│   │
│   ├── actions/
│   │   ├── index.ts
│   │   ├── create-table.action.ts
│   │   ├── create-column.action.ts
│   │   ├── modify-column.action.ts
│   │   ├── drop-column.action.ts
│   │   ├── create-index.action.ts
│   │   ├── drop-index.action.ts
│   │   ├── create-foreign-key.action.ts
│   │   ├── drop-foreign-key.action.ts
│   │   └── rename-column.action.ts
│   │
│   ├── executors/
│   │   ├── base-executor.ts              # Interface commune
│   │   ├── executor-factory.ts           # Factory pour créer le bon executor
│   │   ├── sequelize-executor.ts         # Executor pour SQL via Sequelize
│   │   ├── mongo-executor.ts             # Executor pour MongoDB
│   │   └── unsupported-executor.ts       # Placeholder pour datasources non supportées
│   │
│   ├── validators/
│   │   ├── identifier-validator.ts       # Validation noms tables/colonnes
│   │   ├── type-validator.ts             # Validation types de données
│   │   ├── constraint-validator.ts       # Validation contraintes
│   │   └── permission-validator.ts       # Validation permissions
│   │
│   ├── introspection/
│   │   ├── schema-refresher.ts           # Re-introspection après changements
│   │   └── schema-comparator.ts          # Comparaison schémas (optionnel)
│   │
│   ├── utils/
│   │   ├── ddl-builder.ts                # Construction requêtes DDL
│   │   ├── type-mapper.ts                # Mapping types entre SGBD
│   │   └── confirmation-helper.ts        # Helpers pour confirmations
│   │
│   └── migrations/
│       └── migration-tracker.ts          # Tracking historique (optionnel)
│
└── test/
    ├── actions/
    ├── executors/
    ├── validators/
    └── integration/
```

#### 1.2 Types de Base

```typescript
// src/types.ts

export interface SchemaManagerOptions {
  // Sécurité
  restrictTo?: Array<'admin' | 'developer' | 'editor' | 'user'>;
  requireConfirmation?: boolean;
  dryRunMode?: boolean;

  // Fonctionnalités activables
  enableTableCreation?: boolean;
  enableTableDeletion?: boolean;
  enableColumnModification?: boolean;
  enableColumnDeletion?: boolean;
  enableIndexManagement?: boolean;
  enableForeignKeyManagement?: boolean;

  // Restrictions
  allowedDatabases?: string[];
  forbiddenTables?: string[];
  forbiddenColumns?: string[];

  // Callbacks
  beforeSchemaChange?: (operation: SchemaOperation) => Promise<boolean>;
  afterSchemaChange?: (operation: SchemaOperation) => Promise<void>;
  onError?: (error: Error, operation: SchemaOperation) => Promise<void>;

  // Avancé
  enableMigrationTracking?: boolean;
  autoRefreshSchema?: boolean;
}

export type SchemaOperationType =
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'CREATE_COLUMN'
  | 'DROP_COLUMN'
  | 'MODIFY_COLUMN'
  | 'RENAME_COLUMN'
  | 'CREATE_INDEX'
  | 'DROP_INDEX'
  | 'CREATE_FOREIGN_KEY'
  | 'DROP_FOREIGN_KEY';

export interface SchemaOperation {
  type: SchemaOperationType;
  datasource: string;
  collection: string;
  timestamp: Date;
  caller: {
    id: number;
    email: string;
    permissionLevel: string;
  };
  details: Record<string, any>;
  dryRun: boolean;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  allowNull: boolean;
  defaultValue?: any;
  autoIncrement?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  comment?: string;
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
}

export interface IndexDefinition {
  name?: string;
  columns: string[];
  unique?: boolean;
  type?: 'BTREE' | 'HASH' | 'GIST' | 'GIN';
}

export interface ForeignKeyDefinition {
  name?: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SchemaExecutor {
  // Tables
  createTable(tableName: string, definition: TableDefinition): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  renameTable(oldName: string, newName: string): Promise<void>;

  // Columns
  createColumn(tableName: string, column: ColumnDefinition): Promise<void>;
  dropColumn(tableName: string, columnName: string): Promise<void>;
  modifyColumn(tableName: string, columnName: string, newDefinition: ColumnDefinition): Promise<void>;
  renameColumn(tableName: string, oldName: string, newName: string): Promise<void>;

  // Indexes
  createIndex(tableName: string, index: IndexDefinition): Promise<void>;
  dropIndex(tableName: string, indexName: string): Promise<void>;

  // Foreign Keys
  createForeignKey(tableName: string, fk: ForeignKeyDefinition): Promise<void>;
  dropForeignKey(tableName: string, fkName: string): Promise<void>;

  // Introspection
  listTables(): Promise<string[]>;
  describeTable(tableName: string): Promise<TableDefinition>;
  listIndexes(tableName: string): Promise<IndexDefinition[]>;
  listForeignKeys(tableName: string): Promise<ForeignKeyDefinition[]>;

  // Metadata
  getSupportedTypes(): string[];
  supportsOperation(operation: SchemaOperationType): boolean;

  // DDL Preview
  buildDDL(operation: SchemaOperation): string;
}
```

### Phase 2 : Executors (4-5 jours)

#### 2.1 Base Executor

```typescript
// src/executors/base-executor.ts

import { SchemaExecutor, SchemaOperationType } from '../types';

export abstract class BaseSchemaExecutor implements SchemaExecutor {
  protected abstract dialect: string;

  abstract createTable(tableName: string, definition: TableDefinition): Promise<void>;
  abstract dropTable(tableName: string): Promise<void>;
  abstract createColumn(tableName: string, column: ColumnDefinition): Promise<void>;
  abstract dropColumn(tableName: string, columnName: string): Promise<void>;

  // Opérations optionnelles avec implémentation par défaut
  async renameTable(oldName: string, newName: string): Promise<void> {
    throw new Error(`renameTable not supported for ${this.dialect}`);
  }

  async modifyColumn(tableName: string, columnName: string, newDef: ColumnDefinition): Promise<void> {
    throw new Error(`modifyColumn not supported for ${this.dialect}`);
  }

  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    throw new Error(`renameColumn not supported for ${this.dialect}`);
  }

  supportsOperation(operation: SchemaOperationType): boolean {
    const supported = this.getSupportedOperations();
    return supported.includes(operation);
  }

  protected abstract getSupportedOperations(): SchemaOperationType[];

  protected quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
```

#### 2.2 Sequelize Executor

```typescript
// src/executors/sequelize-executor.ts

import { QueryInterface, Sequelize, DataTypes } from 'sequelize';
import { BaseSchemaExecutor } from './base-executor';
import {
  ColumnDefinition,
  TableDefinition,
  IndexDefinition,
  ForeignKeyDefinition,
  SchemaOperationType
} from '../types';

export class SequelizeSchemaExecutor extends BaseSchemaExecutor {
  protected dialect: string;
  private sequelize: Sequelize;
  private queryInterface: QueryInterface;

  constructor(nativeDriver: any) {
    super();

    // Extraire l'instance Sequelize depuis différentes structures possibles
    this.sequelize =
      nativeDriver.sequelize ||
      nativeDriver.model?.sequelize ||
      nativeDriver;

    if (!this.sequelize || typeof this.sequelize.getQueryInterface !== 'function') {
      throw new Error('Invalid Sequelize instance in nativeDriver');
    }

    this.queryInterface = this.sequelize.getQueryInterface();
    this.dialect = this.sequelize.getDialect();
  }

  protected getSupportedOperations(): SchemaOperationType[] {
    return [
      'CREATE_TABLE',
      'DROP_TABLE',
      'CREATE_COLUMN',
      'DROP_COLUMN',
      'MODIFY_COLUMN',
      'RENAME_COLUMN',
      'CREATE_INDEX',
      'DROP_INDEX',
      'CREATE_FOREIGN_KEY',
      'DROP_FOREIGN_KEY',
    ];
  }

  // ========== TABLES ==========

  async createTable(tableName: string, definition: TableDefinition): Promise<void> {
    const attributes = this.buildAttributesFromColumns(definition.columns);

    await this.queryInterface.createTable(tableName, attributes);

    // Créer les indexes si spécifiés
    if (definition.indexes) {
      for (const index of definition.indexes) {
        await this.createIndex(tableName, index);
      }
    }

    // Créer les foreign keys si spécifiées
    if (definition.foreignKeys) {
      for (const fk of definition.foreignKeys) {
        await this.createForeignKey(tableName, fk);
      }
    }
  }

  async dropTable(tableName: string): Promise<void> {
    await this.queryInterface.dropTable(tableName);
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    await this.queryInterface.renameTable(oldName, newName);
  }

  // ========== COLUMNS ==========

  async createColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    const columnSpec = {
      type: this.mapType(column.type),
      allowNull: column.allowNull,
      defaultValue: column.defaultValue,
      autoIncrement: column.autoIncrement || false,
      primaryKey: column.primaryKey || false,
      unique: column.unique || false,
      comment: column.comment,
    };

    await this.queryInterface.addColumn(tableName, column.name, columnSpec);
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    await this.queryInterface.removeColumn(tableName, columnName);
  }

  async modifyColumn(
    tableName: string,
    columnName: string,
    newDef: ColumnDefinition
  ): Promise<void> {
    const columnSpec = {
      type: this.mapType(newDef.type),
      allowNull: newDef.allowNull,
      defaultValue: newDef.defaultValue,
    };

    await this.queryInterface.changeColumn(tableName, columnName, columnSpec);
  }

  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    await this.queryInterface.renameColumn(tableName, oldName, newName);
  }

  // ========== INDEXES ==========

  async createIndex(tableName: string, index: IndexDefinition): Promise<void> {
    const options: any = {
      fields: index.columns,
      unique: index.unique || false,
    };

    if (index.name) {
      options.name = index.name;
    }

    if (index.type) {
      options.type = index.type;
    }

    await this.queryInterface.addIndex(tableName, options);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    await this.queryInterface.removeIndex(tableName, indexName);
  }

  async listIndexes(tableName: string): Promise<IndexDefinition[]> {
    const indexes = await this.queryInterface.showIndex(tableName);

    return indexes.map(idx => ({
      name: idx.name,
      columns: [idx.column_name], // Note: peut nécessiter agrégation si index composite
      unique: idx.unique || false,
    }));
  }

  // ========== FOREIGN KEYS ==========

  async createForeignKey(tableName: string, fk: ForeignKeyDefinition): Promise<void> {
    const constraintName = fk.name || `fk_${tableName}_${fk.columns.join('_')}`;

    await this.queryInterface.addConstraint(tableName, {
      type: 'foreign key',
      name: constraintName,
      fields: fk.columns,
      references: {
        table: fk.referencedTable,
        fields: fk.referencedColumns,
      },
      onDelete: fk.onDelete || 'NO ACTION',
      onUpdate: fk.onUpdate || 'NO ACTION',
    });
  }

  async dropForeignKey(tableName: string, fkName: string): Promise<void> {
    await this.queryInterface.removeConstraint(tableName, fkName);
  }

  async listForeignKeys(tableName: string): Promise<ForeignKeyDefinition[]> {
    // L'implémentation dépend du dialecte
    // Sequelize n'a pas de méthode standard pour ça
    throw new Error('listForeignKeys not yet implemented for Sequelize');
  }

  // ========== INTROSPECTION ==========

  async listTables(): Promise<string[]> {
    const tables = await this.queryInterface.showAllTables();
    return tables as string[];
  }

  async describeTable(tableName: string): Promise<TableDefinition> {
    const description = await this.queryInterface.describeTable(tableName);

    const columns: ColumnDefinition[] = Object.entries(description).map(([name, spec]: [string, any]) => ({
      name,
      type: this.reverseMapType(spec.type),
      allowNull: spec.allowNull,
      defaultValue: spec.defaultValue,
      autoIncrement: spec.autoIncrement || false,
      primaryKey: spec.primaryKey || false,
      unique: spec.unique || false,
      comment: spec.comment,
    }));

    return {
      name: tableName,
      columns,
    };
  }

  // ========== TYPE MAPPING ==========

  getSupportedTypes(): string[] {
    return [
      'STRING',
      'TEXT',
      'CHAR',
      'INTEGER',
      'BIGINT',
      'FLOAT',
      'REAL',
      'DOUBLE',
      'DECIMAL',
      'BOOLEAN',
      'DATE',
      'DATEONLY',
      'TIME',
      'UUID',
      'JSON',
      'JSONB',
      'BLOB',
      'ENUM',
    ];
  }

  private mapType(type: string): DataTypes.AbstractDataType {
    const typeUpper = type.toUpperCase();
    const mapping: Record<string, DataTypes.AbstractDataType> = {
      STRING: DataTypes.STRING,
      TEXT: DataTypes.TEXT,
      CHAR: DataTypes.CHAR,
      INTEGER: DataTypes.INTEGER,
      BIGINT: DataTypes.BIGINT,
      FLOAT: DataTypes.FLOAT,
      REAL: DataTypes.REAL,
      DOUBLE: DataTypes.DOUBLE,
      DECIMAL: DataTypes.DECIMAL,
      BOOLEAN: DataTypes.BOOLEAN,
      DATE: DataTypes.DATE,
      DATEONLY: DataTypes.DATEONLY,
      TIME: DataTypes.TIME,
      UUID: DataTypes.UUID,
      JSON: DataTypes.JSON,
      JSONB: DataTypes.JSONB,
      BLOB: DataTypes.BLOB,
    };

    if (!mapping[typeUpper]) {
      throw new Error(`Unsupported type: ${type}`);
    }

    return mapping[typeUpper];
  }

  private reverseMapType(sequelizeType: any): string {
    const typeStr = sequelizeType.toString();

    // Extraction basique - à améliorer
    if (typeStr.includes('VARCHAR')) return 'STRING';
    if (typeStr.includes('TEXT')) return 'TEXT';
    if (typeStr.includes('INTEGER')) return 'INTEGER';
    if (typeStr.includes('BIGINT')) return 'BIGINT';
    if (typeStr.includes('BOOLEAN')) return 'BOOLEAN';
    if (typeStr.includes('DATE')) return 'DATE';
    if (typeStr.includes('UUID')) return 'UUID';
    if (typeStr.includes('JSON')) return 'JSON';

    return 'STRING'; // Fallback
  }

  // ========== DDL PREVIEW ==========

  buildDDL(operation: SchemaOperation): string {
    // Construire la requête DDL en fonction de l'opération
    // Pour preview en mode dry-run
    switch (operation.type) {
      case 'CREATE_TABLE':
        return this.buildCreateTableDDL(operation.details);
      case 'CREATE_COLUMN':
        return this.buildCreateColumnDDL(operation.collection, operation.details);
      case 'DROP_COLUMN':
        return `ALTER TABLE ${this.quoteIdentifier(operation.collection)} DROP COLUMN ${this.quoteIdentifier(operation.details.columnName)}`;
      default:
        return `-- DDL preview not implemented for ${operation.type}`;
    }
  }

  private buildCreateTableDDL(details: any): string {
    // Simplification - à améliorer
    return `CREATE TABLE ${this.quoteIdentifier(details.tableName)} (...)`;
  }

  private buildCreateColumnDDL(tableName: string, details: any): string {
    const { columnName, type, allowNull, defaultValue } = details;
    let ddl = `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD COLUMN ${this.quoteIdentifier(columnName)} ${type}`;

    if (!allowNull) {
      ddl += ' NOT NULL';
    }

    if (defaultValue !== undefined && defaultValue !== null) {
      ddl += ` DEFAULT ${this.formatValue(defaultValue)}`;
    }

    return ddl;
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    return String(value);
  }

  private buildAttributesFromColumns(columns: ColumnDefinition[]): Record<string, any> {
    const attributes: Record<string, any> = {};

    for (const col of columns) {
      attributes[col.name] = {
        type: this.mapType(col.type),
        allowNull: col.allowNull,
        defaultValue: col.defaultValue,
        autoIncrement: col.autoIncrement || false,
        primaryKey: col.primaryKey || false,
        unique: col.unique || false,
        comment: col.comment,
      };
    }

    return attributes;
  }
}
```

#### 2.3 MongoDB Executor

```typescript
// src/executors/mongo-executor.ts

import { Db, Collection as MongoCollection } from 'mongodb';
import { BaseSchemaExecutor } from './base-executor';
import {
  ColumnDefinition,
  TableDefinition,
  IndexDefinition,
  SchemaOperationType
} from '../types';

export class MongoSchemaExecutor extends BaseSchemaExecutor {
  protected dialect = 'mongodb';
  private db: Db;

  constructor(nativeDriver: any) {
    super();

    // Extraire DB depuis différentes structures
    this.db =
      nativeDriver.db ||
      nativeDriver.connection?.db ||
      nativeDriver;

    if (!this.db || typeof this.db.createCollection !== 'function') {
      throw new Error('Invalid MongoDB instance in nativeDriver');
    }
  }

  protected getSupportedOperations(): SchemaOperationType[] {
    return [
      'CREATE_TABLE', // Collection en MongoDB
      'DROP_TABLE',
      'CREATE_INDEX',
      'DROP_INDEX',
      // MongoDB est schema-less, donc pas de CREATE_COLUMN stricto sensu
    ];
  }

  // ========== COLLECTIONS (équivalent tables) ==========

  async createTable(tableName: string, definition: TableDefinition): Promise<void> {
    const options: any = {};

    // Si des contraintes de validation sont spécifiées
    if (definition.columns && definition.columns.length > 0) {
      options.validator = this.buildValidator(definition.columns);
      options.validationLevel = 'moderate';
    }

    await this.db.createCollection(tableName, options);

    // Créer les indexes si spécifiés
    if (definition.indexes) {
      for (const index of definition.indexes) {
        await this.createIndex(tableName, index);
      }
    }
  }

  async dropTable(tableName: string): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.drop();
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    const collection = this.db.collection(oldName);
    await collection.rename(newName);
  }

  // ========== FIELDS (MongoDB est schema-less) ==========

  async createColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    // MongoDB est schema-less, mais on peut ajouter une validation
    const collection = this.db.collection(tableName);

    const validator = {
      $jsonSchema: {
        properties: {
          [column.name]: this.buildFieldValidator(column),
        },
      },
    };

    await this.db.command({
      collMod: tableName,
      validator,
      validationLevel: 'moderate',
    });
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    // En MongoDB, "supprimer" un champ = le retirer de tous les documents
    const collection = this.db.collection(tableName);

    await collection.updateMany(
      {},
      { $unset: { [columnName]: '' } }
    );
  }

  // ========== INDEXES ==========

  async createIndex(tableName: string, index: IndexDefinition): Promise<void> {
    const collection = this.db.collection(tableName);

    const indexSpec: any = {};
    for (const col of index.columns) {
      indexSpec[col] = 1; // 1 = ascending, -1 = descending
    }

    const options: any = {
      unique: index.unique || false,
    };

    if (index.name) {
      options.name = index.name;
    }

    await collection.createIndex(indexSpec, options);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.dropIndex(indexName);
  }

  async listIndexes(tableName: string): Promise<IndexDefinition[]> {
    const collection = this.db.collection(tableName);
    const indexes = await collection.listIndexes().toArray();

    return indexes.map(idx => ({
      name: idx.name,
      columns: Object.keys(idx.key),
      unique: idx.unique || false,
    }));
  }

  // ========== INTROSPECTION ==========

  async listTables(): Promise<string[]> {
    const collections = await this.db.listCollections().toArray();
    return collections.map(c => c.name);
  }

  async describeTable(tableName: string): Promise<TableDefinition> {
    const collection = this.db.collection(tableName);

    // Échantillonner des documents pour déduire le schéma
    const sample = await collection.find().limit(100).toArray();

    const fieldNames = new Set<string>();
    for (const doc of sample) {
      Object.keys(doc).forEach(key => fieldNames.add(key));
    }

    const columns: ColumnDefinition[] = Array.from(fieldNames).map(name => ({
      name,
      type: this.inferType(sample, name),
      allowNull: true, // MongoDB n'a pas de NOT NULL strict
    }));

    return {
      name: tableName,
      columns,
    };
  }

  // ========== TYPE SUPPORT ==========

  getSupportedTypes(): string[] {
    return [
      'string',
      'number',
      'boolean',
      'date',
      'object',
      'array',
      'objectId',
    ];
  }

  // ========== HELPERS ==========

  private buildValidator(columns: ColumnDefinition[]): any {
    const properties: any = {};

    for (const col of columns) {
      properties[col.name] = this.buildFieldValidator(col);
    }

    return {
      $jsonSchema: {
        bsonType: 'object',
        properties,
      },
    };
  }

  private buildFieldValidator(column: ColumnDefinition): any {
    const validator: any = {
      bsonType: this.mapTypeToBSON(column.type),
    };

    if (column.comment) {
      validator.description = column.comment;
    }

    return validator;
  }

  private mapTypeToBSON(type: string): string {
    const mapping: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'bool',
      date: 'date',
      object: 'object',
      array: 'array',
      objectId: 'objectId',
    };

    return mapping[type.toLowerCase()] || 'string';
  }

  private inferType(documents: any[], fieldName: string): string {
    // Logique simple d'inférence de type
    for (const doc of documents) {
      if (doc[fieldName] !== undefined && doc[fieldName] !== null) {
        const type = typeof doc[fieldName];
        if (type === 'string') return 'string';
        if (type === 'number') return 'number';
        if (type === 'boolean') return 'boolean';
        if (doc[fieldName] instanceof Date) return 'date';
        if (Array.isArray(doc[fieldName])) return 'array';
        if (type === 'object') return 'object';
      }
    }
    return 'string'; // Fallback
  }

  buildDDL(operation: SchemaOperation): string {
    // MongoDB n'a pas vraiment de DDL, retourner commande équivalente
    switch (operation.type) {
      case 'CREATE_TABLE':
        return `db.createCollection("${operation.collection}")`;
      case 'CREATE_INDEX':
        return `db.${operation.collection}.createIndex(...)`;
      default:
        return `// MongoDB operation: ${operation.type}`;
    }
  }

  // Non supporté pour MongoDB
  async createForeignKey(): Promise<void> {
    throw new Error('Foreign keys not supported in MongoDB');
  }

  async dropForeignKey(): Promise<void> {
    throw new Error('Foreign keys not supported in MongoDB');
  }

  async listForeignKeys(): Promise<any[]> {
    return [];
  }

  async modifyColumn(): Promise<void> {
    throw new Error('modifyColumn not applicable for MongoDB (schema-less)');
  }

  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.updateMany(
      {},
      { $rename: { [oldName]: newName } }
    );
  }
}
```

#### 2.4 Executor Factory

```typescript
// src/executors/executor-factory.ts

import { SchemaExecutor } from '../types';
import { SequelizeSchemaExecutor } from './sequelize-executor';
import { MongoSchemaExecutor } from './mongo-executor';
import { UnsupportedSchemaExecutor } from './unsupported-executor';

export class ExecutorFactory {
  static create(nativeDriver: any): SchemaExecutor {
    // Détecter le type de datasource

    // Sequelize
    if (nativeDriver?.sequelize || nativeDriver?.model?.sequelize) {
      return new SequelizeSchemaExecutor(nativeDriver);
    }

    // MongoDB
    if (nativeDriver?.db || nativeDriver?.connection?.db) {
      return new MongoSchemaExecutor(nativeDriver);
    }

    // Mongoose (utilise MongoDB sous le capot)
    if (nativeDriver?.connection?.db) {
      return new MongoSchemaExecutor(nativeDriver.connection);
    }

    // Non supporté
    return new UnsupportedSchemaExecutor();
  }
}
```

```typescript
// src/executors/unsupported-executor.ts

import { BaseSchemaExecutor } from './base-executor';
import { SchemaOperationType } from '../types';

export class UnsupportedSchemaExecutor extends BaseSchemaExecutor {
  protected dialect = 'unsupported';

  protected getSupportedOperations(): SchemaOperationType[] {
    return [];
  }

  getSupportedTypes(): string[] {
    return [];
  }

  supportsOperation(): boolean {
    return false;
  }

  async createTable(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async dropTable(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async createColumn(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async dropColumn(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async createIndex(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async dropIndex(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async createForeignKey(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async dropForeignKey(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  async listTables(): Promise<string[]> {
    return [];
  }

  async describeTable(): Promise<any> {
    throw new Error('Schema management not supported for this datasource');
  }

  async listIndexes(): Promise<any[]> {
    return [];
  }

  async listForeignKeys(): Promise<any[]> {
    return [];
  }

  buildDDL(): string {
    return '-- Not supported';
  }
}
```

### Phase 3 : Actions (3-4 jours)

#### 3.1 Create Column Action

```typescript
// src/actions/create-column.action.ts

import { CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { SchemaExecutor, SchemaManagerOptions, SchemaOperation } from '../types';
import { IdentifierValidator } from '../validators/identifier-validator';
import { PermissionValidator } from '../validators/permission-validator';

export function addCreateColumnAction(
  collection: CollectionCustomizer,
  executor: SchemaExecutor,
  options: SchemaManagerOptions
): void {
  // Vérifier que l'opération est supportée
  if (!executor.supportsOperation('CREATE_COLUMN')) {
    return; // Skip silencieusement
  }

  collection.addAction('Schema: Add Column', {
    scope: 'Global',
    form: [
      {
        label: 'Column Name',
        type: 'String',
        isRequired: true,
        description: 'Name of the new column (snake_case recommended)',
      },
      {
        label: 'Data Type',
        type: 'Enum',
        enumValues: executor.getSupportedTypes(),
        isRequired: true,
        description: 'Data type for the column',
      },
      {
        label: 'Allow Null',
        type: 'Boolean',
        defaultValue: true,
        description: 'Can this column contain NULL values?',
      },
      {
        label: 'Default Value',
        type: 'String',
        description: 'Default value (leave empty for no default)',
      },
      {
        label: 'Comment',
        type: 'String',
        description: 'Optional comment/description for this column',
      },
    ],
    execute: async (context, resultBuilder) => {
      try {
        // 1. Vérification permissions
        const permValidator = new PermissionValidator(options);
        const permResult = permValidator.validate(context.caller);
        if (!permResult.isValid) {
          return resultBuilder.error(permResult.errors.join(', '));
        }

        // 2. Validation du nom de colonne
        const idValidator = new IdentifierValidator();
        const nameValidation = idValidator.validateIdentifier(context.formValues.columnName);
        if (!nameValidation.isValid) {
          return resultBuilder.error(`Invalid column name: ${nameValidation.errors.join(', ')}`);
        }

        // 3. Vérifier que la colonne n'existe pas déjà
        const tableDesc = await executor.describeTable(collection.name);
        const existingColumn = tableDesc.columns.find(
          col => col.name.toLowerCase() === context.formValues.columnName.toLowerCase()
        );
        if (existingColumn) {
          return resultBuilder.error(`Column "${context.formValues.columnName}" already exists`);
        }

        // 4. Préparer l'opération
        const operation: SchemaOperation = {
          type: 'CREATE_COLUMN',
          datasource: context.collection.dataSource.name || 'default',
          collection: collection.name,
          timestamp: new Date(),
          caller: {
            id: context.caller.id,
            email: context.caller.email,
            permissionLevel: context.caller.permissionLevel,
          },
          details: {
            columnName: context.formValues.columnName,
            type: context.formValues.dataType,
            allowNull: context.formValues.allowNull,
            defaultValue: context.formValues.defaultValue || undefined,
            comment: context.formValues.comment || undefined,
          },
          dryRun: options.dryRunMode || false,
        };

        // 5. Dry-run mode: afficher le DDL sans exécuter
        if (options.dryRunMode) {
          const ddl = executor.buildDDL(operation);
          return resultBuilder.success(
            `DRY RUN - The following DDL would be executed:\n\n${ddl}\n\nNo changes were made.`,
            { type: 'text' }
          );
        }

        // 6. Callback before
        if (options.beforeSchemaChange) {
          const proceed = await options.beforeSchemaChange(operation);
          if (!proceed) {
            return resultBuilder.error('Operation cancelled by beforeSchemaChange hook');
          }
        }

        // 7. Exécution
        await executor.createColumn(collection.name, {
          name: operation.details.columnName,
          type: operation.details.type,
          allowNull: operation.details.allowNull,
          defaultValue: operation.details.defaultValue,
          comment: operation.details.comment,
        });

        // 8. Re-introspection si activé
        if (options.autoRefreshSchema) {
          // TODO: Implémenter refresh
          // await refreshSchema(context.collection.dataSource);
        }

        // 9. Callback after
        if (options.afterSchemaChange) {
          await options.afterSchemaChange(operation);
        }

        return resultBuilder.success(
          `✅ Column "${operation.details.columnName}" created successfully in table "${collection.name}"`
        );

      } catch (error) {
        // Callback error
        if (options.onError) {
          await options.onError(error, {
            type: 'CREATE_COLUMN',
            datasource: '',
            collection: collection.name,
            timestamp: new Date(),
            caller: context.caller,
            details: context.formValues,
            dryRun: false,
          });
        }

        return resultBuilder.error(`Failed to create column: ${error.message}`);
      }
    },
  });
}
```

*(Continuer avec les autres actions: create-table, drop-column, create-index, etc.)*

### Phase 4 : Validations (2 jours)

```typescript
// src/validators/identifier-validator.ts

import { ValidationResult } from '../types';

export class IdentifierValidator {
  private readonly SQL_RESERVED_WORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
    'CREATE', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'USER', 'GROUP',
    'ORDER', 'BY', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'AS', 'IN',
    // ... liste complète
  ]);

  validateIdentifier(name: string): ValidationResult {
    const errors: string[] = [];

    // Vide
    if (!name || name.trim().length === 0) {
      errors.push('Identifier cannot be empty');
      return { isValid: false, errors };
    }

    // Longueur
    if (name.length > 63) {
      errors.push('Identifier too long (max 63 characters)');
    }

    // Format: doit commencer par lettre ou underscore
    const validFormat = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validFormat.test(name)) {
      errors.push('Identifier must start with letter or underscore, and contain only alphanumeric characters and underscores');
    }

    // Mots réservés SQL
    if (this.SQL_RESERVED_WORDS.has(name.toUpperCase())) {
      errors.push(`"${name}" is a reserved SQL keyword`);
    }

    // Caractères dangereux (SQL injection)
    const dangerous = /[';\"\\--/*]/;
    if (dangerous.test(name)) {
      errors.push('Identifier contains dangerous characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateTableName(name: string, forbiddenTables: string[] = []): ValidationResult {
    const result = this.validateIdentifier(name);

    if (forbiddenTables.includes(name.toLowerCase())) {
      result.errors.push(`Table "${name}" is protected and cannot be modified`);
      result.isValid = false;
    }

    return result;
  }
}
```

```typescript
// src/validators/permission-validator.ts

import { Caller } from '@forestadmin/datasource-toolkit';
import { SchemaManagerOptions, ValidationResult } from '../types';

export class PermissionValidator {
  constructor(private options: SchemaManagerOptions) {}

  validate(caller: Caller): ValidationResult {
    const restrictTo = this.options.restrictTo || ['admin', 'developer'];

    if (!restrictTo.includes(caller.permissionLevel)) {
      return {
        isValid: false,
        errors: [
          `Insufficient permissions. Required: ${restrictTo.join(' or ')}. ` +
          `You have: ${caller.permissionLevel}`
        ],
      };
    }

    return { isValid: true, errors: [] };
  }
}
```

### Phase 5 : Plugin Principal (1-2 jours)

```typescript
// src/index.ts

import {
  DataSourceCustomizer,
  CollectionCustomizer,
  Plugin
} from '@forestadmin/datasource-customizer';

import { ExecutorFactory } from './executors/executor-factory';
import { SchemaManagerOptions } from './types';

import { addCreateTableAction } from './actions/create-table.action';
import { addCreateColumnAction } from './actions/create-column.action';
import { addDropColumnAction } from './actions/drop-column.action';
import { addModifyColumnAction } from './actions/modify-column.action';
import { addCreateIndexAction } from './actions/create-index.action';
import { addDropIndexAction } from './actions/drop-index.action';
import { addCreateForeignKeyAction } from './actions/create-foreign-key.action';

export * from './types';

const DEFAULT_OPTIONS: SchemaManagerOptions = {
  restrictTo: ['admin', 'developer'],
  requireConfirmation: true,
  dryRunMode: false,
  enableTableCreation: true,
  enableTableDeletion: false,
  enableColumnModification: true,
  enableColumnDeletion: true,
  enableIndexManagement: true,
  enableForeignKeyManagement: true,
  autoRefreshSchema: true,
};

export const addSchemaManager: Plugin<SchemaManagerOptions> = async (
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer | null,
  options?: SchemaManagerOptions,
  logger?
) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Log activation
  if (logger) {
    logger('Info', 'Schema Manager plugin activated', {
      options: opts,
      targetCollections: collectionCustomizer ? [collectionCustomizer.name] : 'all',
    });
  }

  // Déterminer les collections à traiter
  const collections = collectionCustomizer
    ? [collectionCustomizer]
    : dataSourceCustomizer.collections;

  for (const collection of collections) {
    try {
      // Créer l'executor approprié
      const nativeDriver = (collection as any).nativeDriver;
      if (!nativeDriver) {
        if (logger) {
          logger('Warn', `No native driver found for collection ${collection.name}, skipping schema manager`);
        }
        continue;
      }

      const executor = ExecutorFactory.create(nativeDriver);

      // Vérifier si l'executor supporte au moins une opération
      const supportedOps = [
        'CREATE_TABLE', 'CREATE_COLUMN', 'DROP_COLUMN', 'CREATE_INDEX'
      ].filter(op => executor.supportsOperation(op as any));

      if (supportedOps.length === 0) {
        if (logger) {
          logger('Info', `Schema manager not supported for collection ${collection.name}`);
        }
        continue;
      }

      // Ajouter les actions en fonction des options
      if (opts.enableTableCreation) {
        addCreateTableAction(collection, executor, opts);
      }

      if (opts.enableColumnModification) {
        addCreateColumnAction(collection, executor, opts);
        addModifyColumnAction(collection, executor, opts);
      }

      if (opts.enableColumnDeletion) {
        addDropColumnAction(collection, executor, opts);
      }

      if (opts.enableIndexManagement) {
        addCreateIndexAction(collection, executor, opts);
        addDropIndexAction(collection, executor, opts);
      }

      if (opts.enableForeignKeyManagement) {
        addCreateForeignKeyAction(collection, executor, opts);
      }

      if (logger) {
        logger('Info', `Schema manager actions added to collection ${collection.name}`, {
          supportedOperations: supportedOps,
        });
      }

    } catch (error) {
      if (logger) {
        logger('Error', `Failed to add schema manager to collection ${collection.name}`, {
          error: error.message,
        });
      }
      // Continue avec les autres collections
    }
  }
};

// Export par défaut
export default addSchemaManager;
```

---

## 🚀 Exemple d'Utilisation

```typescript
// Example: src/forest/agent.ts

import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { addSchemaManager } from '@forestadmin/plugin-schema-manager';

export default function makeAgent() {
  return createAgent({
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    isProduction: false,
  })
    .addDataSource(createSqlDataSource(process.env.DATABASE_URL))

    // Activer le Schema Manager avec options de sécurité
    .use(addSchemaManager, {
      // Sécurité
      restrictTo: ['admin'], // Seulement les admins
      requireConfirmation: true,
      dryRunMode: false, // Mettre à true en dev pour tester

      // Fonctionnalités
      enableTableCreation: true,
      enableTableDeletion: false, // Désactivé par sécurité
      enableColumnModification: true,
      enableColumnDeletion: true,

      // Restrictions
      forbiddenTables: ['users', 'permissions', 'sessions'],

      // Callbacks
      beforeSchemaChange: async (operation) => {
        console.log('⚠️  Schema change about to happen:', operation);
        // Envoyer notification Slack, créer backup, etc.
        return true; // Retourner false pour annuler
      },

      afterSchemaChange: async (operation) => {
        console.log('✅ Schema changed:', operation);
        // Logger l'opération, notifier l'équipe, etc.
      },

      onError: async (error, operation) => {
        console.error('❌ Schema change failed:', error, operation);
        // Alerter, rollback manuel, etc.
      },
    })

    .start();
}
```

---

## 📊 Effort Estimé

| Phase | Tâche | Jours | Priorité |
|-------|-------|-------|----------|
| 1 | Fondations (structure, types) | 3-4 | P0 |
| 2 | Executors (Sequelize + Mongo) | 4-5 | P0 |
| 3 | Actions (CREATE/DROP/MODIFY) | 3-4 | P0 |
| 4 | Validations (sécurité) | 2 | P0 |
| 5 | Plugin principal | 1-2 | P0 |
| 6 | Tests unitaires | 3-4 | P0 |
| 7 | Tests d'intégration | 2-3 | P1 |
| 8 | Documentation | 2-3 | P1 |
| 9 | Introspection/refresh | 2 | P1 |
| 10 | Migration tracking | 2-3 | P2 |
| **TOTAL** | **MVP (P0)** | **15-20 jours** | |
| **TOTAL** | **Complet (P0+P1+P2)** | **24-32 jours** | |

---

## ⚠️ Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Perte de données** | 🔴 Critique | Moyenne | Dry-run obligatoire, backups, confirmations multiples |
| **SQL Injection** | 🔴 Critique | Faible | Validation stricte, utilisation QueryInterface |
| **Downtime production** | 🔴 Critique | Moyenne | Feature flags, rollout progressif |
| **Incompatibilité SGBD** | 🟡 Moyenne | Élevée | Executor pattern, tests par dialecte |
| **Permissions insuffisantes** | 🟡 Moyenne | Faible | Validation stricte, restriction par rôle |
| **Schéma désynchronisé** | 🟡 Moyenne | Moyenne | Auto-refresh, notifications |

---

## 🎯 MVP Recommandé (Version 1.0)

Pour une première version sûre et utilisable :

**Inclure** :
- ✅ CREATE COLUMN (avec validations strictes)
- ✅ CREATE INDEX
- ✅ DROP COLUMN (avec confirmation)
- ✅ Dry-run mode obligatoire par défaut
- ✅ Restriction admin seulement
- ✅ Support Sequelize (SQL)
- ✅ Validations complètes
- ✅ Documentation extensive

**Exclure** (Version 2.0+) :
- ❌ DROP TABLE (trop dangereux pour v1)
- ❌ MODIFY COLUMN (complexe, risqué)
- ❌ Support MongoDB (à ajouter progressivement)
- ❌ Migration tracking (nice-to-have)
- ❌ Visual schema editor (futur)

---

## 📚 Questions pour Finaliser

1. **Scope** : MVP uniquement ou implémentation complète ?
2. **Priorité DB** : Commencer par SQL/Sequelize uniquement ou inclure MongoDB dès v1 ?
3. **Déploiement** : Package npm public ou usage interne seulement ?
4. **Tests** : Quel environnement de test (bases Docker) ?
5. **Sécurité** : Validation par un security review avant release ?
6. **Migration tracking** : Nécessaire pour v1 ou optionnel ?
7. **Rollback** : Implémenter un système de rollback automatique ou manuel via backups ?

---

## 📝 Conclusion

**L'implémentation est entièrement faisable** avec l'architecture actuelle de Forest Admin Agent-nodejs. Le système de plugins, l'accès aux connexions natives via `nativeDriver`, et les mécanismes de permissions existants fournissent une base solide.

**Recommandation** : Commencer par un **MVP sécurisé** (CREATE/DROP COLUMN + CREATE INDEX) avec validations strictes et dry-run par défaut, puis étendre progressivement les fonctionnalités selon les retours utilisateurs.

**Timeline réaliste** :
- MVP (2-3 semaines)
- Version complète (4-6 semaines)

**Prochaines étapes** :
1. Validation du plan avec l'équipe
2. Setup du package dans le monorepo
3. Implémentation des executors
4. Tests et validation sécurité
5. Documentation et exemples
6. Release progressive (internal → beta → public)
