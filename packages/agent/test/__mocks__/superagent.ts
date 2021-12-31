let responseBody;
let responseError;

const mockResponse = {
  get: jest.fn(),
  ok: true,
  status: 200,
  toError: jest.fn(),
  body: undefined,
};

export default {
  setMockResponseBody: mockBody => {
    responseBody = mockBody;
  },
  setMockError: (error: string, status: number) => {
    responseError = { error, status };
  },
  mockClear: () => {
    responseBody = undefined;
    responseError = undefined;
  },
  get: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  then: jest.fn(
    callback =>
      new Promise((resolve, reject) => {
        if (mockResponse) mockResponse.body = responseBody;

        if (responseError) {
          reject(callback(null, responseError));
        } else {
          resolve(callback(mockResponse));
        }
      }),
  ),
};
