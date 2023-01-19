export type FlattenOptions = {
  asModels?: string[];
  asFields?: string[];
};

export type ManualFlattenOptions = {
  flattenMode: 'manual';
  flattenOptions?: {
    [modelName: string]: {
      asModels?: string[];
      asFields?: Array<string | { field: string; level: number }>;
    };
  };
};

export type AutoFlattenOptions = {
  flattenMode: 'auto';
};

export type NoFlattenOptions = {
  flattenMode: 'none';
};

export type LegacyFlattenOptions = {
  flattenMode?: 'legacy';
  asModels?: { [modelName: string]: string[] };
};

export type MongooseOptions =
  | ManualFlattenOptions
  | AutoFlattenOptions
  | NoFlattenOptions
  | LegacyFlattenOptions;

export type Stack = {
  prefix: string | null;
  asFields: string[];
  asModels: string[];
}[];
