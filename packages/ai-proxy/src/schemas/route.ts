import type { Messages } from '../remote-tools';
import type {
  ChatCompletionMessage,
  ChatCompletionTool,
  ChatCompletionToolChoice,
} from '../provider';

import { z } from 'zod';

// Base query schema with common optional parameters
const baseQuerySchema = z.object({
  'ai-name': z.string().optional(),
  'tool-name': z.string().optional(),
});

/**
 * Route: ai-query
 *
 * Note: messages, tools, and tool_choice use z.any() because OpenAI types are complex
 * and frequently evolve. Runtime validation happens downstream in the OpenAI SDK.
 * The type casts ensure TypeScript type safety while allowing flexibility.
 */
const aiQuerySchema = z.object({
  route: z.literal('ai-query'),
  query: baseQuerySchema.optional(),
  body: z.object(
    {
      messages: z.array(z.any(), {
        message: 'Missing required body parameter: messages',
      }) as z.ZodType<ChatCompletionMessage[]>,
      tools: z.array(z.any()).optional() as z.ZodType<ChatCompletionTool[] | undefined>,
      tool_choice: z.any().optional() as z.ZodType<ChatCompletionToolChoice | undefined>,
      parallel_tool_calls: z.boolean().optional(),
    },
    { message: 'Missing required parameter: body' },
  ),
});

// Query schema for invoke-remote-tool (tool-name is required)
const invokeRemoteToolQuerySchema = z.object(
  {
    'ai-name': z.string().optional(),
    'tool-name': z.string({ message: 'Missing required query parameter: tool-name' }),
  },
  { message: 'Missing required parameter: query' },
);

/**
 * Route: invoke-remote-tool
 *
 * Note: inputs uses z.any() because the message format is validated downstream.
 */
const invokeRemoteToolSchema = z.object({
  route: z.literal('invoke-remote-tool'),
  query: invokeRemoteToolQuerySchema,
  body: z.object(
    {
      inputs: z.array(z.any(), {
        message: 'Missing required body parameter: inputs',
      }) as z.ZodType<Messages>,
    },
    { message: 'Missing required parameter: body' },
  ),
});

// Route: remote-tools (no body required)
const remoteToolsSchema = z.object({
  route: z.literal('remote-tools'),
  query: baseQuerySchema.optional(),
});

// Discriminated union on 'route'
export const routeArgsSchema = z.discriminatedUnion('route', [
  aiQuerySchema,
  invokeRemoteToolSchema,
  remoteToolsSchema,
]);

// Inferred types (replace manual types)
export type RouteArgs = z.infer<typeof routeArgsSchema>;
export type AiQueryArgs = z.infer<typeof aiQuerySchema>;
export type InvokeRemoteToolArgs = z.infer<typeof invokeRemoteToolSchema>;
export type RemoteToolsArgs = z.infer<typeof remoteToolsSchema>;

// Derived types for consumers
export type DispatchBody = AiQueryArgs['body'];
