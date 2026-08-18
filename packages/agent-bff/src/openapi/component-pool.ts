import type { z } from './zod-openapi';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas31';

const SCHEMA_PREFIX = '#/components/schemas/';

/**
 * Registers schema components on demand. Nothing is registered eagerly: a component no path
 * references trips redocly's unused-component rule, and which shared pieces an unfolded document
 * needs depends on the schema it was built from.
 */
export default class ComponentPool {
  private readonly registry: OpenAPIRegistry;
  private readonly shared = new Set<string>();

  constructor(registry: OpenAPIRegistry) {
    this.registry = registry;
  }

  /** A hand-written OpenAPI component. The caller owns name uniqueness. */
  add(name: string, component: SchemaObject): ReferenceObject {
    return this.registry.registerComponent('schemas', name, component).ref;
  }

  /** A zod schema shared by several paths, registered the first time it is referenced. */
  reuse(name: string, schema: z.ZodType): ReferenceObject {
    if (!this.shared.has(name)) {
      this.registry.register(name, schema);
      this.shared.add(name);
    }

    return { $ref: `${SCHEMA_PREFIX}${name}` };
  }
}
