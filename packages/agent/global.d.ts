import 'openid-client';

declare module 'openid-client' {
  interface TypeOfGenericClient {
    register: (metadata: object, other?: RegisterOther & ClientOptions) => Promise<BaseClient>;
  }
}
