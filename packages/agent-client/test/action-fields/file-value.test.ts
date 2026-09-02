import type { PlainField } from '../../src/action-fields/types';
import type HttpRequester from '../../src/http-requester';

import FieldFormStates from '../../src/action-fields/field-form-states';
import { InvalidActionFileValueError } from '../../src/errors';

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
    fieldFormStates = new FieldFormStates({
      actionName: 'attachDocument',
      actionPath: '/forest/actions/attach-document',
      collectionName: 'operations',
      httpRequester,
      ids: ['1'],
    });
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
          'or a string holding a data uri.',
      );
    });

    it('rejects with the typed InvalidActionFileValueError, not a plain Error', async () => {
      await setupFields([{ field: 'document', type: 'File' }]);

      await expect(fieldFormStates.setFieldValue('document', { foo: 1 })).rejects.toBeInstanceOf(
        InvalidActionFileValueError,
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

    it('leaves null untouched', async () => {
      await setupFields([{ field: 'attachments', type: ['File'] }]);

      await fieldFormStates.setFieldValue('attachments', null);

      expect(fieldFormStates.getFieldValues()).toEqual({ attachments: null });
    });

    it('rejects a single file where a list is expected, instead of shipping it unencoded', async () => {
      await setupFields([{ field: 'attachments', type: ['File'] }]);

      await expect(fieldFormStates.setFieldValue('attachments', pdf)).rejects.toThrow(
        'Field "attachments" expects a list of files: pass an array.',
      );
    });

    it('rejects an invalid item inside the list', async () => {
      await setupFields([{ field: 'attachments', type: ['File'] }]);

      await expect(fieldFormStates.setFieldValue('attachments', [{ foo: 1 }])).rejects.toThrow(
        'Field "attachments" expects a file',
      );
    });
  });

  describe('on a field that is not a file', () => {
    it('leaves ordinary values alone', async () => {
      await setupFields([{ field: 'comment', type: 'String' }]);

      await fieldFormStates.setFieldValue('comment', 'plain text');

      expect(fieldFormStates.getFieldValues()).toEqual({ comment: 'plain text' });
    });

    // A resolved upload landing on the wrong field would otherwise be JSON-serialized into the
    // column as {"buffer":{"type":"Buffer",...}} with no error at any layer.
    it('rejects a file, which would otherwise be serialized into the column', async () => {
      await setupFields([{ field: 'comment', type: 'String' }]);

      await expect(fieldFormStates.setFieldValue('comment', pdf)).rejects.toThrow(
        'Field "comment" takes String, not a file: send the file to a File field instead. ' +
          'If this field is meant to take one, the action must declare it as type File or ' +
          'carry the "file picker" widget.',
      );
    });
  });

  describe('on a v1 field declared String with the file picker widget', () => {
    const filePicker = { name: 'file picker', parameters: {} };

    it('encodes a file object as a data uri, as if the field were a File', async () => {
      await setupFields([{ field: 'file_0', type: 'String', widgetEdit: filePicker }]);

      await fieldFormStates.setFieldValue('file_0', pdf);

      expect(fieldFormStates.getFieldValues()).toEqual({ file_0: pdfDataUri });
    });

    it('encodes every item when the field is declared as a list', async () => {
      await setupFields([{ field: 'files', type: ['String'], widgetEdit: filePicker }]);

      await fieldFormStates.setFieldValue('files', [pdf, pdf]);

      expect(fieldFormStates.getFieldValues()).toEqual({ files: [pdfDataUri, pdfDataUri] });
    });

    it('reports the effective type while keeping the wire type intact', async () => {
      await setupFields([
        { field: 'file_0', type: 'String', widgetEdit: filePicker },
        { field: 'files', type: ['String'], widgetEdit: filePicker },
      ]);

      expect(fieldFormStates.getField('file_0')?.getEffectiveTypeName()).toBe('File');
      expect(fieldFormStates.getField('file_0')?.getTypeName()).toBe('String');
      expect(fieldFormStates.getField('file_0')?.getType()).toBe('String');
      expect(fieldFormStates.getField('files')?.getEffectiveTypeName()).toBe('FileList');
      expect(fieldFormStates.getField('files')?.getTypeName()).toBe('StringList');
      expect(fieldFormStates.getField('files')?.getType()).toEqual(['String']);
    });

    it('leaves a plain string untouched, as the front already sends a data uri', async () => {
      await setupFields([{ field: 'file_0', type: 'String', widgetEdit: filePicker }]);

      await fieldFormStates.setFieldValue('file_0', pdfDataUri);

      expect(fieldFormStates.getFieldValues()).toEqual({ file_0: pdfDataUri });
    });

    it('rejects an object that is not a file, instead of storing it as is', async () => {
      await setupFields([{ field: 'file_0', type: 'String', widgetEdit: filePicker }]);

      await expect(fieldFormStates.setFieldValue('file_0', { foo: 1 })).rejects.toThrow(
        'Field "file_0" expects a file: pass { buffer, mimeType, name } ' +
          'or a string holding a data uri.',
      );
    });

    it('rejects a bare value where the list field expects an array', async () => {
      await setupFields([{ field: 'files', type: ['String'], widgetEdit: filePicker }]);

      await expect(fieldFormStates.setFieldValue('files', pdfDataUri)).rejects.toThrow(
        'Field "files" expects a list of files: pass an array.',
      );
    });

    it('leaves a String field carrying another widget rejecting files', async () => {
      await setupFields([
        {
          field: 'comment',
          type: 'String',
          widgetEdit: { name: 'text area editor', parameters: {} },
        },
      ]);

      await expect(fieldFormStates.setFieldValue('comment', pdf)).rejects.toThrow(
        'Field "comment" takes String, not a file',
      );
    });

    it('rejects an array carrying a file on a list field', async () => {
      await setupFields([{ field: 'tags', type: ['String'] }]);

      await expect(fieldFormStates.setFieldValue('tags', ['a', pdf])).rejects.toThrow(
        'Field "tags" is a StringList field and cannot hold a file.',
      );
    });

    it('rejects an array carrying a file on a Json field', async () => {
      await setupFields([{ field: 'payload', type: 'Json' }]);

      await expect(fieldFormStates.setFieldValue('payload', [pdf])).rejects.toThrow(
        'Field "payload" is a Json field and cannot hold a file.',
      );
    });

    it('still accepts an array of plain values on a list field', async () => {
      await setupFields([{ field: 'tags', type: ['String'] }]);

      await fieldFormStates.setFieldValue('tags', ['a', 'b']);

      expect(fieldFormStates.getFieldValues()).toEqual({ tags: ['a', 'b'] });
    });
  });

  describe('type normalization', () => {
    // getType() feeds API responses in agent-bff and workflow-executor, so it has to stay the
    // value the agent sent. Only getTypeName() collapses it, and only for dispatch and display.
    it('keeps getType() on the wire form and offers the collapsed name apart', async () => {
      await setupFields([{ field: 'attachments', type: ['File'] }]);

      expect(fieldFormStates.getField('attachments')?.getType()).toEqual(['File']);
      expect(fieldFormStates.getField('attachments')?.getTypeName()).toBe('FileList');
    });

    it('keeps the wire form in the payload echoed back to the agent', async () => {
      await setupFields([{ field: 'attachments', type: ['File'], hook: 'changeHook' }]);
      httpRequester.query.mockResolvedValue({ fields: [], layout: [] });

      await fieldFormStates.setFieldValue('attachments', [pdf]);

      expect(httpRequester.query).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            data: {
              attributes: expect.objectContaining({
                fields: [expect.objectContaining({ type: ['File'] })],
              }),
              type: 'custom-action-hook-requests',
            },
          },
        }),
      );
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
