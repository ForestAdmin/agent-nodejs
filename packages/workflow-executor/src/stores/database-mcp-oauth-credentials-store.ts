import type { Logger } from '../ports/logger-port';
import type {
  McpOAuthCredentialInput,
  McpOAuthCredentialsStore,
  StoredMcpOAuthCredential,
} from '../ports/mcp-oauth-credentials-store';
import type { QueryInterface, Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

import { extractErrorMessage } from '../errors';
import {
  resolveSchema,
  runMigrations,
  tableId as toTableId,
  tableReference as toTableReference,
} from './schema-migrations';

const TABLE_NAME = 'ai_mcp_oauth_credentials';

export interface DatabaseMcpOAuthCredentialsStoreOptions {
  sequelize: Sequelize;
  schema?: string;
}

interface CredentialRow {
  id: number;
  user_id: number;
  mcp_server_id: string;
  refresh_token_enc: Buffer;
  client_id: string | null;
  client_secret_enc: Buffer | null;
  client_secret_expires_at: string | Date | null;
  token_endpoint: string;
  token_endpoint_auth_method: string | null;
  scopes: string | null;
}

export default class DatabaseMcpOAuthCredentialsStore implements McpOAuthCredentialsStore {
  private readonly sequelize: Sequelize;

  private readonly configuredSchema?: string;

  constructor(options: DatabaseMcpOAuthCredentialsStoreOptions) {
    this.sequelize = options.sequelize;
    this.configuredSchema = options.schema;
  }

  private get schema(): string | undefined {
    return resolveSchema(this.sequelize, this.configuredSchema);
  }

  private get tableReference(): string {
    return toTableReference(this.schema, TABLE_NAME);
  }

  async init(logger?: Logger): Promise<void> {
    const { schema } = this;
    const tableId = toTableId(schema, TABLE_NAME);

    const umzug = new Umzug({
      migrations: [
        {
          name: '002_create_mcp_oauth_credentials',
          up: async ({ context }: { context: QueryInterface }) => {
            // Atomic (table + index) and idempotent so a half-applied or already-applied run can't
            // crash-loop boot.
            await context.sequelize.transaction(async transaction => {
              if (await context.tableExists(tableId, { transaction })) return;

              await context.createTable(
                tableId,
                {
                  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
                  mcpServerId: {
                    type: DataTypes.STRING(255),
                    allowNull: false,
                    field: 'mcp_server_id',
                  },
                  refreshTokenEnc: {
                    type: DataTypes.BLOB,
                    allowNull: false,
                    field: 'refresh_token_enc',
                  },
                  clientId: { type: DataTypes.STRING(255), allowNull: true, field: 'client_id' },
                  clientSecretEnc: {
                    type: DataTypes.BLOB,
                    allowNull: true,
                    field: 'client_secret_enc',
                  },
                  clientSecretExpiresAt: {
                    type: DataTypes.DATE,
                    allowNull: true,
                    field: 'client_secret_expires_at',
                  },
                  tokenEndpoint: {
                    type: DataTypes.STRING(2048),
                    allowNull: false,
                    field: 'token_endpoint',
                  },
                  tokenEndpointAuthMethod: {
                    type: DataTypes.STRING(64),
                    allowNull: true,
                    field: 'token_endpoint_auth_method',
                  },
                  scopes: { type: DataTypes.STRING(2048), allowNull: true, field: 'scopes' },
                  createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                    field: 'created_at',
                  },
                  updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                    field: 'updated_at',
                  },
                },
                { transaction },
              );

              await context.addIndex(tableId, ['user_id', 'mcp_server_id'], {
                unique: true,
                name: 'idx_user_id_mcp_server_id',
                transaction,
              });
            });
          },
          down: async ({ context }: { context: QueryInterface }) => {
            await context.dropTable(tableId);
          },
        },
      ],
      context: this.sequelize.getQueryInterface(),
      storage: new SequelizeStorage({
        sequelize: this.sequelize,
        ...(schema ? { schema } : {}),
      }),
      logger: undefined,
    });

    await runMigrations({
      sequelize: this.sequelize,
      umzug,
      schema,
      logger,
      failMessage: 'MCP OAuth credentials migration failed',
    });
  }

  async get(userId: number, mcpServerId: string): Promise<StoredMcpOAuthCredential | null> {
    const [rows] = await this.sequelize.query(
      `SELECT * FROM ${this.tableReference} WHERE user_id = :userId AND mcp_server_id = :mcpServerId`,
      { replacements: { userId, mcpServerId } },
    );

    const row = (rows as CredentialRow[])[0];

    return row ? DatabaseMcpOAuthCredentialsStore.toCredential(row) : null;
  }

  async upsert(credential: McpOAuthCredentialInput): Promise<void> {
    await this.sequelize.transaction(async transaction => {
      const now = new Date();
      const replacements = {
        userId: credential.userId,
        mcpServerId: credential.mcpServerId,
        refreshTokenEnc: credential.refreshTokenEnc,
        clientId: credential.clientId ?? null,
        clientSecretEnc: credential.clientSecretEnc ?? null,
        clientSecretExpiresAt: credential.clientSecretExpiresAt ?? null,
        tokenEndpoint: credential.tokenEndpoint ?? null,
        tokenEndpointAuthMethod: credential.tokenEndpointAuthMethod ?? null,
        scopes: credential.scopes ?? null,
        now,
      };

      // Delete + insert in transaction: dialect-agnostic upsert (avoids ON CONFLICT / ON DUPLICATE).
      await this.sequelize.query(
        `DELETE FROM ${this.tableReference} WHERE user_id = :userId AND mcp_server_id = :mcpServerId`,
        { replacements, transaction },
      );
      await this.sequelize.query(
        `INSERT INTO ${this.tableReference} ` +
          '(user_id, mcp_server_id, refresh_token_enc, client_id, client_secret_enc, ' +
          'client_secret_expires_at, token_endpoint, token_endpoint_auth_method, scopes, ' +
          'created_at, updated_at) VALUES ' +
          '(:userId, :mcpServerId, :refreshTokenEnc, :clientId, :clientSecretEnc, ' +
          ':clientSecretExpiresAt, :tokenEndpoint, :tokenEndpointAuthMethod, :scopes, ' +
          ':now, :now)',
        { replacements, transaction },
      );
    });
  }

  async delete(userId: number, mcpServerId: string): Promise<void> {
    await this.sequelize.query(
      `DELETE FROM ${this.tableReference} WHERE user_id = :userId AND mcp_server_id = :mcpServerId`,
      { replacements: { userId, mcpServerId } },
    );
  }

  async close(logger?: Logger): Promise<void> {
    try {
      await this.sequelize.close();
    } catch (error) {
      logger?.('Error', 'Failed to close database connection', {
        error: extractErrorMessage(error),
      });
    }
  }

  private static toCredential(row: CredentialRow): StoredMcpOAuthCredential {
    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      mcpServerId: row.mcp_server_id,
      refreshTokenEnc: row.refresh_token_enc,
      clientId: row.client_id ?? null,
      clientSecretEnc: row.client_secret_enc ?? null,
      clientSecretExpiresAt:
        row.client_secret_expires_at == null ? null : new Date(row.client_secret_expires_at),
      tokenEndpoint: row.token_endpoint,
      tokenEndpointAuthMethod: row.token_endpoint_auth_method ?? null,
      scopes: row.scopes ?? null,
    };
  }
}
