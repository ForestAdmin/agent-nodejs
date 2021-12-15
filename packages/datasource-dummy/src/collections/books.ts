import {
  Action,
  ActionForm,
  ActionResponse,
  ActionResponseType,
  AggregateResult,
  Aggregation,
  Collection,
  CollectionSchema,
  CompositeId,
  DataSource,
  FieldTypes,
  Filter,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
  RecordData,
} from "@forestadmin/datasource-toolkit";

export class BookCollection implements Collection {
  readonly dataSource: DataSource;
  readonly name: string = "book";
  readonly schema: CollectionSchema = {
    actions: [
      {
        name: "Mark as Live",
        scope: "bulk",
      },
    ],
    fields: {
      id: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.Number,
        filterOperators: new Set([]),
        isPrimaryKey: true,
      },
      title: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.String,
        filterOperators: new Set([]),
        defaultValue: "Le rouge et le noir",
      },
      authorId: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.Number,
        filterOperators: new Set([]),
        defaultValue: 34,
      },
    },
    searchable: true,
    segments: ["Active", "Inactive"],
  };

  constructor(datasource: DataSource) {
    this.dataSource = datasource;
  }

  getAction(name: string): Action {
    if (name === "Mark as Live") return new MarkAsLiveAction();
    else throw new Error("Action not found.");
  }

  async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    void id;
    return this.makeRecord(projection);
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    return data;
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    void filter;

    const numRecords = filter?.page?.limit ?? 10;
    const records = [];
    for (let i = 0; i < numRecords; ++i) {
      records.push(this.makeRecord(projection));
    }
    return records;
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    void filter;
    void patch;
  }

  async delete(filter: Filter): Promise<void> {
    void filter;
  }

  async aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    void filter;

    const rows = [];
    for (let i = 0; i < 10; ++i) {
      const row = { value: Math.floor(Math.random() * 1000), group: {} };
      for (const { field } of aggregation.groups) {
        row.group[field] = this.makeRandomString(6);
      }
      rows.push(row);
    }

    return rows;
  }

  private makeRecord(projection: Projection): RecordData {
    const record: RecordData = {};
    for (const field of projection) {
      const schema = this.schema.fields[field];
      if (schema.type === FieldTypes.Column) {
        if (schema.columnType === PrimitiveTypes.Number) {
          record[field] = Math.floor(Math.random() * 10000);
        } else if (schema.columnType === PrimitiveTypes.String) {
          record[field] = this.makeRandomString(10);
        } else {
          throw new Error(`Unsupported primitive: ${schema.columnType}`);
        }
      } else {
        throw new Error(`Unsupported field type: ${schema.type}`);
      }
    }

    return record;
  }

  /** @see https://stackoverflow.com/questions/1349404 */
  private makeRandomString(length = 10) {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}

class MarkAsLiveAction implements Action {
  async execute(formValues: RecordData, selection?: Selection): Promise<ActionResponse> {
    void formValues;
    void selection;

    return {
      type: ActionResponseType.Success,
      message: "Yolo, all of your record are belongs to us",
      invalidatedDependencies: [],
      options: {
        type: "text",
      },
    };
  }

  async getForm(
    selection?: Selection,
    changedField?: string,
    formValues?: RecordData
  ): Promise<ActionForm> {
    void selection;
    void changedField;
    void formValues;

    return { fields: [] };
  }
}
