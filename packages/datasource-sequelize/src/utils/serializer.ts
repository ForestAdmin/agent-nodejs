import type { RecordData } from '@forestadmin/datasource-toolkit';
import type { ModelAttributeColumnOptions } from 'sequelize';

import { DataTypes } from 'sequelize';

type RawAttributes = Record<string, ModelAttributeColumnOptions>;

export default class Serializer {
  static serialize(record: RecordData, rawAttributes?: RawAttributes): RecordData {
    Object.entries(record).forEach(([name, value]) => {
      if (value instanceof Date) {
        const typeKey = (rawAttributes?.[name]?.type as { key?: string })?.key;
        const iso = this.serializeDate(value);
        // DATEONLY fields should be serialized as YYYY-MM-DD
        record[name] = typeKey === DataTypes.DATEONLY.key && iso ? iso.slice(0, 10) : iso;
      } else if (Array.isArray(value)) {
        this.serializeValue(value); // the change is by references
      } else if (value instanceof Object) {
        return this.serialize(record[name]);
      }
    });

    return record;
  }

  static serializeValue(value: unknown): unknown {
    if (value instanceof Date) return Serializer.serializeDate(value);

    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        // serialize by reference to improve performances by avoiding the copies
        if (v instanceof Date) value[i] = Serializer.serializeDate(v);
      });
    }

    return value;
  }

  static serializeDate(date: Date): string {
    try {
      return date.toISOString();
    } catch (error) {
      return null;
    }
  }
}
