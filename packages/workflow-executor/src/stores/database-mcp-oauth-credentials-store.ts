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

const TABLE_NAME = 'ai_mcp_oauth_credentials';

export interface DatabaseMcpOAuthCredentialsStoreOptions {
  sequelize: Sequelize;
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
  enc_key_version: number;
}

export default class DatabaseMcpOAuthCredentialsStore implements McpOAuthCredentialsStore {
  private readonly sequelize: Sequelize;

  constructor(options: DatabaseMcpOAuthCredentialsStoreOptions) {
    this.sequelize = options.sequelize;
  }

  async init(logger?: Logger): Promise<void> {
    const umzug = new Umzug({
      migrations: [
        {
          name: '002_create_mcp_oauth_credentials',
          up: async ({ context }: { context: QueryInterface }) => {
            await context.createTable(TABLE_NAME, {
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
              encKeyVersion: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: 'enc_key_version',
              },
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
            });

            await context.addIndex(TABLE_NAME, ['user_id', 'mcp_server_id'], {
              unique: true,
              name: 'idx_user_id_mcp_server_id',
            });
          },
          down: async ({ context }: { context: QueryInterface }) => {
            await context.dropTable(TABLE_NAME);
          },
        },
      ],
      context: this.sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize: this.sequelize }),
      logger: undefined,
    });

    try {
      await umzug.up();
    } catch (error) {
      logger?.('Error', 'MCP OAuth credentials migration failed', {
        error: extractErrorMessage(error),
      });
      throw error;
    }
  }

  async get(userId: number, mcpServerId: string): Promise<StoredMcpOAuthCredential | null> {
    const [rows] = await this.sequelize.query(
      `SELECT * FROM ${TABLE_NAME} WHERE user_id = :userId AND mcp_server_id = :mcpServerId`,
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
        encKeyVersion: credential.encKeyVersion,
        now,
      };

      // Delete + insert in transaction: dialect-agnostic upsert (avoids ON CONFLICT / ON DUPLICATE).
      await this.sequelize.query(
        `DELETE FROM ${TABLE_NAME} WHERE user_id = :userId AND mcp_server_id = :mcpServerId`,
        { replacements, transaction },
      );
      await this.sequelize.query(
        `INSERT INTO ${TABLE_NAME} ` +
          '(user_id, mcp_server_id, refresh_token_enc, client_id, client_secret_enc, ' +
          'client_secret_expires_at, token_endpoint, token_endpoint_auth_method, scopes, ' +
          'enc_key_version, created_at, updated_at) VALUES ' +
          '(:userId, :mcpServerId, :refreshTokenEnc, :clientId, :clientSecretEnc, ' +
          ':clientSecretExpiresAt, :tokenEndpoint, :tokenEndpointAuthMethod, :scopes, ' +
          ':encKeyVersion, :now, :now)',
        { replacements, transaction },
      );
    });
  }

  async delete(userId: number, mcpServerId: string): Promise<void> {
    await this.sequelize.query(
      `DELETE FROM ${TABLE_NAME} WHERE user_id = :userId AND mcp_server_id = :mcpServerId`,
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
      encKeyVersion: Number(row.enc_key_version),
    };
  }
}
