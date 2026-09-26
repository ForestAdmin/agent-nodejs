# Plugin Schema Manager - Endpoints et Interfaces

**Date**: 21 octobre 2025
**Package**: `@forestadmin/plugin-schema-manager`

---

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Endpoints (Actions Forest Admin)](#endpoints-actions-forest-admin)
  - [1. Schema: Create Table](#1-schema-create-table)
  - [2. Schema: Drop Table](#2-schema-drop-table)
  - [3. Schema: Add Column](#3-schema-add-column)
  - [4. Schema: Drop Column](#4-schema-drop-column)
  - [5. Schema: Modify Column](#5-schema-modify-column)
  - [6. Schema: Create Index](#6-schema-create-index)
  - [7. Schema: Drop Index](#7-schema-drop-index)
  - [8. Schema: Create Foreign Key](#8-schema-create-foreign-key)
- [Types de Données](#types-de-données)
- [Validations](#validations)
- [Configuration](#configuration)

---

## Vue d'ensemble

Le plugin expose **8 actions Forest Admin** accessibles depuis n'importe quelle collection. Chaque action correspond à une opération DDL (Data Definition Language) sur la base de données.

**Fichiers sources**:
- `packages/plugin-schema-manager/src/actions/*.action.ts` (8 fichiers)
- `packages/plugin-schema-manager/src/index.ts` (enregistrement des actions)

**Scope**: Toutes les actions ont un `scope: 'Global'` (pas de sélection de ligne requise)

---

## Endpoints (Actions Forest Admin)

### 1. Schema: Create Table

**Nom de l'action**: `Schema: Create Table`
**Fichier**: `src/actions/create-table.action.ts`
**Opération**: `CREATE_TABLE`
**Scope**: `Global`

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Widget |
|-------|------|--------|-------------|--------|
| `Table Name` | `String` | ✅ | Nom de la nouvelle table (snake_case recommandé) | Texte |
| `Columns (JSON)` | `String` | ✅ | Array de définitions de colonnes en format JSON | Textarea |

#### Format JSON pour Columns

```json
[
  {
    "name": "id",
    "type": "INTEGER",
    "primaryKey": true,
    "autoIncrement": true,
    "allowNull": false
  },
  {
    "name": "email",
    "type": "STRING",
    "allowNull": false,
    "unique": true
  },
  {
    "name": "created_at",
    "type": "DATE",
    "defaultValue": "NOW()",
    "allowNull": false
  }
]
```

#### Exemple de Requête

```typescript
{
  "Table Name": "users",
  "Columns (JSON)": "[{\"name\":\"id\",\"type\":\"INTEGER\",\"primaryKey\":true},{\"name\":\"name\",\"type\":\"STRING\",\"allowNull\":false}]"
}
```

#### DDL Généré (PostgreSQL)

```sql
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL
);
```

---

### 2. Schema: Drop Table

**Nom de l'action**: `Schema: Drop Table`
**Fichier**: `src/actions/drop-table.action.ts`
**Opération**: `DROP_TABLE`
**Scope**: `Global`
**⚠️ Opération destructive**

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `Table Name` | `String` | ✅ | Nom de la table à supprimer | - |
| `Type DELETE to confirm` | `String` | ✅ | Confirmation (doit taper "DELETE") | - |
| `Backup Confirmation` | `Boolean` | ✅ | Confirme avoir un backup | `false` |

#### Validations Spécifiques

- ✅ Confirmation doit être exactement "DELETE"
- ✅ `Backup Confirmation` doit être `true`
- ✅ Table ne doit pas être dans `forbiddenTables`

#### Exemple de Requête

```typescript
{
  "Table Name": "old_logs",
  "Type DELETE to confirm": "DELETE",
  "Backup Confirmation": true
}
```

#### DDL Généré (PostgreSQL)

```sql
DROP TABLE IF EXISTS "old_logs";
```

---

### 3. Schema: Add Column

**Nom de l'action**: `Schema: Add Column`
**Fichier**: `src/actions/create-column.action.ts`
**Opération**: `CREATE_COLUMN`
**Scope**: `Global`

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `Column Name` | `String` | ✅ | Nom de la nouvelle colonne | - |
| `Data Type` | `Enum` | ✅ | Type de données (dynamique selon DB) | - |
| `Allow Null` | `Boolean` | ❌ | Peut contenir NULL ? | `true` |
| `Default Value` | `String` | ❌ | Valeur par défaut | - |
| `Comment` | `String` | ❌ | Commentaire/description | - |
| `Unique` | `Boolean` | ❌ | Valeurs uniques ? | `false` |

#### Enum Values (Data Type)

**SQL (Sequelize)**: `STRING`, `TEXT`, `INTEGER`, `BIGINT`, `FLOAT`, `DOUBLE`, `BOOLEAN`, `DATE`, `UUID`, `JSON`, `BLOB`, `ENUM`

**MongoDB**: `string`, `number`, `int`, `boolean`, `date`, `object`, `array`, `objectId`, `binary`

#### Exemple de Requête

```typescript
{
  "Column Name": "phone_number",
  "Data Type": "STRING",
  "Allow Null": true,
  "Default Value": "",
  "Comment": "Contact phone",
  "Unique": false
}
```

#### DDL Généré (PostgreSQL)

```sql
ALTER TABLE "current_collection"
ADD COLUMN "phone_number" VARCHAR(255) NULL;

COMMENT ON COLUMN "current_collection"."phone_number" IS 'Contact phone';
```

---

### 4. Schema: Drop Column

**Nom de l'action**: `Schema: Drop Column`
**Fichier**: `src/actions/drop-column.action.ts`
**Opération**: `DROP_COLUMN`
**Scope**: `Global`
**⚠️ Opération destructive**

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `Column Name` | `String` | ✅ | Nom de la colonne à supprimer | - |
| `Confirmation` | `String` | ✅ | Taper "DELETE" pour confirmer | - |

#### Validations Spécifiques

- ✅ Confirmation doit être "DELETE"
- ✅ Colonne ne doit pas être primary key
- ✅ Colonne ne doit pas être dans `forbiddenColumns`
- ✅ Colonne doit exister

#### Exemple de Requête

```typescript
{
  "Column Name": "old_field",
  "Confirmation": "DELETE"
}
```

#### DDL Généré (PostgreSQL)

```sql
ALTER TABLE "current_collection"
DROP COLUMN "old_field";
```

---

### 5. Schema: Modify Column

**Nom de l'action**: `Schema: Modify Column`
**Fichier**: `src/actions/modify-column.action.ts`
**Opération**: `MODIFY_COLUMN`
**Scope**: `Global`

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `Column Name` | `String` | ✅ | Nom de la colonne à modifier | - |
| `New Data Type` | `Enum` | ✅ | Nouveau type de données | - |
| `Allow Null` | `Boolean` | ❌ | Peut contenir NULL ? | `true` |
| `Default Value` | `String` | ❌ | Nouvelle valeur par défaut | - |

#### Validations Spécifiques

- ✅ Type conversion safety check (warning si conversion risquée)
- ✅ Ne peut pas modifier les primary keys
- ⚠️ Warnings pour conversions risquées:
  - `TEXT` → `VARCHAR` (troncature possible)
  - `BIGINT` → `INTEGER` (overflow possible)
  - `DOUBLE` → `INTEGER` (perte de précision)

#### Exemple de Requête

```typescript
{
  "Column Name": "status",
  "New Data Type": "STRING",
  "Allow Null": false,
  "Default Value": "active"
}
```

#### DDL Généré (PostgreSQL)

```sql
ALTER TABLE "current_collection"
ALTER COLUMN "status" TYPE VARCHAR(255),
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active';
```

---

### 6. Schema: Create Index

**Nom de l'action**: `Schema: Create Index`
**Fichier**: `src/actions/create-index.action.ts`
**Opération**: `CREATE_INDEX`
**Scope**: `Global`

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `Index Name` | `String` | ❌ | Nom de l'index (auto-généré si vide) | - |
| `Columns (comma-separated)` | `String` | ✅ | Colonnes séparées par virgules | - |
| `Unique` | `Boolean` | ❌ | Index unique ? | `false` |
| `Index Type` | `Enum` | ❌ | Type d'index | `BTREE` |

#### Enum Values (Index Type)

`BTREE`, `HASH`, `GIST`, `GIN`, `FULLTEXT`, `SPATIAL`

⚠️ Tous les types ne sont pas supportés par toutes les bases de données

#### Exemples de Requêtes

**Index simple**:
```typescript
{
  "Index Name": "idx_email",
  "Columns (comma-separated)": "email",
  "Unique": true,
  "Index Type": "BTREE"
}
```

**Index composite**:
```typescript
{
  "Index Name": "idx_user_status",
  "Columns (comma-separated)": "user_id, status",
  "Unique": false,
  "Index Type": "BTREE"
}
```

#### DDL Généré (PostgreSQL)

**Simple**:
```sql
CREATE UNIQUE INDEX "idx_email" ON "current_collection" USING BTREE ("email");
```

**Composite**:
```sql
CREATE INDEX "idx_user_status" ON "current_collection" USING BTREE ("user_id", "status");
```

---

### 7. Schema: Drop Index

**Nom de l'action**: `Schema: Drop Index`
**Fichier**: `src/actions/drop-index.action.ts`
**Opération**: `DROP_INDEX`
**Scope**: `Global`

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `Index Name` | `String` | ✅ | Nom de l'index à supprimer | - |

#### Validations Spécifiques

- ✅ Index doit exister

#### Exemple de Requête

```typescript
{
  "Index Name": "idx_old_index"
}
```

#### DDL Généré (PostgreSQL)

```sql
DROP INDEX IF EXISTS "idx_old_index";
```

---

### 8. Schema: Create Foreign Key

**Nom de l'action**: `Schema: Create Foreign Key`
**Fichier**: `src/actions/create-foreign-key.action.ts`
**Opération**: `CREATE_FOREIGN_KEY`
**Scope**: `Global`

#### Interface (Formulaire)

| Champ | Type | Requis | Description | Default |
|-------|------|--------|-------------|---------|
| `FK Name` | `String` | ❌ | Nom de la contrainte (auto-généré si vide) | - |
| `Columns (comma-separated)` | `String` | ✅ | Colonnes locales | - |
| `Referenced Table` | `String` | ✅ | Table référencée | - |
| `Referenced Columns (comma-separated)` | `String` | ✅ | Colonnes référencées | - |
| `On Delete` | `Enum` | ❌ | Action lors d'une suppression | `NO ACTION` |
| `On Update` | `Enum` | ❌ | Action lors d'une mise à jour | `NO ACTION` |

#### Enum Values (On Delete / On Update)

- `CASCADE`: Cascade la suppression/update
- `SET NULL`: Met NULL
- `NO ACTION`: Aucune action (erreur si violation)
- `RESTRICT`: Empêche la suppression/update
- `SET DEFAULT`: Met la valeur par défaut

#### Exemples de Requêtes

**FK simple**:
```typescript
{
  "FK Name": "fk_user",
  "Columns (comma-separated)": "user_id",
  "Referenced Table": "users",
  "Referenced Columns (comma-separated)": "id",
  "On Delete": "CASCADE",
  "On Update": "NO ACTION"
}
```

**FK composite**:
```typescript
{
  "FK Name": "fk_user_tenant",
  "Columns (comma-separated)": "user_id, tenant_id",
  "Referenced Table": "users",
  "Referenced Columns (comma-separated)": "id, tenant_id",
  "On Delete": "CASCADE",
  "On Update": "CASCADE"
}
```

#### DDL Généré (PostgreSQL)

**Simple**:
```sql
ALTER TABLE "current_collection"
ADD CONSTRAINT "fk_user"
FOREIGN KEY ("user_id")
REFERENCES "users" ("id")
ON DELETE CASCADE
ON UPDATE NO ACTION;
```

**Composite**:
```sql
ALTER TABLE "current_collection"
ADD CONSTRAINT "fk_user_tenant"
FOREIGN KEY ("user_id", "tenant_id")
REFERENCES "users" ("id", "tenant_id")
ON DELETE CASCADE
ON UPDATE CASCADE;
```

---

## Types de Données

### SQL (Sequelize)

Types supportés par le plugin via `executor.getSupportedTypes()`:

| Type | Description | Exemple |
|------|-------------|---------|
| `STRING` | Chaîne variable (VARCHAR) | `"Hello"` |
| `TEXT` | Texte long | `"Long text..."` |
| `CHAR` | Chaîne fixe | `"AB"` |
| `INTEGER` | Entier 32-bit | `42` |
| `BIGINT` | Entier 64-bit | `9007199254740991` |
| `FLOAT` | Float simple précision | `3.14` |
| `REAL` | Alias pour FLOAT | `3.14` |
| `DOUBLE` | Float double précision | `3.14159265359` |
| `DECIMAL` | Décimal précis | `99.99` |
| `BOOLEAN` | Booléen | `true` / `false` |
| `DATE` | Date avec heure | `2025-10-21T10:30:00Z` |
| `DATEONLY` | Date seulement | `2025-10-21` |
| `TIME` | Heure seulement | `10:30:00` |
| `UUID` | UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |
| `JSON` | JSON (PostgreSQL, MySQL 5.7+) | `{"key": "value"}` |
| `JSONB` | JSON binaire (PostgreSQL) | `{"key": "value"}` |
| `BLOB` | Données binaires | `Buffer` |
| `ENUM` | Énumération | `"active"` / `"inactive"` |

### MongoDB

Types supportés:

| Type | Description | Exemple |
|------|-------------|---------|
| `string` | Chaîne | `"Hello"` |
| `number` | Nombre (double) | `3.14` |
| `int` | Entier 32-bit | `42` |
| `long` | Entier 64-bit | `9007199254740991` |
| `double` | Double précision | `3.14159265359` |
| `decimal` | Decimal128 | `99.99` |
| `boolean` | Booléen | `true` / `false` |
| `date` | Date | `ISODate("2025-10-21")` |
| `timestamp` | Timestamp | `Timestamp(1729508400, 1)` |
| `object` | Objet imbriqué | `{nested: "value"}` |
| `array` | Array | `[1, 2, 3]` |
| `objectId` | ObjectId | `ObjectId("507f1f77bcf86cd799439011")` |
| `binary` | Données binaires | `BinData(0, "...")` |
| `null` | Null | `null` |

---

## Validations

Chaque action effectue plusieurs validations avant exécution:

### 1. Permissions (`validatePermissions`)

```typescript
// Fichier: src/utils/action-helpers.ts
validatePermissions(caller, options): ValidationResult
```

- ✅ Vérifie que `caller.permissionLevel` est dans `options.restrictTo`
- ✅ Par défaut: `['admin', 'developer']`

### 2. Identifiers (`validateIdentifier`)

```typescript
// Fichier: src/validators/identifier-validator.ts
validateIdentifier(name, strict): ValidationResult
```

- ✅ Format: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- ✅ Max 63 caractères
- ✅ Pas de caractères dangereux: `[';\"\\--/*]`
- ✅ Protection SQL reserved words (100+ mots)
- ✅ Protection contre SQL injection

**Mots réservés SQL** (extrait):
```
SELECT, INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TABLE,
WHERE, FROM, JOIN, UNION, ORDER, GROUP, HAVING, INDEX,
PRIMARY, FOREIGN, KEY, CONSTRAINT, CASCADE, ...
```

### 3. Types (`validateType`, `validateTypeChange`)

```typescript
// Fichier: src/validators/type-validator.ts
validateType(type, supportedTypes): ValidationResult
validateTypeChange(fromType, toType): ValidationResult
```

- ✅ Type doit être supporté par le SGBD
- ✅ Conversions sûres détectées (ex: `INTEGER` → `BIGINT`)
- ⚠️ Warnings pour conversions risquées:
  - `TEXT` → `VARCHAR` : troncature possible
  - `BIGINT` → `INTEGER` : overflow possible
  - `DOUBLE` → `INTEGER` : perte de précision décimale

### 4. Default Values (`validateDefaultValue`)

```typescript
// Fichier: src/validators/type-validator.ts
validateDefaultValue(value, type): ValidationResult
```

- ✅ `INTEGER`: doit être un entier
- ✅ `FLOAT`/`DOUBLE`: doit être un nombre
- ✅ `BOOLEAN`: accepte `true`, `false`, `1`, `0`, `"true"`, `"false"`
- ✅ `DATE`: Date object ou chaîne valide
- ✅ `JSON`: objet ou chaîne JSON valide
- ✅ `UUID`: format UUID valide

### 5. Forbidden Lists

- ✅ `forbiddenTables`: tables protégées
- ✅ `forbiddenColumns`: colonnes protégées (ex: `id`, `created_at`)

---

## Configuration

### Options Principales

```typescript
interface SchemaManagerOptions {
  // Sécurité
  restrictTo?: Array<'admin' | 'developer' | 'editor' | 'user'>;
  requireConfirmation?: boolean;
  dryRunMode?: boolean;

  // Features (enable/disable par opération)
  enableTableCreation?: boolean;
  enableTableDeletion?: boolean;
  enableColumnModification?: boolean;
  enableColumnDeletion?: boolean;
  enableIndexManagement?: boolean;
  enableForeignKeyManagement?: boolean;

  // Restrictions
  forbiddenTables?: string[];
  forbiddenColumns?: string[];
  allowedDatabases?: string[];

  // Callbacks
  beforeSchemaChange?: (operation: SchemaOperation) => Promise<boolean>;
  afterSchemaChange?: (operation: SchemaOperation) => Promise<void>;
  onError?: (error: Error, operation: SchemaOperation) => Promise<void>;

  // Advanced
  autoRefreshSchema?: boolean;
}
```

### Defaults

```typescript
{
  restrictTo: ['admin', 'developer'],
  requireConfirmation: true,
  dryRunMode: false,
  enableTableCreation: true,
  enableTableDeletion: false,        // ⚠️ Désactivé par défaut
  enableColumnModification: true,
  enableColumnDeletion: true,
  enableIndexManagement: true,
  enableForeignKeyManagement: true,
  autoRefreshSchema: false,
  forbiddenTables: [],
  forbiddenColumns: [],
}
```

### Exemple de Configuration Complète

```typescript
import { addSchemaManager } from '@forestadmin/plugin-schema-manager';

createAgent(options)
  .addDataSource(createSqlDataSource(DATABASE_URL))
  .use(addSchemaManager, {
    // Sécurité stricte
    restrictTo: ['admin'],
    requireConfirmation: true,
    dryRunMode: false,

    // Features sélectives
    enableTableCreation: true,
    enableTableDeletion: false,      // Désactivé en prod
    enableColumnModification: true,
    enableColumnDeletion: true,
    enableIndexManagement: true,
    enableForeignKeyManagement: true,

    // Protection
    forbiddenTables: ['users', 'sessions', 'permissions'],
    forbiddenColumns: ['id', 'created_at', 'updated_at'],

    // Callbacks pour audit
    beforeSchemaChange: async (operation) => {
      console.log(`⚠️  ${operation.type} by ${operation.caller.email}`);
      await sendSlackAlert(operation);
      return true;  // return false pour annuler
    },

    afterSchemaChange: async (operation) => {
      console.log(`✅ ${operation.type} completed`);
      await logAuditTable(operation);
    },

    onError: async (error, operation) => {
      console.error(`❌ ${operation.type} failed: ${error.message}`);
      await sendPagerDutyAlert(error);
    },
  })
  .start();
```

---

## Schéma d'Opération

Toutes les actions partagent la même interface `SchemaOperation`:

```typescript
interface SchemaOperation {
  type: 'CREATE_TABLE' | 'DROP_TABLE' | 'CREATE_COLUMN' | 'DROP_COLUMN' |
        'MODIFY_COLUMN' | 'CREATE_INDEX' | 'DROP_INDEX' | 'CREATE_FOREIGN_KEY';
  datasource: string;
  collection: string;
  timestamp: Date;
  caller: {
    email: string;
    firstName?: string;
    lastName?: string;
    permissionLevel: string;
  };
  details: any;  // Spécifique à chaque opération
  ddl?: string;  // DDL généré (si dryRunMode ou preview)
}
```

---

## Support Base de Données

| Base de Données | Statut | Tables | Colonnes | Index | Foreign Keys |
|-----------------|--------|--------|----------|-------|--------------|
| **PostgreSQL** | ✅ Complet | ✅ | ✅ | ✅ | ✅ |
| **MySQL** | ✅ Complet | ✅ | ✅ | ✅ | ✅ |
| **MariaDB** | ✅ Complet | ✅ | ✅ | ✅ | ✅ |
| **SQLite** | ⚠️ Partiel | ✅ | ⚠️ Limité | ✅ | ⚠️ Limité |
| **MongoDB** | ⚠️ Partiel | ✅ | ⚠️ Schema-less | ✅ | ❌ |

### Notes SQLite
- ❌ `ALTER COLUMN` non supporté nativement (nécessite recréation table)
- ⚠️ Foreign keys nécessitent `PRAGMA foreign_keys = ON`

### Notes MongoDB
- ⚠️ Colonnes: utilise `$jsonSchema` validators (optionnel)
- ⚠️ Modify column: non applicable (schema-less)
- ❌ Foreign keys: non supportées (pas de contraintes FK natives)

---

## Exemples d'Utilisation

### Scénario 1: Ajouter une colonne phone à users

1. Ouvrir collection `users` dans Forest Admin
2. Cliquer **Actions** → **Schema: Add Column**
3. Remplir:
   - Column Name: `phone_number`
   - Data Type: `STRING`
   - Allow Null: `true`
   - Default Value: (vide)
   - Unique: `false`
4. Cliquer **Execute**
5. ✅ Colonne créée instantanément

**DDL exécuté**:
```sql
ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(255) NULL;
```

### Scénario 2: Créer un index composite

1. Ouvrir collection `orders`
2. Cliquer **Actions** → **Schema: Create Index**
3. Remplir:
   - Index Name: `idx_user_status`
   - Columns: `user_id, status`
   - Unique: `false`
   - Index Type: `BTREE`
4. Cliquer **Execute**
5. ✅ Index créé

**DDL exécuté**:
```sql
CREATE INDEX "idx_user_status" ON "orders" USING BTREE ("user_id", "status");
```

### Scénario 3: Dry-Run Preview

Configuration:
```typescript
.use(addSchemaManager, { dryRunMode: true })
```

Résultat:
```
DRY RUN MODE - Preview only, no changes made

The following DDL would be executed:
ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(255) NULL;

No changes were applied.
```

---

## Fichiers de Référence

| Fichier | Lignes | Description |
|---------|--------|-------------|
| `src/actions/create-table.action.ts` | 112 | Action CREATE TABLE |
| `src/actions/drop-table.action.ts` | 115 | Action DROP TABLE |
| `src/actions/create-column.action.ts` | 145 | Action ADD COLUMN |
| `src/actions/drop-column.action.ts` | 92 | Action DROP COLUMN |
| `src/actions/modify-column.action.ts` | 134 | Action MODIFY COLUMN |
| `src/actions/create-index.action.ts` | 131 | Action CREATE INDEX |
| `src/actions/drop-index.action.ts` | 76 | Action DROP INDEX |
| `src/actions/create-foreign-key.action.ts` | 165 | Action CREATE FOREIGN KEY |
| `src/index.ts` | 174 | Plugin principal |
| `src/types.ts` | 168 | Interfaces TypeScript |
| `src/utils/action-helpers.ts` | 93 | Helpers validation |
| `src/validators/identifier-validator.ts` | 178 | Validation identifiers |
| `src/validators/type-validator.ts` | 179 | Validation types |
| `src/validators/permission-validator.ts` | 30 | Validation permissions |

---

## Sécurité

### ⚠️ Opérations Destructives

| Action | Danger | Protection |
|--------|--------|------------|
| **Drop Table** | 🔴 Critique | Confirmation "DELETE" + Backup checkbox |
| **Drop Column** | 🟡 Élevé | Confirmation "DELETE" |
| **Modify Column** | 🟡 Moyen | Type conversion warnings |
| **Drop Index** | 🟢 Faible | Aucune (réversible) |

### Checklist Sécurité

- ✅ **Permissions**: `restrictTo: ['admin']`
- ✅ **SQL Injection**: Validation stricte identifiers
- ✅ **Forbidden Lists**: `forbiddenTables`, `forbiddenColumns`
- ✅ **Confirmations**: Required pour DROP operations
- ✅ **Callbacks**: `beforeSchemaChange` pour approval workflow
- ✅ **Dry-Run**: `dryRunMode: true` pour preview
- ✅ **Audit**: `afterSchemaChange` pour logging

---

## Ressources

- 📄 **README.md**: Documentation complète
- 📄 **EXAMPLE.md**: Tutoriel step-by-step
- 📄 **QUICKSTART.md**: Guide démarrage rapide
- 📄 **implementation-summary.md**: Résumé implémentation
- 📄 **schema-manager-analysis.md**: Analyse architecture (62KB)

---

**✅ Document complet des 8 endpoints avec interfaces détaillées**
