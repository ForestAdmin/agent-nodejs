/* eslint-disable no-await-in-loop */
import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { Model, ModelStatic, Op, Sequelize } from 'sequelize';

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
  namespace: string;

  get requestCache(): RelaxedDataSource {
    return this.source?.requestCache;
  }

  set requestCache(value: RelaxedDataSource) {
    this.source.requestCache = value;
  }

  constructor(connection: Sequelize, source: SynchronizationSource, namespace: string) {
    this.source = source;
    this.recordCache = connection.model(`${namespace}_pending_operations`);
    this.namespace = namespace;
    this.nodes = {};
  }

  async start(target: SynchronizationTarget): Promise<void> {
    if (!this.target) {
      let record: Model = { dataValues: { id: 0 } } as Model;

      while (record) {
        record = await this.recordCache.findOne({
          where: { id: { [Op.gt]: record.dataValues.id } },
          order: [['id', 'ASC']],
        });

        if (record)
          await (record.dataValues.type === 'dump'
            ? target.applyDump(...(record.dataValues.content as [PullDumpResponse, boolean]))
            : target.applyDelta(...(record.dataValues.content as [PushDeltaResponse])));
      }

      await this.recordCache.truncate();
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
        if (!this.nodes[record.collection]) this.nodes[record.collection] = createNode();
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
        if (!this.nodes[record.collection]) this.nodes[record.collection] = createNode();
        walkNode(this.nodes[record.collection], record.record);
      }

      await this.recordCache.create({ type: 'delta', content: [changes] });
    }
  }
}
