import type ActionCollectionDecorator from './actions/collection';
import type BinaryCollectionDecorator from './binary/collection';
import type ChartDataSourceDecorator from './chart/datasource';
import type ComputedCollectionDecorator from './computed/collection';
import type HookCollectionDecorator from './hook/collection';
import type OperatorsEmulateCollectionDecorator from './operators-emulate/collection';
import type OverrideCollectionDecorator from './override/collection';
import type PublicationDataSourceDecorator from './publication/datasource';
import type RelationCollectionDecorator from './relation/collection';
import type RenameFieldCollectionDecorator from './rename-field/collection';
import type SchemaCollectionDecorator from './schema/collection';
import type SearchCollectionDecorator from './search/collection';
import type SegmentCollectionDecorator from './segment/collection';
import type SortEmulateCollectionDecorator from './sort-emulate/collection';
import type ValidationCollectionDecorator from './validation/collection';
import type WriteDataSourceDecorator from './write/datasource';
import type { DataSource, DataSourceDecorator, Logger } from '@forestadmin/datasource-toolkit';

import { MissingSchemaElementError } from '@forestadmin/datasource-toolkit';

export type Options = {
  ignoreMissingSchemaElementErrors?: boolean;
};

export default abstract class DecoratorsStackBase {
  protected customizations: Array<(logger: Logger) => Promise<void>> = [];
  private options: Required<Options>;

  public dataSource: DataSource;

  action: DataSourceDecorator<ActionCollectionDecorator>;
  binary: DataSourceDecorator<BinaryCollectionDecorator>;
  chart: ChartDataSourceDecorator;
  earlyComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  earlyOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  hook: DataSourceDecorator<HookCollectionDecorator>;
  lateComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  lateOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  publication: PublicationDataSourceDecorator;
  relation: DataSourceDecorator<RelationCollectionDecorator>;
  renameField: DataSourceDecorator<RenameFieldCollectionDecorator>;
  schema: DataSourceDecorator<SchemaCollectionDecorator>;
  search: DataSourceDecorator<SearchCollectionDecorator>;
  segment: DataSourceDecorator<SegmentCollectionDecorator>;
  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;
  validation: DataSourceDecorator<ValidationCollectionDecorator>;
  write: WriteDataSourceDecorator;
  override: DataSourceDecorator<OverrideCollectionDecorator>;

  constructor(options: Options) {
    this.options = {
      ignoreMissingSchemaElementErrors: false,
      ...(options || {}),
    };
  }

  abstract buildStack(dataSource: DataSource): void;

  backupStack() {
    return {
      action: this.action,
      binary: this.binary,
      chart: this.chart,
      earlyComputed: this.earlyComputed,
      earlyOpEmulate: this.earlyOpEmulate,
      hook: this.hook,
      lateComputed: this.lateComputed,
      lateOpEmulate: this.lateOpEmulate,
      publication: this.publication,
      relation: this.relation,
      renameField: this.renameField,
      schema: this.schema,
      search: this.search,
      segment: this.segment,
      sortEmulate: this.sortEmulate,
      validation: this.validation,
      write: this.write,
      override: this.override,
    };
  }

  restoreStack(stack) {
    this.action = stack.action;
    this.binary = stack.binary;
    this.chart = stack.chart;
    this.earlyComputed = stack.earlyComputed;
    this.earlyOpEmulate = stack.earlyOpEmulate;
    this.hook = stack.hook;
    this.lateComputed = stack.lateComputed;
    this.lateOpEmulate = stack.lateOpEmulate;
    this.publication = stack.publication;
    this.relation = stack.relation;
    this.renameField = stack.renameField;
    this.schema = stack.schema;
    this.search = stack.search;
    this.segment = stack.segment;
    this.sortEmulate = stack.sortEmulate;
    this.validation = stack.validation;
    this.write = stack.write;
    this.override = stack.override;
  }

  queueCustomization(customization: (logger: Logger) => Promise<void>): void {
    this.customizations.push(customization);
  }

  /**
   * Apply all customizations
   * Plugins may queue new customizations, or call other plugins which will queue customizations.
   *
   * This method will be called recursively and clears the queue at each recursion to ensure
   * that all customizations are applied in the right order.
   */
  async applyQueuedCustomizations(logger: Logger, dataSource: DataSource): Promise<void> {
    const isFirstStack = !!this.dataSource;

    // backup customization, stack and last datasource
    const customizationsBackup = Array.from(this.customizations);
    const stackBackup = this.backupStack();
    const dataSourceBackup = this.dataSource;

    this.buildStack(dataSource);

    try {
      await this._applyQueuedCustomizations(logger);
    } catch (error) {
      if (!isFirstStack) {
        throw error;
      } else {
        this.restoreStack(stackBackup);
        this.dataSource = dataSourceBackup;
        logger(
          'Error',
          `Agent failed to restart with the new configuration. Retaining the previous one.\n  ${error}`,
        );
      }
    } finally {
      this.customizations = customizationsBackup;
    }
  }

  private async _applyQueuedCustomizations(logger: Logger): Promise<void> {
    const queuedCustomizations = this.customizations.slice();
    this.customizations.length = 0;

    while (queuedCustomizations.length) {
      const firstInQueue = queuedCustomizations.shift();

      try {
        await firstInQueue(logger); // eslint-disable-line no-await-in-loop
      } catch (e) {
        if (
          this.options.ignoreMissingSchemaElementErrors &&
          e instanceof MissingSchemaElementError
        ) {
          logger('Warn', e.message, e);
        } else {
          throw e;
        }
      }

      await this._applyQueuedCustomizations(logger); // eslint-disable-line no-await-in-loop
    }
  }
}
