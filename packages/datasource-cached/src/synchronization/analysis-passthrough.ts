import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { Model, ModelStatic, Sequelize } from 'sequelize';

import { NodeStudy, createNode, walkNode } from '../options/schema/analyzer';
import {
  PullDeltaReason,
  PullDumpReason,
  PullDumpResponse,
  PushDeltaResponse,
  SynchronizationSource,
  SynchronizationTarget,
} from '../types';

export default class AnalysisPassThough implements SynchronizationTarget, SynchronizationSource {
  recordCache: ModelStatic<Model>;
  nodes: Record<string, NodeStudy>;
  target: SynchronizationTarget = null;
  source: SynchronizationSource;

  get requestCache(): RelaxedDataSource {
    return this.source?.requestCache;
  }

  set requestCache(value: RelaxedDataSource) {
    this.source.requestCache = value;
  }

  constructor(connection: Sequelize, source: SynchronizationSource) {
    this.source = source;
    this.recordCache = connection.model('forest_pending_records');
    this.nodes = {};
  }

  async start(target: SynchronizationTarget): Promise<void> {
    // replay dump / delta on the target.
    // truncate the record cache
    // and passthrough all new changes to the target
    this.target = target;
  }

  queuePullDump(reason: PullDumpReason): Promise<void> {
    return this.source.queuePullDump(reason);
  }

  queuePullDelta(reason: PullDeltaReason): Promise<void> {
    return this.source.queuePullDelta(reason);
  }

  async applyDump(changes: PullDumpResponse, firstPage: boolean): Promise<void> {
    if (this.target) {
      await this.target.applyDump(changes, firstPage);
    } else {
      for (const record of changes.entries) {
        if (!this.nodes[record.collection]) this.nodes[record.collection] = createNode();
        walkNode(this.nodes[record.collection], record.record);
      }

      await this.recordCache.bulkCreate(changes.entries);
    }
  }

  async applyDelta(changes: PushDeltaResponse): Promise<void> {
    if (this.target) {
      await this.target.applyDelta(changes);
    } else {
      for (const record of changes.newOrUpdatedEntries) {
        if (!this.nodes[record.collection]) this.nodes[record.collection] = createNode();
        walkNode(this.nodes[record.collection], record.record);
      }

      await this.recordCache.bulkCreate(changes.newOrUpdatedEntries);
    }
  }
}
