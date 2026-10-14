import type { Collection } from '../../collection';
import type { RecordData } from '../../record';

import SchemaUtils from '../../../utils/schema';

export default class Projection extends Array<string> {
  get columns(): string[] {
    return this.filter(f => !f.includes(':'));
  }

  get relations(): Record<string, Projection> {
    const relations: Record<string, Projection> = {};

    for (const path of this) {
      const index = path.indexOf(':');

      if (index !== -1) {
        const field = path.substring(0, index);
        relations[field] ??= new Projection();
        relations[field].push(path.substring(index + 1));
      }
    }

    return relations;
  }

  equals(other: Projection): boolean {
    const otherFields = new Set(other);

    return this.length === other.length && this.every(field => otherFields.has(field));
  }

  replace(handler: (path: string) => Projection | string | string[], bind?: unknown): Projection {
    const fields = new Set<string>();

    for (const newPaths of this.map(handler, bind)) {
      if (typeof newPaths === 'string') fields.add(newPaths);
      else if (newPaths) for (const path of newPaths) fields.add(path);
    }

    return Projection.fromFields(fields);
  }

  union(...otherProjections: (Projection | string[])[]): Projection {
    const fields = new Set<string>();

    for (const projection of [this, ...otherProjections]) {
      if (projection) for (const path of projection) fields.add(path);
    }

    return Projection.fromFields(fields);
  }

  apply(records: RecordData[]): RecordData[] {
    return records.map(record => this.reproject(record));
  }

  withPks(collection: Collection): Projection {
    const result = Projection.fromFields(this);
    const fields = new Set<string>(this);

    const add = (field: string) => {
      if (!fields.has(field)) {
        fields.add(field);
        result.push(field);
      }
    };

    SchemaUtils.getPrimaryKeys(collection.schema).forEach(add);

    for (const [relation, projection] of Object.entries(this.relations)) {
      const schema = SchemaUtils.getRelation(collection.schema, relation, collection.name);
      const association = collection.dataSource.getCollection(schema.foreignCollection);

      projection.withPks(association).nest(relation).forEach(add);
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

  private static fromFields(fields: Iterable<string>): Projection {
    const projection = new Projection();

    for (const field of fields) projection.push(field);

    return projection;
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
