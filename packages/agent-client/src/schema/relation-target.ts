import type { ForestSchemaField } from '@forestadmin/forestadmin-client';

export type RelationTarget =
  | { polymorphic: false; target: string }
  | { polymorphic: true; targets: string[] };

export default function relationTargetOf(
  field: Pick<ForestSchemaField, 'reference' | 'polymorphicReferencedModels'>,
): RelationTarget | null {
  if (field.polymorphicReferencedModels && field.polymorphicReferencedModels.length > 0) {
    return { polymorphic: true, targets: [...field.polymorphicReferencedModels] };
  }

  if (field.reference) {
    // reference is `${foreignCollection}.${key}`; the collection name may itself contain dots
    // (e.g. mongoose nested collections like `User.address`), so drop only the trailing key.
    return { polymorphic: false, target: field.reference.split('.').slice(0, -1).join('.') };
  }

  return null;
}
