import { DataTypes } from 'sequelize';

import Serializer from '../../src/utils/serializer';

describe('Serializer', () => {
  describe('serialize', () => {
    it('should serialize Date fields as ISO string', () => {
      const record = { createdAt: new Date('2025-01-15T10:30:00.000Z') };
      const rawAttributes = { createdAt: { type: DataTypes.DATE } };

      const result = Serializer.serialize(record, rawAttributes);

      expect(result.createdAt).toBe('2025-01-15T10:30:00.000Z');
    });

    it('should serialize Dateonly fields as YYYY-MM-DD', () => {
      const record = { day: new Date('2025-01-15T00:00:00.000Z') };
      const rawAttributes = { day: { type: DataTypes.DATEONLY } };

      const result = Serializer.serialize(record, rawAttributes);

      expect(result.day).toBe('2025-01-15');
    });

    it('should handle mixed Date and Dateonly fields', () => {
      const record = {
        day: new Date('2025-01-15T00:00:00.000Z'),
        createdAt: new Date('2025-01-15T10:30:00.000Z'),
      };
      const rawAttributes = {
        day: { type: DataTypes.DATEONLY },
        createdAt: { type: DataTypes.DATE },
      };

      const result = Serializer.serialize(record, rawAttributes);

      expect(result.day).toBe('2025-01-15');
      expect(result.createdAt).toBe('2025-01-15T10:30:00.000Z');
    });

    it('should default to ISO string when rawAttributes is not provided', () => {
      const record = { day: new Date('2025-01-15T00:00:00.000Z') };

      const result = Serializer.serialize(record);

      expect(result.day).toBe('2025-01-15T00:00:00.000Z');
    });

    it('should return null for invalid dates', () => {
      const record = { createdAt: new Date('invalid') };
      const rawAttributes = { createdAt: { type: DataTypes.DATE } };

      const result = Serializer.serialize(record, rawAttributes);

      expect(result.createdAt).toBeNull();
    });

    it('should return null for Dateonly with invalid date', () => {
      const record = { day: new Date('invalid') };
      const rawAttributes = { day: { type: DataTypes.DATEONLY } };

      const result = Serializer.serialize(record, rawAttributes);

      expect(result.day).toBeNull();
    });
  });
});
