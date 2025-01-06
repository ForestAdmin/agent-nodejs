import type CacheDataSourceInterface from '../cache-interface/datasource';
import type { NodeStudy } from '../options/schema/analyzer';
import type {
  PullDeltaReason,
  PullDumpReason,
  PullDumpResponse,
  PushDeltaResponse,
  SynchronizationSource,
  SynchronizationTarget,
} from '../types';
import type { Model, ModelStatic, Sequelize } from 'sequelize';

import { Op } from 'sequelize';

import { createNode, walkNode } from '../options/schema/analyzer';

export default class AnalysisPassThough implements SynchronizationTarget, SynchronizationSource {
  recordCache: ModelStatic<Model>;
  nodes: Record<string, NodeStudy>;
  target: SynchronizationTarget = null;
  source: SynchronizationSource;
  namespace: string;

  constructor(connection: Sequelize, source: SynchronizationSource, namespace: string) {
    this.source = source;
    this.recordCache = connection.model(`${namespace}_pending_operations`);
    this.namespace = namespace;
    this.nodes = {};
  }

  get requestCache(): CacheDataSourceInterface {
    return this.source?.requestCache;
  }

  set requestCache(value: CacheDataSourceInterface) {
    this.source.requestCache = value;
  }

  async start(target: SynchronizationTarget): Promise<void> {
    if (!this.target) {
      // Replay dump/delta that we received while analyzing the schema
      let record: Model = { dataValues: { id: 0 } } as Model;

      while (record) {
        // eslint-disable-next-line no-await-in-loop
        record = await this.recordCache.findOne({
          where: { id: { [Op.gt]: record.dataValues.id } },
          order: [['id', 'ASC']],
        });

        if (record) {
          // eslint-disable-next-line no-await-in-loop
          await (record.dataValues.type === 'dump'
            ? target.applyDump(...(record.dataValues.content as [PullDumpResponse, boolean]))
            : target.applyDelta(...(record.dataValues.content as [PushDeltaResponse])));
        }
      }

      await this.recordCache.truncate();

      // Set target so that from now on we just forward the requests
      this.target = target;
    } else {
      throw new Error('Already started');
    }
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
        if (!this.nodes[record.collection]) {
          this.nodes[record.collection] = createNode();
        }

        walkNode(this.nodes[record.collection], record.record);
      }

      await this.recordCache.create({ type: 'dump', content: [changes, firstPage] });
    }
  }

  async applyDelta(changes: PushDeltaResponse): Promise<void> {
    if (this.target) {
      await this.target.applyDelta(changes);
    } else {
      for (const record of changes.newOrUpdatedEntries) {
        if (!this.nodes[record.collection]) {
          this.nodes[record.collection] = createNode();
        }

        walkNode(this.nodes[record.collection], record.record);
      }

      await this.recordCache.create({ type: 'delta', content: [changes] });
    }
  }
}
