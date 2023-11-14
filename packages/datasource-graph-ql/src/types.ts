import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export type GraphQLOptions = {
  serverApiUrl: string;
  scalarMapping?: Record<string, PrimitiveTypes>;
  scalarIdentifier?: string;
};
