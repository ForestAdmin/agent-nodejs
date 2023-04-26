import { BaseClient, ClientOptions, RegisterOther, TypeOfGenericClient } from 'openid-client';

export interface ClientExt extends TypeOfGenericClient<BaseClient> {
  register: (metadata: object, other?: RegisterOther & ClientOptions) => Promise<BaseClient>;
}
