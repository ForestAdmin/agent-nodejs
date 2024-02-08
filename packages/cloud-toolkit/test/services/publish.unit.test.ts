import type { ClientRequest } from 'http';

import FormData from 'form-data';
import { afterEach } from 'node:test';

import HttpForestServer from '../../src/services/http-forest-server';
import publish from '../../src/services/publish';

const mockToBuffer = jest.fn();

jest.mock('adm-zip', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    toBuffer: mockToBuffer,
  })),
}));
jest.mock('form-data');

const setup = () => {
  const presignedPost = {
    url: 'https://s3.eu-west-3.amazonaws.com/forestadmin-platform-cloud-customization-test',
    fields: {
      bucket: 'forestadmin-platform-cloud-customization-test',
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': 'AKI?../request',
      'X-Amz-Date': '20240116T091247Z',
      Policy: `eyJleHBpcmF0aW9uIjoiMjAyNC0wMS0yM1QxMTowNzowNVoiLCJjb25kaXRpb25zIjpbeyJidWNrZXQiOiJ
        mb3Jlc3RhZG1pbi1wbGF0Zm9ybS1jbG91ZC1jdXN0b21pemF0aW9uLXRlc3QtdzEifSxbInN0YXJ0cy13aXRoIiwiJ
        GtleSIsImNsb3VkXzc2L2NvZGVfY3VzdG9taXphdGlvbi56aXAiXSxbImNvbnRlbnQtbGVuZ3RoLXJhbmdlIiwwLDE
        wNDg1NzYwXSx7ImJ1Y2tldCI6ImZvcmVzdGFkbWluLXBsYXRmb3JtLWNsb3VkLWN1c3RvbWl6YXRpb24tdGVzdC13M
        SJ9LHsiWC1BbXotQWxnb3JpdGhtIjoiQVdTNC1ITUFDLVNIQTI1NiJ9LHsiWC1BbXotQ3JlZGVudGlhbCI6IkFLSUF
        VUkVWSUNSQ0FBSkJDUDVFLzIwMjQwMTIzL2V1LXdlc3QtMS9zMy9hd3M0X3JlcXVlc3QifSx7IlgtQW16LURhdGUiO
        iIyMDI0MDEyM1QxMTAyMDVaIn1dfQ==`,
      'X-Amz-Signature': 'c5...84',
    },
  };
  const httpForestServer = {
    postUploadRequest: jest.fn().mockResolvedValue(presignedPost),
    postPublish: jest.fn().mockResolvedValue({ subscriptionId: 'subscriptionId' }),
  } as unknown as HttpForestServer;

  return { httpForestServer, presignedPost };
};

describe('publish', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should upload the zip to S3 then ask for publication', async () => {
    const { httpForestServer, presignedPost } = setup();

    mockToBuffer.mockReturnValue({ byteLength: 101 });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.mocked(FormData.prototype.submit).mockImplementation((url, callback) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      callback();

      return null;
    });

    const result = await publish(httpForestServer);

    expect(result).toStrictEqual('subscriptionId');

    expect(httpForestServer.postUploadRequest).toHaveBeenCalledOnce();
    expect(httpForestServer.postUploadRequest).toHaveBeenCalledWith(101);

    expect(FormData).toHaveBeenCalled();
    expect(FormData.prototype.append).toHaveBeenCalledTimes(8);

    // order of properties is important in the form data, at least the file needs to be last
    const orderInForm = ['key', ...Object.keys(presignedPost.fields), 'file'];
    orderInForm.forEach((key, index) => {
      expect(jest.mocked(FormData.prototype.append).mock.calls[index][0]).toEqual(key);
    });

    expect(FormData.prototype.submit).toHaveBeenCalledWith(presignedPost.url, expect.any(Function));

    expect(httpForestServer.postPublish).toHaveBeenCalledOnce();
  });

  describe('when an error occurs while reading zip file', () => {
    it('should throw a business error', async () => {
      const { httpForestServer } = setup();

      mockToBuffer.mockImplementation(() => {
        throw new Error('Cannot read file');
      });

      await expect(publish(httpForestServer)).rejects.toThrow(
        'Publish failed: Cannot read code-customization zip file ' +
          '- At path: dist/code-customizations.zip',
      );
    });
  });
});
