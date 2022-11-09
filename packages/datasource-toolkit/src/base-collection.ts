import Collection from './collection';
import CollectionSchema from './collection-schema';
import DataSource from './datasource';
import { ActionField, ActionResult } from './interfaces/action';
import { Caller } from './interfaces/caller';
import { Chart } from './interfaces/chart';
import { ActionSchema, FieldSchema } from './interfaces/schema';

export default abstract class BaseCollection extends Collection {
  readonly dataSource: DataSource;
  readonly name: string;
  readonly schema: CollectionSchema = new CollectionSchema();

  constructor(name: string, datasource: DataSource) {
    super();
    this.dataSource = datasource;
    this.name = name;
  }

  protected addAction(name: string, schema: ActionSchema): void {
    const action = this.schema.actions[name];

    if (action !== undefined) throw new Error(`Action "${name}" already defined in collection`);

    this.schema.actions[name] = schema;
  }

  protected addChart(name: string): void {
    if (this.schema.charts.includes(name)) {
      throw new Error(`Chart "${name}" already defined in collection`);
    }

    this.schema.charts.push(name);
  }

  protected addField(name: string, schema: FieldSchema): void {
    const fieldSchema = this.schema.fields[name];

    if (fieldSchema !== undefined) throw new Error(`Field "${name}" already defined in collection`);

    this.schema.fields[name] = schema;
  }

  protected addFields(fields: { [fieldName: string]: FieldSchema }): void {
    Object.entries(fields).forEach(([fieldName, fieldSchema]) =>
      this.addField(fieldName, fieldSchema),
    );
  }

  protected addSegments(segments: string[]) {
    this.schema.segments.push(...segments);
  }

  protected enableCount(): void {
    this.schema.countable = true;
  }

  protected enableSearch(): void {
    this.schema.searchable = true;
  }

  async execute(caller: Caller, name: string): Promise<ActionResult> {
    throw new Error(`Action ${name} is not implemented.`);
  }

  async getForm(): Promise<ActionField[]> {
    return [];
  }

  async renderChart(caller: Caller, name: string): Promise<Chart> {
    throw new Error(`Chart ${name} is not implemented.`);
  }
}
