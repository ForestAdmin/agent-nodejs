import { z } from 'zod';

/**
 * Zod preprocess to handle LLM sending values as JSON string instead of object.
 * Some LLMs may serialize the values object as a JSON string, so we need to parse it.
 */
export const valuesWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.record(z.string(), z.unknown()));

/**
 * Creates the Zod argument shape for action tools (executeAction and getActionForm).
 *
 * @param collectionNames - Optional list of collection names for enum validation
 * @returns Zod schema shape for action tool arguments
 */
export function createActionArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0 ? z.enum(collectionNames as [string, ...string[]]) : z.string(),
    actionName: z.string().describe('The name of the action.'),
    recordIds: z
      .array(z.union([z.string(), z.number()]))
      .nullable()
      .describe('The IDs of the records to execute the action on. Use null for global actions.'),
    values: valuesWithPreprocess.optional().describe('Optional values for the action form fields.'),
  };
}
