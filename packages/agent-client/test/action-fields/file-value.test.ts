import type { PlainField } from '../../src/action-fields/types';
import type HttpRequester from '../../src/http-requester';

import FieldFormStates from '../../src/action-fields/field-form-states';

jest.mock('../../src/http-requester', () => {
  const actual = jest.requireActual('../../src/http-requester');

  return { __esModule: true, default: actual.default };
});

const pdf = { mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), name: 'report.pdf' };
const pdfDataUri = `data:application/pdf;name=report.pdf;base64,${Buffer.from('%PDF-1.4').toString(
  'base64',
)}`;

describe('file values in action forms', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let fieldFormStates: FieldFormStates;

  const setupFields = async (fields: Partial<PlainField>[]) => {
    httpRequester.query.mockResolvedValue({
      fields: fields.map(f => ({ isRequired: false, isReadOnly: false, ...f })),
      layout: [],
    });
    await fieldFormStates.loadInitialState();
    httpRequester.query.mockClear();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = { query: jest.fn() } as unknown as jest.Mocked<HttpRequester>;
    fieldFormStates = new FieldFormStates(
      'attachDocument',
      '/forest/actions/attach-document',
      'operations',
      httpRequester,
      ['1'],
    );
  });

  describe('on a File field', () => {
    it('encodes a file object as the data uri the agent expects', async () => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await fieldFormStates.setFieldValue('document', pdf);

      expect(fieldFormStates.getFieldValues()).toEqual({ document: pdfDataUri });
    });

    it('percent-encodes the name so a filename cannot break the header', async () => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await fieldFormStates.setFieldValue('document', { ...pdf, name: 'rapport final;v2.pdf' });

      expect(fieldFormStates.getFieldValues().document).toBe(
        `data:application/pdf;name=rapport%20final%3Bv2.pdf;base64,${Buffer.from(
          '%PDF-1.4',
        ).toString('base64')}`,
      );
    });

    it('encodes the charset when the file carries one', async () => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await fieldFormStates.setFieldValue('document', {
        mimeType: 'text/csv',
        buffer: Buffer.from('a,b'),
        name: 'data.csv',
        charset: 'utf-8',
      });

      expect(fieldFormStates.getFieldValues().document).toContain(';charset=utf-8;');
    });

    it('leaves an already encoded data uri byte-identical', async () => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await fieldFormStates.setFieldValue('document', pdfDataUri);

      expect(fieldFormStates.getFieldValues()).toEqual({ document: pdfDataUri });
    });

    it('leaves an opaque string reference untouched', async () => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await fieldFormStates.setFieldValue('document', '$uploadedFile:some-token');

      expect(fieldFormStates.getFieldValues()).toEqual({ document: '$uploadedFile:some-token' });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('leaves %s untouched', async (_, value) => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await expect(fieldFormStates.setFieldValue('document', value)).resolves.not.toThrow();
    });

    it.each([
      ['a bare buffer', Buffer.from('%PDF-1.4')],
      ['an object that is not a file', { foo: 1 }],
      ['a file without a mime type', { buffer: Buffer.from('x'), name: 'x.pdf' }],
    ])('rejects %s with an actionable message', async (_, value) => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await expect(fieldFormStates.setFieldValue('document', value)).rejects.toThrow(
        'Field "document" expects a file: pass { buffer, mimeType, name } ' +
          'or a string holding an already encoded data uri.',
      );
    });
  });

  describe('on a file list field', () => {
    it.each([['FileList'], [['File']]])('encodes each item of a %p field', async type => {
      await setupFields([{ field: 'attachments', type: type as PlainField['type'] }]);

      await fieldFormStates.setFieldValue('attachments', [pdf, '$uploadedFile:token']);

      expect(fieldFormStates.getFieldValues()).toEqual({
        attachments: [pdfDataUri, '$uploadedFile:token'],
      });
    });

    it('leaves a non-array value untouched', async () => {
      await setupFields([{ field: 'attachments', type: ['File'] }]);

      await fieldFormStates.setFieldValue('attachments', null);

      expect(fieldFormStates.getFieldValues()).toEqual({ attachments: null });
    });
  });

  describe('on a field that is not a file', () => {
    it('does not encode, because the declared type governs', async () => {
      await setupFields([{ field: 'comment', type: 'String' }]);

      await fieldFormStates.setFieldValue('comment', pdf);

      expect(fieldFormStates.getFieldValues()).toEqual({ comment: pdf });
    });
  });

  describe('when the file field declares a change hook', () => {
    it('sends the encoded value to the agent', async () => {
      await setupFields([{ field: 'document', type: 'File', hook: 'changeHook' }]);
      httpRequester.query.mockResolvedValue({ fields: [], layout: [] });

      await fieldFormStates.setFieldValue('document', pdf);

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/actions/attach-document/hooks/change',
        body: {
          data: {
            attributes: {
              collection_name: 'operations',
              changed_field: 'document',
              ids: ['1'],
              fields: [expect.objectContaining({ field: 'document', value: pdfDataUri })],
            },
            type: 'custom-action-hook-requests',
          },
        },
      });
    });
  });
});
