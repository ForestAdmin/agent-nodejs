/* eslint-disable import/prefer-default-export */
import { Model, Schema, deleteModel, model } from 'mongoose';

export function buildModel(schema: Schema, modelName = 'aModel'): Model<unknown> {
  try {
    deleteModel(modelName);
  } catch {
    // Ignore error
  }

  return model<unknown>(modelName, schema);
}
