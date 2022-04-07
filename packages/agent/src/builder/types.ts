import { ComputedDefinition } from '@forestadmin/datasource-toolkit';

export type FieldDefinition = ComputedDefinition & { beforeRelations?: boolean };
