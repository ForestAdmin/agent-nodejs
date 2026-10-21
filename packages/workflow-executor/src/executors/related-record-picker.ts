import type { RecordData, CollectionSchema } from '../types/validated/collection';
import type { BaseMessage } from '@forestadmin/ai-proxy';

import { DynamicStructuredTool, HumanMessage, SystemMessage } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { InvalidAIResponseError } from '../errors';

// What ranking candidates needs of the step that asks: its AI, the context message every AI call of
// that step opens with, and a warning that carries the step's log context.
export interface PickerAi {
  invoke<T>(messages: BaseMessage[], tool: DynamicStructuredTool): Promise<T>;
  contextMessage: SystemMessage;
  warn(message: string, context: Record<string, unknown>): void;
}

const SELECT_FIELDS_SYSTEM_PROMPT = `You are an AI agent selecting the most relevant fields to identify a related record.
Choose the fields that are most useful for determining which record best matches the user request.`;

const SELECT_RECORD_SYSTEM_PROMPT = `You are an AI agent selecting the most relevant related record from a list of candidates.
Choose the record that best matches the user request based on the provided field values.`;

const SELECT_RECORDS_SYSTEM_PROMPT = `You are an AI agent selecting the related records relevant to a user request from a list of candidates.
Choose every record that matches the request based on the provided field values, and none that does not.`;

// Only appended when -1 is a valid answer. The base prompt tells the AI to always pick, so without
// this it forces a weak match on an impossible request instead of declining.
const SELECT_RECORD_NONE_ALLOWED_PROMPT = `If the request states a specific requirement that NO candidate satisfies, return -1 instead of forcing an arbitrary or loosely-related match. Do NOT return -1 merely because a match is imperfect — only when no candidate genuinely fits the request.`;

// Bound only what is sent to the AI in selectBestRecordIndex — the full candidate list is
// always returned to the front via availableRecordIds. These cap the prompt size, not the data.
const MAX_RELEVANT_FIELDS = 6;
const MAX_FIELD_VALUE_LENGTH = 80; // per-field serialized length before truncation
const MAX_AI_CANDIDATES_CHARS = 16_000; // global budget for the `Candidates:` block (~4k tokens)

function clampFieldValue(value: unknown): unknown {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  if (serialized.length <= MAX_FIELD_VALUE_LENGTH) return value;

  return `${serialized.slice(0, MAX_FIELD_VALUE_LENGTH)}… (truncated)`;
}

/** AI call 1 for HasMany: selects the most relevant fields to compare candidates. */
export async function selectRelevantFields(
  ai: PickerAi,
  schema: CollectionSchema,
  prompt: string | undefined,
): Promise<string[]> {
  const nonRelationFields = schema.fields.filter(f => !f.isRelationship);

  if (nonRelationFields.length === 0) return [];

  // Use displayName in both the enum and the prompt for consistency — the AI sees human-readable
  // names throughout. Results are mapped back to technical fieldNames before returning.
  const displayNames = nonRelationFields.map(f => f.displayName) as [string, ...string[]];

  const tool = new DynamicStructuredTool({
    name: 'select-fields',
    description: 'Select the most relevant fields to identify the right record.',
    schema: z.object({
      fieldNames: z
        .array(z.enum(displayNames))
        .min(1)
        .max(MAX_RELEVANT_FIELDS)
        .describe(
          `The ${MAX_RELEVANT_FIELDS} fields most useful for identifying the relevant record`,
        ),
    }),
    func: undefined,
  });

  const messages = [
    ai.contextMessage,
    new SystemMessage(SELECT_FIELDS_SYSTEM_PROMPT),
    new SystemMessage(
      `The related records are from the "${schema.collectionDisplayName}" collection. ` +
        `Available fields: ${nonRelationFields.map(f => f.displayName).join(', ')}.`,
    ),
    new HumanMessage(`**Request**: ${prompt ?? 'Select the most relevant record.'}`),
  ];

  const { fieldNames: selectedDisplayNames } = await ai.invoke<{
    fieldNames: string[];
  }>(messages, tool);

  // Zod's .min(1) shapes the prompt but is NOT validated against the AI response.
  // Guard explicitly to avoid silently passing all fields to selectBestRecordIndex.
  if (selectedDisplayNames.length === 0) {
    throw new InvalidAIResponseError(
      `AI returned no field names for field selection in collection "${schema.collectionName}"`,
    );
  }

  // Map display names back to technical field names — values in RecordData are keyed by fieldName.
  // .max() shapes the prompt only (not validated against the response), so cap explicitly.
  return selectedDisplayNames
    .slice(0, MAX_RELEVANT_FIELDS)
    .map(dn => nonRelationFields.find(f => f.displayName === dn)?.fieldName ?? dn);
}

// Bound the prompt only — the full candidate list is still returned upstream. Accumulate
// lines until the global budget is reached (always keep at least the first candidate).
function candidateLines(
  candidates: RecordData[],
  fieldNames: string[],
): { lines: string[]; shown: number; truncated: boolean } {
  const filteredCandidates = candidates.map((c, i) => {
    const entries = Object.entries(c.values).filter(
      ([k]) => fieldNames.length === 0 || fieldNames.includes(k),
    );

    return {
      index: i,
      values: Object.fromEntries(entries.map(([k, v]) => [k, clampFieldValue(v)])),
    };
  });

  const lines: string[] = [];
  let usedChars = 0;

  for (const c of filteredCandidates) {
    const line = `[${c.index}] ${JSON.stringify(c.values)}`;
    if (lines.length > 0 && usedChars + line.length > MAX_AI_CANDIDATES_CHARS) break;
    lines.push(line);
    usedChars += line.length + 1;
  }

  return { lines, shown: lines.length, truncated: lines.length < candidates.length };
}

/** AI call 2 for a Multiple step: picks every candidate relevant to the request. */
export async function selectRelevantRecordIndexes(
  ai: PickerAi,
  candidates: RecordData[],
  fieldNames: string[],
  prompt: string | undefined,
): Promise<{ indexes: number[]; confident: boolean; sawAll: boolean }> {
  const { lines, shown, truncated } = candidateLines(candidates, fieldNames);
  const maxIndex = shown - 1;
  const tool = new DynamicStructuredTool({
    name: 'select-records-by-content',
    description: 'Select every related record relevant to the request, by index.',
    schema: z.object({
      recordIndexes: z
        .array(z.number().int().min(0).max(maxIndex))
        .describe(
          `0-based indexes of the records relevant to the request (0 to ${maxIndex}), empty when none is`,
        ),
      confident: z
        .boolean()
        .describe(
          'true when the records picked clearly match the request; false when unsure which ' +
            'records the request means',
        ),
      reasoning: z.string().describe('Why these records were chosen (or why none is relevant)'),
    }),
    func: undefined,
  });

  const messages = [
    ai.contextMessage,
    new SystemMessage(SELECT_RECORDS_SYSTEM_PROMPT),
    new SystemMessage(`Candidates:\n${lines.join('\n')}`),
    new HumanMessage(`**Request**: ${prompt ?? 'Select the relevant records.'}`),
  ];

  const { recordIndexes, confident } = await ai.invoke<{
    recordIndexes: number[];
    confident?: boolean;
    reasoning: string;
  }>(messages, tool);

  // The Zod bounds shape the tool prompt only; this guard is the runtime enforcement.
  if (
    !Array.isArray(recordIndexes) ||
    recordIndexes.some(index => !Number.isInteger(index) || index < 0 || index > maxIndex)
  ) {
    throw new InvalidAIResponseError(
      `AI selected record indexes ${JSON.stringify(recordIndexes)} outside 0-${maxIndex}`,
    );
  }

  return {
    indexes: [...new Set(recordIndexes)],
    confident: confident !== false,
    sawAll: !truncated,
  };
}

export async function selectBestRecordIndex(
  ai: PickerAi,
  candidates: RecordData[],
  fieldNames: string[],
  prompt: string | undefined,
  allowNone = false,
): Promise<{ index: number; confident: boolean }> {
  const { lines, shown, truncated } = candidateLines(candidates, fieldNames);

  if (truncated) {
    ai.warn('load-related-record: candidate list truncated for AI prompt', {
      shown,
      total: candidates.length,
    });
  }

  // "None relevant" (-1) is only trustworthy when the AI saw the whole list. If it was truncated,
  // force a pick from what was shown — otherwise a match in the unseen tail would be silently skipped.
  const noneAllowed = allowNone && !truncated;
  const maxIndex = shown - 1;
  const minIndex = noneAllowed ? -1 : 0;
  const tool = new DynamicStructuredTool({
    name: 'select-record-by-content',
    description: 'Select the most relevant related record by its index.',
    schema: z.object({
      recordIndex: z
        .number()
        .int()
        .min(minIndex)
        .max(maxIndex)
        .describe(
          noneAllowed
            ? `0-based index of the most relevant record (0 to ${maxIndex}), or -1 if none of the candidates is relevant`
            : `0-based index of the most relevant record (0 to ${maxIndex})`,
        ),
      confident: z
        .boolean()
        .describe(
          'true when one candidate clearly best matches the request; false when several ' +
            'candidates fit similarly well and you cannot confidently single one out',
        ),
      reasoning: z.string().describe('Why this record was chosen (or why none is relevant)'),
    }),
    func: undefined,
  });

  const messages = [
    ai.contextMessage,
    new SystemMessage(SELECT_RECORD_SYSTEM_PROMPT),
    ...(noneAllowed ? [new SystemMessage(SELECT_RECORD_NONE_ALLOWED_PROMPT)] : []),
    new SystemMessage(`Candidates:\n${lines.join('\n')}`),
    new HumanMessage(`**Request**: ${prompt ?? 'Select the most relevant record.'}`),
  ];

  const { recordIndex, confident: rawConfident } = await ai.invoke<{
    recordIndex: number;
    confident?: boolean;
    reasoning: string;
  }>(messages, tool);

  // The Zod .min().max() shapes the tool prompt only — NOT validated against the AI response; this
  // guard is the sole runtime enforcement. -1 is accepted only when noneAllowed (allowNone && !truncated).
  if (!Number.isInteger(recordIndex) || recordIndex < minIndex || recordIndex > maxIndex) {
    throw new InvalidAIResponseError(
      `AI selected record index ${recordIndex} which is out of range (${minIndex}-${maxIndex}) or not an integer`,
    );
  }

  // A definitive -1 ("none relevant") is not ambiguity. For a positive pick, honour the AI's
  // confidence flag, defaulting to confident when omitted so a missing flag still auto-loads.
  const confident = recordIndex < 0 ? true : rawConfident !== false;

  return { index: recordIndex, confident };
}
