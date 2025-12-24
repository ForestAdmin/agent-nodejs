/* eslint-disable import/prefer-default-export */
import type { Model, Schema } from 'mongoose';

import { deleteModel, model } from 'mongoose';

export function buildModel(schema: Schema, modelName = 'aModel'): Model<unknown> {
  try {
    deleteModel(modelName);
  } catch {
    // Ignore error
  }

  return model<unknown>(modelName, schema);
}
