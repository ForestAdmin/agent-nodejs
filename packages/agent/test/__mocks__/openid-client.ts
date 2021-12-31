export const openidClientRegisterMock = jest.fn();
class Client {
  public static register = openidClientRegisterMock;
}

const Issuer = jest.fn().mockImplementation(() => ({
  Client,
}));

export { Issuer, Client };
