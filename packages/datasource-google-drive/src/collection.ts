import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  DataSource,
  FieldSchema,
  Filter,
  Operator,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { drive, drive_v3 } from '@googleapis/drive';

import { Options } from './datasource';
import queryStringFromConditionTree from './utils/query-converter';

export default class GoogleDriveCollection extends BaseCollection {
  private static supportedOperators = new Set<Operator>([
    'Blank',
    'Contains',
    'LessThan',
    'Equal',
    'GreaterThan',
    'In',
    'IncludesAll',
    // 'ShorterThan',
    // 'LongerThan',
    'Present',
    'NotContains',
    'NotEqual',
    'NotIn',
  ]);

  private static schema: Record<string, FieldSchema> = {
    id: {
      type: 'Column',
      columnType: 'String',
      isPrimaryKey: true,
    },
    name: {
      type: 'Column',
      columnType: 'String',
    },
    description: {
      type: 'Column',
      columnType: 'String',
    },
    createdTime: {
      type: 'Column',
      columnType: 'String',
    },
    modifiedTime: {
      type: 'Column',
      columnType: 'String',
    },
    version: {
      type: 'Column',
      columnType: 'String',
    },
    thumbnailLink: {
      type: 'Column',
      columnType: 'String',
    },
  };

  protected service: drive_v3.Drive;
  protected records: RecordData[] = [];

  constructor(datasource: DataSource, name: string, options: Options) {
    super(name, datasource);

    this.service = drive({ version: 'v3', auth: options.auth });

    // https://developers.google.com/drive/api/reference/rest/v3/files
    this.addFields(GoogleDriveCollection.schema);

    // developers.google.com/drive/api/reference/rest/v3/files/create
    this.addAction('Creates a copy of the file', { scope: 'Single', staticForm: true });

    // filters/sort is supported
    for (const schema of Object.values(this.schema.fields)) {
      if (schema.type === 'Column') {
        schema.filterOperators = GoogleDriveCollection.supportedOperators;
        schema.isSortable = true;
      }
    }
  }

  async create(): Promise<RecordData[]> {
    throw Error('Datasource missing create capability');
    // const records = [];

    // for (const datum of data) {
    //   await this.service.files.create();
    // }

    // return records;
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    // https://developers.google.com/drive/api/guides/search-files#examples
    const queryString = queryStringFromConditionTree(filter.conditionTree);

    const res = await this.service.files.list({
      q: queryString,
      // fields: 'nextPageToken, files(id, name)',
      spaces: 'drive', // appDataFolder? what is this
      orderBy: filter.sort.map(s => (s.ascending ? s.field : `${s.field} desc`)).join(','),
      pageSize: filter.page.limit,
      // pageToken: 'placeholder-value', // TODO work on this
      // Search won't work really poor circumvent will be to use a map to keep nextPageToken state
    });

    return projection.apply(res.data.files);
  }

  async update(): Promise<void> {
    throw Error('Datasource missing update capability');
    // See https://developers.google.com/drive/api/guides/manage-uploads
  }

  async delete(): Promise<void> {
    throw Error('You cannot delete drive files from a Forest Admin datasource');
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    return aggregation.apply(
      await this.list(caller, filter, aggregation.projection),
      caller.timezone,
      limit,
    );
  }
}
