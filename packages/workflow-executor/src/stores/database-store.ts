import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { StepExecutionData } from '../types/step-execution-data';
import type { QueryInterface, Sequelize } from 'sequelize';

import { DataTypes } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

import { RunStorePortError, WorkflowExecutorError, extractErrorMessage } from '../errors';
import {
  resolveSchema,
  runMigrations,
  tableId as toTableId,
  tableReference as toTableReference,
} from './schema-migrations';

const TABLE_NAME = 'workflow_step_executions';

export interface DatabaseStoreOptions {
  sequelize: Sequelize;
  schema?: string;
}

export default class DatabaseStore implements RunStore {
  private readonly sequelize: Sequelize;

  private readonly configuredSchema?: string;

  constructor(options: DatabaseStoreOptions) {
    this.sequelize = options.sequelize;
    this.configuredSchema = options.schema;
  }

  private get schema(): string | undefined {
    return resolveSchema(this.sequelize, this.configuredSchema);
  }

  private get tableId(): string | { tableName: string; schema: string } {
    return toTableId(this.schema, TABLE_NAME);
  }

  private get tableReference(): string {
    return toTableReference(this.schema, TABLE_NAME);
  }

  async init(logger?: Logger): Promise<void> {
    const { schema, tableId } = this;

    const umzug = new Umzug({
      migrations: [
        {
          name: '001_create_workflow_step_executions',
          up: async ({ context }: { context: QueryInterface }) => {
            // Atomic (table + indexes) and idempotent so a half-applied or already-applied run
            // can't crash-loop boot.
            await context.sequelize.transaction(async transaction => {
              if (await context.tableExists(tableId, { transaction })) return;

              await context.createTable(
                tableId,
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  runId: {
                    type: DataTypes.STRING(255),
                    allowNull: false,
                    field: 'run_id',
                  },
                  stepIndex: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    field: 'step_index',
                  },
                  data: {
                    type: DataTypes.JSON,
                    allowNull: false,
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
                },
                { transaction },
              );

              await context.addIndex(tableId, ['run_id'], { name: 'idx_run_id', transaction });
              await context.addIndex(tableId, ['run_id', 'step_index'], {
                unique: true,
                name: 'idx_run_id_step_index',
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

    return this.callPort('init', () =>
      runMigrations({
        sequelize: this.sequelize,
        umzug,
        schema,
        logger,
        failMessage: 'Database migration failed',
      }),
    );
  }

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.callPort('getStepExecutions', async () => {
      const [rows] = await this.sequelize.query(
        `SELECT data FROM ${this.tableReference} WHERE run_id = :runId ORDER BY step_index ASC`,
        { replacements: { runId } },
      );

      return (rows as Array<{ data: string | StepExecutionData }>).map(row =>
        typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      );
    });
  }

  async saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    return this.callPort('saveStepExecution', async () => {
      await this.sequelize.transaction(async transaction => {
        const now = new Date();
        const data = JSON.stringify(stepExecution);
        const replacements = { runId, stepIndex: stepExecution.stepIndex, data, now };

        // Delete + insert in transaction: dialect-agnostic upsert (avoids ON CONFLICT / ON DUPLICATE)
        await this.sequelize.query(
          `DELETE FROM ${this.tableReference} WHERE run_id = :runId AND step_index = :stepIndex`,
          { replacements, transaction },
        );
        await this.sequelize.query(
          `INSERT INTO ${this.tableReference} (run_id, step_index, data, created_at, updated_at) VALUES (:runId, :stepIndex, :data, :now, :now)`,
          { replacements, transaction },
        );
      });
    });
  }

  async deleteStepExecution(runId: string, stepIndex: number): Promise<void> {
    return this.callPort('deleteStepExecution', async () => {
      await this.sequelize.query(
        `DELETE FROM ${this.tableReference} WHERE run_id = :runId AND step_index = :stepIndex`,
        { replacements: { runId, stepIndex } },
      );
    });
  }

  async close(logger?: Logger): Promise<void> {
    return this.callPort('close', async () => {
      try {
        await this.sequelize.close();
      } catch (error) {
        logger?.('Error', 'Failed to close database connection', {
          error: extractErrorMessage(error),
        });
      }
    });
  }

  private async callPort<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new RunStorePortError(operation, cause);
    }
  }
}
