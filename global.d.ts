/// <reference types="jest-extended" />

declare module 'eventsource';
// Typed rather than left as `any`: `agent-bff` publishes the response record keys these calls
// produce, so a wrong signature there would go unnoticed. Exported as one object because the
// methods read `this.inflections` — destructuring them breaks at runtime, not at compile time.
declare module 'inflected' {
  const Inflector: {
    underscore(value: string): string;
    camelize(value: string, uppercaseFirstLetter?: boolean): string;
  };

  export = Inflector;
}
declare module 'fastify2';
declare module 'fastify4';
