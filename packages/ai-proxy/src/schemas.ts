import { z } from 'zod';

// OpenAI tool call schema
const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

// OpenAI message schemas - strict validation with discriminated union
const systemMessageSchema = z.object({
  role: z.literal('system'),
  content: z.string(),
  name: z.string().optional(),
});

const userMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([
    z.string(),
    z.array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string() }) }),
      ]),
    ),
  ]),
  name: z.string().optional(),
});

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string().nullable().optional(),
  name: z.string().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
  refusal: z.string().nullable().optional(),
});

const toolMessageSchema = z.object({
  role: z.literal('tool'),
  content: z.string(),
  tool_call_id: z.string(),
});

// Discriminated union for all message types
const messageSchema = z.discriminatedUnion('role', [
  systemMessageSchema,
  userMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
]);

// OpenAI tool definition schema
const toolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    strict: z.boolean().optional(),
  }),
});

// OpenAI tool_choice schema
const toolChoiceSchema = z.union([
  z.literal('none'),
  z.literal('auto'),
  z.literal('required'),
  z.object({
    type: z.literal('function'),
    function: z.object({ name: z.string() }),
  }),
]);

// ai-query body schema (OpenAI ChatCompletion format)
export const dispatchBodySchema = z.object({
  messages: z.array(messageSchema).min(1, 'messages must contain at least one message'),
  tools: z.array(toolDefinitionSchema).optional(),
  tool_choice: toolChoiceSchema.optional(),
});

// invoke-remote-tool body schema
export const invokeRemoteToolBodySchema = z.object({
  inputs: z.array(messageSchema).min(1, 'inputs must contain at least one message'),
});

// invoke-remote-tool query schema
export const invokeToolQuerySchema = z.object({
  'tool-name': z.string().min(1, 'tool-name is required'),
});

// Inferred types
export type DispatchBodySchema = z.infer<typeof dispatchBodySchema>;
export type InvokeRemoteToolBodySchema = z.infer<typeof invokeRemoteToolBodySchema>;
export type InvokeToolQuerySchema = z.infer<typeof invokeToolQuerySchema>;
export type Message = z.infer<typeof messageSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
