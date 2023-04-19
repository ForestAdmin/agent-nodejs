import type { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export type ForestSchema = {
  collections: ForestServerCollection[];
  metadata: {
    liana: string;
    liana_version: string;
    stack: {
      engine: string;
      engine_version: string;
    };
  };
};

export type ForestServerColumnType =
  | PrimitiveTypes
  | [ForestServerColumnType]
  | { fields: Array<{ field: string; type: ForestServerColumnType }> };

export type ForestServerCollection = {
  name: string;
  icon: null;
  integration: null;
  isReadOnly: boolean;
  isSearchable: boolean;
  isVirtual: false;
  onlyForRelationships: boolean;
  paginationType: 'page';
  actions: Array<ForestServerAction>;
  fields: Array<ForestServerField>;
  segments: Array<ForestServerSegment>;
};

export type ForestServerAction = {
  id: string;
  name: string;
  type: 'single' | 'bulk' | 'global';
  baseUrl: string;
  endpoint: string;
  httpMethod: 'POST';
  redirect: unknown;
  download: boolean;
  fields: ForestServerActionField[];
  hooks: {
    load: boolean;
    change: Array<unknown>;
  };
};

export type ForestServerActionField = {
  value: unknown;
  defaultValue: unknown;
  description: string | null;
  enums: string[];
  field: string;
  hook: string;
  isReadOnly: boolean;
  isRequired: boolean;
  reference: string | null;
  type: ForestServerColumnType;
  widget: null | 'belongsto select' | 'file picker';
};

export type ForestServerField = Partial<{
  field: string;
  type: ForestServerColumnType;
  defaultValue: unknown;
  enums: null | string[];
  integration: null; // Always null on forest-express
  isFilterable: boolean;
  isPrimaryKey: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isSortable: boolean;
  isVirtual: boolean; // Computed. Not sure what is done with that knowledge on the frontend.
  reference: null | string;
  inverseOf: null | string;
  relationship: 'BelongsTo' | 'BelongsToMany' | 'HasMany' | 'HasOne';
  validations: Array<{ message: string | null; type: ValidationType; value?: unknown }>;
}>;

export type ForestServerSegment = {
  id: string;
  name: string;
};

export type ValidationType =
  | 'contains'
  | 'is after'
  | 'is before'
  | 'is greater than'
  | 'is less than'
  | 'is like'
  | 'is longer than'
  | 'is present'
  | 'is shorter than';
