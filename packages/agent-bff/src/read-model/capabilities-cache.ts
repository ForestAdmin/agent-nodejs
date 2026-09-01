import { ONE_DAY_MS } from './schema-cache';

/**
 * A Forest column type: a primitive name, a one-element array wrapping another type, a composite
 * `{ fields }`, or a relation marker like `ManyToOne`.
 */
export type FieldType =
  | string
  | FieldType[]
  | { fields: { field: string; type: FieldType; enums?: string[] }[] };

export function normalizeFieldType(type: FieldType): FieldType {
  if (typeof type === 'string' && type.endsWith('List')) return [type.slice(0, -4)];

  return type;
}

export function isEnumFieldType(type: FieldType): boolean {
  const normalized = normalizeFieldType(type);

  return Array.isArray(normalized) ? normalized[0] === 'Enum' : normalized === 'Enum';
}

export type JsonShape = 'any' | 'array' | 'boolean' | 'number' | 'object' | 'string';

// The JSON shape of every Forest primitive, in one place: the OpenAPI document builds its schemas
// from it and the execute validator judges submitted values against it, so a primitive a newer
// agent introduces is unconstrained on both sides rather than on one.
const PRIMITIVE_SHAPES: Record<string, JsonShape> = {
  Binary: 'string',
  Boolean: 'boolean',
  Date: 'string',
  Dateonly: 'string',
  Enum: 'string',
  File: 'string',
  Json: 'any',
  Number: 'number',
  Point: 'string',
  String: 'string',
  Time: 'string',
  Timeonly: 'string',
  Uuid: 'string',
};

export function jsonShapeOf(type: FieldType): JsonShape {
  if (Array.isArray(type)) return 'array';

  if (typeof type === 'object' && type !== null && Array.isArray(type.fields)) return 'object';

  return typeof type === 'string' ? PRIMITIVE_SHAPES[type] ?? 'any' : 'any';
}

export function enumOptionsOf(type: FieldType, options: unknown): string[] | undefined {
  if (!isEnumFieldType(type) || !Array.isArray(options) || options.length === 0) return undefined;

  const names = options.filter((option): option is string => typeof option === 'string');

  return names.length > 0 ? names : undefined;
}

export interface CapabilitiesResult {
  // `type` is the agent's raw `columnType`, so it is not always a plain name: an array-of-primitive
  // column arrives as `['String']`, and a relation entry arrives as the marker `ManyToOne`.
  fields: { name: string; type: FieldType; operators?: string[] }[];
}

export type CapabilitiesFetcher = (collection: string) => Promise<CapabilitiesResult>;

export interface CapabilitiesCacheOptions {
  now?: () => number;
  ttlMs?: number;
}

interface CacheEntry {
  result: CapabilitiesResult;
  fetchedAt: number;
}

/**
 * Per-collection capabilities cache (24h). The fetcher is passed per call so it can be bound to
 * the caller's request token. Invalidated together with the schema via `clear()`.
 */
export default class CapabilitiesCache {
  private readonly now: () => number;
  private readonly ttlMs: number;

  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<CapabilitiesResult>>();
  private generation = 0;

  constructor({ now = Date.now, ttlMs = ONE_DAY_MS }: CapabilitiesCacheOptions = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  async get(collection: string, fetcher: CapabilitiesFetcher): Promise<CapabilitiesResult> {
    const entry = this.entries.get(collection);
    if (entry && this.now() - entry.fetchedAt < this.ttlMs) return entry.result;

    const pending = this.inFlight.get(collection);
    if (pending) return pending;

    const { generation } = this;
    const fetch = fetcher(collection)
      .then(result => {
        // Skip the write if a clear() (schema refresh) happened while this fetch was in flight —
        // its result belongs to the old schema generation and must not repopulate the cache.
        if (this.generation === generation) {
          this.entries.set(collection, { result, fetchedAt: this.now() });
        }

        return result;
      })
      .finally(() => {
        if (this.inFlight.get(collection) === fetch) this.inFlight.delete(collection);
      });

    this.inFlight.set(collection, fetch);

    return fetch;
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.inFlight.clear();
  }
}
