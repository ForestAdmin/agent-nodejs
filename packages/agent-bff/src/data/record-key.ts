import Inflector from 'inflected';

export default function recordKey(field: string): string {
  return Inflector.camelize(Inflector.underscore(field), false);
}
