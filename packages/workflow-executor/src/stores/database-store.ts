import type { Logger } from '../ports/logger-port';
import type { ClaimOutcome, RunStore } from '../ports/run-store';
import type { StepExecutionData } from '../types/step-execution-data';
import type { QueryInterface, Sequelize, Transaction } from 'sequelize';

import { DataTypes, UniqueConstraintError } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

import { RunStorePortError, WorkflowExecutorError, extractErrorMessage } from '../errors';

const TABLE_NAME = 'workflow_step_executions';

export interface DatabaseStoreOptions {
  sequelize: Sequelize;
}

export default class DatabaseStore implements RunStore {
  private readonly sequelize: Sequelize;

  constructor(options: DatabaseStoreOptions) {
    this.sequelize = options.sequelize;
  }

  async init(logger?: Logger): Promise<void> {
    const umzug = new Umzug({
      migrations: [
        {
          name: '001_create_workflow_step_executions',
          up: async ({ context }: { context: QueryInterface }) => {
            await context.createTable(TABLE_NAME, {
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
            });

            await context.addIndex(TABLE_NAME, ['run_id'], { name: 'idx_run_id' });
            await context.addIndex(TABLE_NAME, ['run_id', 'step_index'], {
              unique: true,
              name: 'idx_run_id_step_index',
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

    return this.callPort('init', async () => {
      try {
        await umzug.up();
      } catch (error) {
        logger?.error('Database migration failed', {
          error: extractErrorMessage(error),
        });
        throw error;
      }
    });
  }

  async getStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.callPort('getStepExecutions', async () => {
      const [rows] = await this.sequelize.query(
        `SELECT data FROM ${TABLE_NAME} WHERE run_id = :runId ORDER BY step_index ASC`,
        { replacements: { runId } },
      );

      return (rows as Array<{ data: string | StepExecutionData }>).map(row =>
        typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      );
    });
  }

  async saveStepExecution(runId: string, stepExecution: StepExecutionData): Promise<void> {
    return this.callPort('saveStepExecution', async () => {
      // Delete + insert in transaction: dialect-agnostic upsert (avoids ON CONFLICT / ON DUPLICATE)
      await this.sequelize.transaction(transaction =>
        this.writeData(runId, stepExecution, transaction),
      );
    });
  }

  async claimStepExecution(runId: string, seed: StepExecutionData): Promise<ClaimOutcome> {
    return this.callPort('claimStepExecution', async () => {
      try {
        return await this.sequelize.transaction(async transaction => {
          const row = await this.readPhaseForUpdate(runId, seed.stepIndex, transaction);

          if (row.phase === 'done' || row.phase === 'executing') return row.phase;

          // Existing but unclaimed row is locked by FOR UPDATE: overwrite in place. No row: plain
          // INSERT so a concurrent claimer loses on the unique (run_id, step_index) index — a
          // delete+insert here would erase the rival's row and let both win.
          if (row.exists) await this.updateData(runId, seed, transaction);
          else await this.insertData(runId, seed, transaction);

          return 'won';
        });
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          return (await this.readPhase(runId, seed.stepIndex)) === 'done' ? 'done' : 'executing';
        }

        throw error;
      }
    });
  }

  // FOR UPDATE locks an existing row so a concurrent claimer blocks until commit; omitted on
  // dialects without row locking (sqlite), which serialize writes anyway.
  private async readPhaseForUpdate(
    runId: string,
    stepIndex: number,
    transaction: Transaction,
  ): Promise<{ exists: boolean; phase?: 'executing' | 'done' }> {
    const lock = ['postgres', 'mysql', 'mariadb'].includes(this.sequelize.getDialect())
      ? ' FOR UPDATE'
      : '';
    const [rows] = await this.sequelize.query(
      `SELECT data FROM ${TABLE_NAME} WHERE run_id = :runId AND step_index = :stepIndex${lock}`,
      { replacements: { runId, stepIndex }, transaction },
    );
    const typed = rows as Array<{ data: string | StepExecutionData }>;

    return { exists: typed.length > 0, phase: this.extractPhase(typed) };
  }

  private async readPhase(
    runId: string,
    stepIndex: number,
  ): Promise<'executing' | 'done' | undefined> {
    const [rows] = await this.sequelize.query(
      `SELECT data FROM ${TABLE_NAME} WHERE run_id = :runId AND step_index = :stepIndex`,
      { replacements: { runId, stepIndex } },
    );

    return this.extractPhase(rows as Array<{ data: string | StepExecutionData }>);
  }

  private extractPhase(
    rows: Array<{ data: string | StepExecutionData }>,
  ): 'executing' | 'done' | undefined {
    if (!rows.length) return undefined;
    const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;

    return (data as { idempotencyPhase?: 'executing' | 'done' }).idempotencyPhase;
  }

  private async writeData(
    runId: string,
    stepExecution: StepExecutionData,
    transaction: Transaction,
  ): Promise<void> {
    await this.sequelize.query(
      `DELETE FROM ${TABLE_NAME} WHERE run_id = :runId AND step_index = :stepIndex`,
      { replacements: { runId, stepIndex: stepExecution.stepIndex }, transaction },
    );
    await this.insertData(runId, stepExecution, transaction);
  }

  private async insertData(
    runId: string,
    stepExecution: StepExecutionData,
    transaction: Transaction,
  ): Promise<void> {
    const now = new Date();
    const replacements = {
      runId,
      stepIndex: stepExecution.stepIndex,
      data: JSON.stringify(stepExecution),
      now,
    };

    await this.sequelize.query(
      `INSERT INTO ${TABLE_NAME} (run_id, step_index, data, created_at, updated_at) VALUES (:runId, :stepIndex, :data, :now, :now)`,
      { replacements, transaction },
    );
  }

  private async updateData(
    runId: string,
    stepExecution: StepExecutionData,
    transaction: Transaction,
  ): Promise<void> {
    await this.sequelize.query(
      `UPDATE ${TABLE_NAME} SET data = :data, updated_at = :now WHERE run_id = :runId AND step_index = :stepIndex`,
      {
        replacements: {
          runId,
          stepIndex: stepExecution.stepIndex,
          data: JSON.stringify(stepExecution),
          now: new Date(),
        },
        transaction,
      },
    );
  }

  async close(logger?: Logger): Promise<void> {
    return this.callPort('close', async () => {
      try {
        await this.sequelize.close();
      } catch (error) {
        logger?.error('Failed to close database connection', {
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
