import readline, { Interface } from 'readline';

jest.mock('readline');
const mockedReadline = readline as jest.Mocked<typeof readline> & jest.Mock;

const readlineMock = {
  question: jest
    .fn()
    .mockImplementation((question: string, callback: (answer: string) => Promise<void>) => {
      callback('yes');
    }),
  close: jest.fn(),
};

mockedReadline.createInterface.mockImplementation(() => readlineMock as unknown as Interface);

export default readlineMock;
