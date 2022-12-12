import SchemaUtils from '../../../utils/schema';
import { Collection } from '../../collection';
import { RecordData } from '../../record';
import { RelationSchema } from '../../schema';

export default class Projection extends Array<string> {
  get columns(): string[] {
    return this.filter(f => !f.includes(':'));
  }

  get relations(): Record<string, Projection> {
    return this.reduce<Record<string, Projection>>((memo, path) => {
      const index = path.indexOf(':');

      if (index !== -1) {
        const field = path.substring(0, index);
        memo[field] = new Projection(...(memo[field] ?? []), path.substring(index + 1));
      }

      return memo;
    }, {});
  }

  equals(other: Projection): boolean {
    return this.length === other.length && this.every(field => other.includes(field));
  }

  replace(handler: (path: string) => Projection | string | string[], bind?: unknown): Projection {
    return this.map(handler, bind).reduce<Projection>((memo, newPaths) => {
      if (typeof newPaths === 'string') return memo.union([newPaths]);

      return memo.union(newPaths);
    }, new Projection());
  }

  union(...otherProjections: (Projection | string[])[]): Projection {
    const fields = [this, ...otherProjections].reduce(
      (memo, projection) => (projection ? [...memo, ...projection] : memo),
      [],
    );

    return new Projection(...new Set(fields));
  }

  apply(records: RecordData[]): RecordData[] {
    return records.map(record => this.reproject(record));
  }

  withPks(collection: Collection): Projection {
    const result = new Projection(...this);

    for (const pk of SchemaUtils.getPrimaryKeys(collection.schema)) {
      if (!result.includes(pk)) result.push(pk);
    }

    for (const [relation, projection] of Object.entries(this.relations)) {
      const schema = collection.schema.fields[relation] as RelationSchema;
      const association = collection.dataSource.getCollection(schema.foreignCollection);
      const projectionWithPk = projection.withPks(association).nest(relation);

      for (const field of projectionWithPk) {
        if (!result.includes(field)) result.push(field);
      }
    }

    return result;
  }

  nest(prefix: string): Projection {
    return prefix && prefix.length ? (this.map(path => `${prefix}:${path}`) as Projection) : this;
  }

  unnest(): Projection {
    const [prefix] = this[0].split(':');

    if (!this.every(path => path.startsWith(prefix))) {
      throw new Error('Cannot unnest projection.');
    }

    return this.map(path => path.substring(prefix.length + 1)) as Projection;
  }

  private reproject(record: RecordData): RecordData {
    let result: RecordData = null;

    if (record) {
      result = {};

      for (const column of this.columns) {
        result[column] = record[column];
      }

      for (const [relation, projection] of Object.entries(this.relations)) {
        result[relation] = projection.reproject(record[relation] as RecordData);
      }
    }

    return result;
  }
}
