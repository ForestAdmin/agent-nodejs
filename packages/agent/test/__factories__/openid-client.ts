/* eslint-disable max-classes-per-file */
import { Factory } from 'fishery';

class ClientMock {
  public static register = jest.fn().mockResolvedValue({});
}

class IssuerMock {
  public Client = ClientMock;
}

export default Factory.define<{ Issuer }>(() => ({
  Issuer: IssuerMock,
}));
