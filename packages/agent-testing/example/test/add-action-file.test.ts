import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { createTestableAgent, TestableAgent } from '../../src';
import { STORAGE_PREFIX, logger } from '../utils';

describe('addAction with File fields', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  let documentId: number;
  const storage = `${STORAGE_PREFIX}-action-file.db`;

  const actionFormCustomizer = (agent: Agent) => {
    agent.customizeCollection('documents', collection => {
      collection.addAction('Upload files', {
        scope: 'Single',
        form: [
          { label: 'Main file', type: 'File' },
          { label: 'Attachments', type: 'FileList' },
        ],
        execute: async context => {
          const mainFile = context.formValues['Main file'];
          const attachments = context.formValues.Attachments;

          const { id } = await context.getRecord(['id']);
          await context.dataSource.getCollection('documents').update(
            { conditionTree: { field: 'id', operator: 'Equal', value: id } },
            {
              fileName: mainFile?.name,
              fileMimeType: mainFile?.mimeType,
              attachmentCount: attachments?.length ?? 0,
            },
          );
        },
      });
    });
  };

  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define(
      'documents',
      {
        title: { type: DataTypes.STRING },
        fileName: { type: DataTypes.STRING },
        fileMimeType: { type: DataTypes.STRING },
        attachmentCount: { type: DataTypes.INTEGER },
      },
      { tableName: 'documents' },
    );
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
      actionFormCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  beforeEach(async () => {
    const created = await sequelize.models.documents.create({
      title: 'My document',
      fileName: null,
      fileMimeType: null,
      attachmentCount: 0,
    });
    documentId = created.dataValues.id;
  });

  it('should fill a File field and execute the action', async () => {
    const action = await testableAgent
      .collection('documents')
      .action('Upload files', { recordId: documentId });

    const fileField = action.getFileField('Main file');
    await fileField.fill({
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf-content'),
      name: 'report.pdf',
    });

    expect(fileField.getValue()).toBe(
      `data:application/pdf;name=report.pdf;base64,${Buffer.from('pdf-content').toString('base64')}`,
    );

    await action.execute();

    const [doc] = await testableAgent
      .collection('documents')
      .list<{ fileName: string; fileMimeType: string }>({
        filters: { field: 'id', value: documentId, operator: 'Equal' },
      });

    expect(doc.fileName).toBe('report.pdf');
    expect(doc.fileMimeType).toBe('application/pdf');
  });

  it('should add and remove files from a FileList field', async () => {
    const action = await testableAgent
      .collection('documents')
      .action('Upload files', { recordId: documentId });

    const fileListField = action.getFileListField('Attachments');
    await fileListField.addFile({
      mimeType: 'image/png',
      buffer: Buffer.from('img1'),
      name: 'photo.png',
    });
    await fileListField.addFile({
      mimeType: 'image/jpeg',
      buffer: Buffer.from('img2'),
      name: 'avatar.jpg',
    });

    const values = fileListField.getValue() as string[];
    expect(values).toHaveLength(2);

    await fileListField.removeFile('photo.png');

    const updatedValues = fileListField.getValue() as string[];
    expect(updatedValues).toHaveLength(1);
    expect(updatedValues[0]).toContain('name=avatar.jpg');

    await action.execute();

    const [doc] = await testableAgent
      .collection('documents')
      .list<{ attachmentCount: number }>({
        filters: { field: 'id', value: documentId, operator: 'Equal' },
      });

    expect(doc.attachmentCount).toBe(1);
  });

  it('should clear a File field by filling with null', async () => {
    const action = await testableAgent
      .collection('documents')
      .action('Upload files', { recordId: documentId });

    const fileField = action.getFileField('Main file');
    await fileField.fill({
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
      name: 'test.txt',
    });
    expect(fileField.getValue()).toBeTruthy();

    await fileField.fill(null);
    expect(fileField.getValue()).toBeNull();
  });

  it('should route File/FileList types correctly via getField', async () => {
    const action = await testableAgent
      .collection('documents')
      .action('Upload files', { recordId: documentId });

    const mainFileField = action.getField('Main file');
    const attachmentsField = action.getField('Attachments');

    expect(mainFileField.getType()).toBe('File');
    expect(attachmentsField.getType()).toEqual(['File']);
  });
});
