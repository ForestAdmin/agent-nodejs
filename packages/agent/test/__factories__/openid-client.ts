/* eslint-disable max-classes-per-file */
import { Factory } from 'fishery';
import { Issuer } from 'openid-client';

class ClientMock {
  public static register = jest.fn().mockImplementation(() => {
    console.log('vraiment huss');

    return 'huss';
  });
}

export class IssuerFactory extends Factory<Issuer> {
  mockAllMethods() {
    return this.afterBuild(issuer => {
      issuer.Client = {
        register: jest.fn().mockReturnValue({}),
      } as any;
    });
  }
}

export default {
  Issuer: IssuerFactory.define(() => ({ Client: ClientMock } as any)),
};
