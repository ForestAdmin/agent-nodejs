import { RecordData } from '@forestadmin/datasource-toolkit';

export default class Serializer {
  static serialize(record: RecordData): RecordData {
    Object.entries(record).forEach(([name, value]) => {
      if (value instanceof Date) record[name] = this.serializeValue(value);
      if (Array.isArray(value)) this.serializeValue(value); // the change is by references
      if (value instanceof Object) return this.serialize(record[name]);
    });

    return record;
  }

  static serializeValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();

    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        // serialize by reference to improve performances by avoiding the copies
        if (value instanceof Date) value[i] = v.toISOString();
      });
    }

    return value;
  }
}
