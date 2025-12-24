/* eslint-disable @typescript-eslint/ban-ts-comment */
import type HttpServer from '../../src/services/http-server';
import type { ClientRequest, IncomingMessage } from 'node:http';

import FormData from 'form-data';
import { afterEach } from 'node:test';

import DistPathManager from '../../src/services/dist-path-manager';
import publish from '../../src/services/publish';

const mockToBuffer = jest.fn();

jest.mock('adm-zip', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    toBuffer: mockToBuffer,
  })),
}));
jest.mock('form-data');

const setup = (oldPresignedPost = false) => {
  const presignedPost = oldPresignedPost
    ? {
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
      }
    : {
        url: 'https://forestadmin-platform-cloud-customization-test.s3.eu-west-3.amazonaws.com/',
        fields: {
          bucket: 'forestadmin-platform-cloud-customization-test',
          key: 'cloud_76/code_customization.zip',
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
  const httpServer = {
    postUploadRequest: jest.fn().mockResolvedValue(presignedPost),
    postPublish: jest.fn().mockResolvedValue({ subscriptionId: 'subscriptionId' }),
  } as unknown as HttpServer;

  const distPathManager = new DistPathManager();

  return { httpServer, presignedPost, distPathManager };
};

describe('publish', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('publish', () => {
    it.each([true, false])(
      'should upload the zip to S3 then ask for publication',
      async oldPresignedPost => {
        const { httpServer, presignedPost, distPathManager } = setup(oldPresignedPost);

        jest.mocked(FormData.prototype.append).mockClear();
        mockToBuffer.mockReturnValue({ byteLength: 101 });

        jest.mocked(FormData.prototype.submit).mockImplementation((url, callback) => {
          callback?.(null, { statusCode: 204 } as IncomingMessage);

          return {} as ClientRequest;
        });

        const result = await publish(httpServer, distPathManager);

        expect(result).toStrictEqual('subscriptionId');

        expect(httpServer.postUploadRequest).toHaveBeenCalled();
        expect(httpServer.postUploadRequest).toHaveBeenCalledWith(101);

        expect(FormData).toHaveBeenCalled();
        expect(FormData.prototype.append).toHaveBeenCalledTimes(8);

        // order of properties is important in the form data, at least the file needs to be last
        const orderInForm = [
          'key',
          'bucket',
          'X-Amz-Algorithm',
          'X-Amz-Credential',
          'X-Amz-Date',
          'Policy',
          'X-Amz-Signature',
          'file',
        ];
        orderInForm.forEach((key, index) => {
          expect(jest.mocked(FormData.prototype.append).mock.calls[index][0]).toEqual(key);
        });
        expect(jest.mocked(FormData.prototype.append).mock.calls[0][1]).toEqual(
          'cloud_76/code_customization.zip',
        );

        expect(FormData.prototype.submit).toHaveBeenCalledWith(
          presignedPost.url,
          expect.any(Function),
        );

        expect(httpServer.postPublish).toHaveBeenCalled();
      },
    );
  });

  describe('when an error occurs while reading zip file', () => {
    it('should throw a business error', async () => {
      const { httpServer, distPathManager } = setup();

      mockToBuffer.mockImplementation(() => {
        throw new Error('Cannot read file');
      });

      await expect(publish(httpServer, distPathManager)).rejects.toThrow(
        'Publish failed: Cannot read code-customization zip file ' +
          '- At path: dist/code-customizations.zip',
      );
    });
  });

  describe('when an error occurs while uploading to AWS S3', () => {
    it('should throw a business error', async () => {
      const { httpServer, distPathManager } = setup();

      mockToBuffer.mockReturnValue({ byteLength: 101 });

      jest.mocked(FormData.prototype.submit).mockImplementation((_url, callback) => {
        callback?.(new Error('S3 bucket not found'), {} as IncomingMessage);

        return {} as ClientRequest;
      });

      await expect(publish(httpServer, distPathManager)).rejects.toThrow(
        'Publish failed: S3 bucket not found',
      );
    });
  });
});
