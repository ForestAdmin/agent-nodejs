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

/** In mongoose 6.X and 7.X versions, objectId is written in different ways.
 * This is a list of all the possible values.
 * @see https://github.com/Automattic/mongoose/commit/021862316ee2cd9ac7b1c8d5d6b0ba67745e0416
 */
export const OBJECT_ID_VALUES = ['ObjectId', 'ObjectID'];
