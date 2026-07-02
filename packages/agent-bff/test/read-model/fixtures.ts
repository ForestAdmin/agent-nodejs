import type { Metrics } from '../../src/ports/metrics-port';
import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
} from '@forestadmin/forestadmin-client';

export function makeMetrics(): jest.Mocked<Metrics> {
  return { increment: jest.fn(), gauge: jest.fn() };
}

export function column(field: string): ForestSchemaField {
  return {
    field,
    type: 'String',
    enum: null,
    reference: null,
    isReadOnly: false,
    isRequired: false,
    isPrimaryKey: field === 'id',
  };
}

export function relation(
  field: string,
  relationship: 'BelongsTo' | 'HasOne' | 'HasMany' | 'BelongsToMany',
  reference: string,
): ForestSchemaField {
  return { ...column(field), reference, relationship };
}

export function polymorphic(field: string, models: string[]): ForestSchemaField {
  return { ...column(field), relationship: 'BelongsTo', polymorphicReferencedModels: models };
}

export function action(name: string, endpoint: string): ForestSchemaAction {
  return {
    id: `${name}-id`,
    name,
    type: 'single',
    endpoint,
    download: false,
    fields: [],
    hooks: { load: false, change: [] },
  };
}

export function collection(
  name: string,
  fields: ForestSchemaField[],
  actions: ForestSchemaAction[] = [],
): ForestSchemaCollection {
  return { name, fields, actions };
}

export function makeSchema(name: string): ForestSchemaCollection[] {
  return [collection(name, [])];
}
