/// <reference types="jest-extended" />

declare module 'forest-ip-utils';

declare module 'mongoose' {
  interface SchemaType {
    get path(): string;
    get isRequired(): boolean;
  }
}
