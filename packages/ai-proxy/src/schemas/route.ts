import type {
  ChatCompletionMessage,
  ChatCompletionTool,
  ChatCompletionToolChoice,
} from '../provider-dispatcher';
import type { Messages } from '../remote-tools';

import { z } from 'zod';

// Base query schema with common optional parameters
const baseQuerySchema = z.object({
  'ai-name': z.string().optional(),
  'tool-name': z.string().optional(),
});

// Route: ai-query
const aiQuerySchema = z.object({
  route: z.literal('ai-query'),
  query: baseQuerySchema.optional(),
  body: z.object({
    messages: z.array(z.any()) as z.ZodType<ChatCompletionMessage[]>,
    tools: z.array(z.any()).optional() as z.ZodType<ChatCompletionTool[] | undefined>,
    tool_choice: z.any().optional() as z.ZodType<ChatCompletionToolChoice | undefined>,
    parallel_tool_calls: z.boolean().optional(),
  }),
});

// Query schema for invoke-remote-tool (tool-name is required)
const invokeRemoteToolQuerySchema = z.object({
  'ai-name': z.string().optional(),
  'tool-name': z.string({ message: 'Missing required query parameter: tool-name' }),
});

// Route: invoke-remote-tool
const invokeRemoteToolSchema = z.object({
  route: z.literal('invoke-remote-tool'),
  query: invokeRemoteToolQuerySchema,
  body: z.object({
    inputs: z.array(z.any()) as z.ZodType<Messages>,
  }),
});

// Route: remote-tools
const remoteToolsSchema = z.object({
  route: z.literal('remote-tools'),
  query: baseQuerySchema.optional(),
  body: z.any().optional(),
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
