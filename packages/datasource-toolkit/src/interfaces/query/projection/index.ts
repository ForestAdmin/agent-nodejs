import type { Collection } from '../../collection';
import type { RecordData } from '../../record';

import SchemaUtils from '../../../utils/schema';

type ProjectionTree = { columns: string[]; relations: [string, ProjectionTree][] };

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
    if (this.length !== other.length) return false;

    const otherFields = new Set(other);

    return this.every(field => otherFields.has(field));
  }

  replace(
    handler: (path: string) => Projection | string | string[] | null,
    bind?: unknown,
  ): Projection {
    const fields = new Set<string>();

    for (let index = 0; index < this.length; index += 1) {
      const newPaths = handler.call(bind, this[index], index, this);

      if (typeof newPaths === 'string') fields.add(newPaths);
      else if (newPaths) for (const path of newPaths) fields.add(path);
    }

    return Projection.from(fields) as Projection;
  }

  union(...otherProjections: (Projection | string[])[]): Projection {
    const fields = new Set<string>();

    for (const projection of [this, ...otherProjections]) {
      if (projection) for (const path of projection) fields.add(path);
    }

    return Projection.from(fields) as Projection;
  }

  apply(records: RecordData[]): RecordData[] {
    const tree = this.compileTree();

    return records.map(record => Projection.reproject(record, tree));
  }

  withPks(collection: Collection): Projection {
    const result = Projection.from(this) as Projection;
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

  private compileTree(): ProjectionTree {
    return {
      columns: this.columns,
      relations: Object.entries(this.relations).map(([relation, projection]) => [
        relation,
        projection.compileTree(),
      ]),
    };
  }

  private static reproject(record: RecordData, tree: ProjectionTree): RecordData {
    if (!record) return null;

    const result: RecordData = {};

    for (const column of tree.columns) {
      result[column] = record[column];
    }

    for (const [relation, subTree] of tree.relations) {
      result[relation] = Projection.reproject(record[relation] as RecordData, subTree);
    }

    return result;
  }
}
