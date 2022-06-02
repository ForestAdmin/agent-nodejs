import { RecordData } from '@forestadmin/datasource-toolkit';

export default class Serializer {
  static serialize(record: RecordData): RecordData {
    Object.entries(record).forEach(([name, value]) => {
      if (value instanceof Date) record[name] = this.serializeValue(value);
    });

    return record;
  }

  static serializeValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();

    return value;
  }
}
