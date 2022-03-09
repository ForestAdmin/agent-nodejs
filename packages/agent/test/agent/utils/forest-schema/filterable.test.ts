import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import FilterableUtils from '../../../../src/agent/utils/forest-schema/filterable';

describe('FrontendFilterableUtils', () => {
  describe('Normal types need to have defined minimum operators', () => {
    test('With undefined operators', () => {
      const isFilterable = FilterableUtils.isFilterable(PrimitiveTypes.String);
      expect(isFilterable).toBeFalsy();
    });

    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable(PrimitiveTypes.String, new Set());
      expect(isFilterable).toBeFalsy();
    });

    test('With only the relevant operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        PrimitiveTypes.String,
        new Set([
          Operator.Equal,
          Operator.NotEqual,
          Operator.Present,
          Operator.Blank,
          Operator.In,
          Operator.StartsWith,
          Operator.EndsWith,
          Operator.Contains,
          Operator.NotContains,
        ]),
      );

      expect(isFilterable).toBeTruthy();
    });

    test('With all operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        PrimitiveTypes.String,
        new Set(Object.values(Operator)),
      );

      expect(isFilterable).toBeTruthy();
    });
  });

  describe('Arrays need the IncludesAll operator', () => {
    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable([PrimitiveTypes.String], new Set());
      expect(isFilterable).toBeFalsy();
    });

    test('With Operator.IncludeAll', () => {
      const isFilterable = FilterableUtils.isFilterable(
        [PrimitiveTypes.String],
        new Set([Operator.IncludesAll]),
      );

      expect(isFilterable).toBeTruthy();
    });
  });

  describe('Point is never filterable', () => {
    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable(PrimitiveTypes.Point, new Set());
      expect(isFilterable).toBeFalsy();
    });

    test('With all operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        PrimitiveTypes.Point,
        new Set(Object.values(Operator)),
      );

      expect(isFilterable).toBeFalsy();
    });
  });

  describe('Nested types are never filterable', () => {
    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        { firstName: PrimitiveTypes.String, lastName: PrimitiveTypes.String },
        new Set(),
      );

      expect(isFilterable).toBeFalsy();
    });

    test('With all operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        { firstName: PrimitiveTypes.String, lastName: PrimitiveTypes.String },
        new Set(Object.values(Operator)),
      );

      expect(isFilterable).toBeFalsy();
    });
  });
});
