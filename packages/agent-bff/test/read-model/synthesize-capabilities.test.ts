import type { Logger } from '../../src/ports/logger-port';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import synthesizeCapabilities, {
  LEGACY_LIANA_OPERATORS,
} from '../../src/read-model/synthesize-capabilities';
import { normalizeOperator } from '../../src/validation/operator-normalizer';

// Copied from the apimap a real forest-express-sequelize 9.3.8 agent pushed, trimmed to the shapes
// that matter: a plain scalar, a computed field the liana marks unusable, a date, a to-one relation
// and a to-many one.
function v1Apimap(): ForestSchemaCollection {
  return {
    name: 'User',
    fields: [
      { field: 'id', type: 'Number', isPrimaryKey: true, isFilterable: true, isSortable: true },
      { field: 'name', type: 'String', isFilterable: true, isSortable: true },
      { field: 'birthDate', type: 'Dateonly', isFilterable: true, isSortable: true },
      { field: 'fullName', type: 'String', isFilterable: false, isSortable: false },
      { field: 'team', type: 'Number', relationship: 'BelongsTo', reference: 'teams.id' },
      { field: 'articles', type: ['Number'], relationship: 'HasMany', reference: 'Article.userId' },
    ],
  } as unknown as ForestSchemaCollection;
}

describe('synthesizeCapabilities', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = jest.fn();
  });

  function fieldNamed(name: string) {
    return synthesizeCapabilities(v1Apimap(), logger).fields.find(field => field.name === name);
  }

  describe('the operator set', () => {
    it('should only contain operators that map back to a canonical one, since an unmapped one throws at request time', () => {
      const unmapped = [...LEGACY_LIANA_OPERATORS].filter(operator => !normalizeOperator(operator));

      expect(unmapped).toEqual([]);
    });

    it('should exclude the operators a legacy liana rejects', () => {
      const unsupported = [
        'missing',
        'not_in',
        'longer_than',
        'shorter_than',
        'like',
        'i_contains',
        'i_starts_with',
        'includes_none',
      ];

      expect(unsupported.filter(operator => LEGACY_LIANA_OPERATORS.has(operator))).toEqual([]);
    });

    it('should exclude includes_all, which one liana rejects and the other answers with a 500', () => {
      expect(LEGACY_LIANA_OPERATORS.has('includes_all')).toBe(false);
    });
  });

  describe('when the field is a scalar', () => {
    it('should publish operators in snake_case, as a real capabilities response does', () => {
      expect(fieldNamed('name')?.operators).toContain('starts_with');
      expect(fieldNamed('name')?.operators).not.toContain('StartsWith');
    });

    it('should intersect the column type table with what the liana supports', () => {
      const operators = fieldNamed('name')?.operators ?? [];

      expect(operators).toContain('contains');
      expect(operators).not.toContain('like');
      expect(operators).not.toContain('longer_than');
    });

    it('should give a date field its date operators, which a separate liana parser handles', () => {
      const operators = fieldNamed('birthDate')?.operators ?? [];

      expect(operators).toContain('today');
      expect(operators).toContain('previous_week');
      expect(operators).not.toContain('missing');
    });

    it('should leave sortable absent when the apimap does not deny it', () => {
      expect(fieldNamed('name')).not.toHaveProperty('sortable');
    });
  });

  describe('when the apimap denies a capability', () => {
    it('should publish no operator, so a filter on it is field_not_filterable and not a 500', () => {
      expect(fieldNamed('fullName')?.operators).toEqual([]);
    });

    it('should state sortable false, which a real capabilities response never carries', () => {
      expect(fieldNamed('fullName')?.sortable).toBe(false);
    });
  });

  describe('when the field is a relation', () => {
    it('should publish a to-one relation as ManyToOne with no operators, matching v2', () => {
      expect(fieldNamed('team')).toEqual({ name: 'team', type: 'ManyToOne' });
    });

    it('should omit a to-many relation entirely, so a filter on it is unknown_field as in v2', () => {
      expect(fieldNamed('articles')).toBeUndefined();
    });
  });

  describe('when a column type has no operator table', () => {
    it('should read as not filterable and log it, rather than forward a filter that would fail in SQL', () => {
      const collection = {
        name: 'Odd',
        fields: [{ field: 'weird', type: 'SomethingElse', isFilterable: true }],
      } as unknown as ForestSchemaCollection;

      const result = synthesizeCapabilities(collection, logger);

      expect(result.fields[0].operators).toEqual([]);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.any(String),
        expect.objectContaining({ collection: 'Odd', field: 'weird' }),
      );
    });
  });
});
