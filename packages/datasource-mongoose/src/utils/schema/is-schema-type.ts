import { SchemaType } from 'mongoose';

export default function isShemaType(obj: unknown): obj is SchemaType {
  if (!obj) return false;

  return (
    obj instanceof SchemaType ||
    Object.getOwnPropertySymbols(obj)?.[0]?.toString() === 'Symbol(mongoose#schemaType)'
  );
}
