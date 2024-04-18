import {
  ForestServerColumnType,
  ForestServerSegment,
  ValidationType,
  WidgetEditConfiguration,
} from './types';

export type ForestSchemaV2 = {
  collections: ForestSchemaCollectionV2[];
  meta: {
    liana: string;
    liana_version: string;
    liana_features: Record<string, string> | null;
    stack: {
      engine: string;
      engine_version: string;
    };
    datasources?: { name: string; version: string }[];
    // here to store "name", "version", "dialect", and other nice to have values without formal keys
    // TODO: datasources can have more than just theses keys, just let the datasource bring the data it want. I don't think 'any' or 'unknown' is ok.
  };
};

export type ForestSchemaCollectionV2 = {
  name: string;
  fields: ForestSchemaFieldV2[];
  relations: ForestSchemaRelationV2[];

  actions?: Array<ForestSchemaActionV2>;
  segments?: Array<ForestServerSegment>;

  canList?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;

  canCount?: boolean;
  canChart?: boolean;
  canSearch?: boolean;
  canNativeQuery?: boolean;
};

export type ForestSchemaActionV2 = {
  id: string;
  name: string;
  scope: 'single' | 'bulk' | 'global';
  endpoint: string;

  fields: ForestSchemaActionFieldV2[];
  download?: boolean;
  isDynamicForm?: boolean;
};

type ForestServerActionFieldTypeV2 = ForestServerColumnType | 'File' | ['File'];

export type ForestSchemaActionFieldV2<
  TType extends ForestServerActionFieldTypeV2 = ForestServerActionFieldTypeV2,
  TWidgetEdit extends WidgetEditConfiguration | null = null,
> = {
  name: string;
  type: TType;
  description?: string;

  value: unknown;
  prefillValue: unknown;
  enumeration: null | string[];
  isReadOnly: boolean;
  reference?: string;
  isRequired: boolean;
  widget: TWidgetEdit;
};

export type ForestSchemaFieldV2 = {
  name: string;
  type: ForestServerColumnType;
  isPrimaryKey?: boolean;
  filterOperators: string[];
  enumerations?: string[];

  isWritable?: boolean;
  isSortable?: boolean;
  prefillFormValue?: unknown;
  validations?: Array<{ message: string | null; type: ValidationType; value?: unknown }>;
};

export type ForestSchemaRelationV2 = {
  name: string;
  type: 'ManyToMany' | 'ManyToOne' | 'OneToOne' | 'OneToMany';
  foreignCollection: string;

  throughCollection?: string;
  foreignKey?: string;
  foreignKeyTarget?: string;
  originKey?: string;
  originKeyTarget?: string;
};

// MASKS

export const SCHEMA_V2_FIELDS_MASK = {
  enumerations: [],
  isPrimaryKey: false,
  prefillFormValue: null,
  isSortable: true,
  isWritable: true,
  validations: [],
};

export const SCHEMA_V2_ACTION_FIELD_MASK = {
  value: null,
  prefillValue: null,
  enumeration: null,
  isReadOnly: false,
  isRequired: false,
  reference: null,
  widget: null,
};

export const SCHEMA_V2_ACTION_MASK = {
  download: false,
  isDynamicForm: false,
  fields: [],
};

export const SCHEMA_V2_COLLECTION_MASK = {
  segments: [],
  actions: [],
  fields: [], // I don't kow if we can have a collection without fields
  relations: [], // I don't kow if we can have a collection without relations
  canList: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canCount: true,
  canSearch: true,
  canChart: true,
  canNativeQuery: true,
};
