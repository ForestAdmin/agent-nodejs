import { PrimitiveTypes } from '../../src/interfaces/schema';
import { ValidationPrimaryTypes, ValidationTypesArray } from '../../src/validation/types';
import TypeGetter from '../../src/validation/type-getter';

describe('TypeGetter', () => {
  describe('get', () => {
    it('should throw an error when the given typeContext is not a Primitive type', () => {
      expect(() => TypeGetter.get(1, 'SomethingNotPrimitive' as unknown as PrimitiveTypes)).toThrow(
        'Unexpected value of type: SomethingNotPrimitive',
      );
    });

    describe('when the value is an Array', () => {
      describe('when all the values are numbers', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get([1, 2, 3])).toEqual(ValidationTypesArray.Number);
        });

        it('should return the expected type when there are negative numbers', () => {
          expect(TypeGetter.get([-1, 2, 3])).toEqual(ValidationTypesArray.Number);
        });
      });

      describe('when all the values are boolean', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get([true, false])).toEqual(ValidationTypesArray.Boolean);
        });
      });

      describe('when all the values are Uuid', () => {
        it('should return the expected type', () => {
          expect(
            TypeGetter.get([
              '2d162303-78bf-599e-b197-93590ac3d315',
              '2d162303-78bf-599e-b197-93590ac3d315',
            ]),
          ).toEqual(ValidationTypesArray.Uuid);
        });
      });

      describe('when all the values are string', () => {
        describe('when the given context is an Enum', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get(['an enum value'], PrimitiveTypes.Enum)).toEqual(
              ValidationTypesArray.Enum,
            );
          });
        });

        it('should return the expected type', () => {
          expect(TypeGetter.get(['str', 'str2', 'str'])).toEqual(ValidationTypesArray.String);
        });
      });

      describe('when there are 2 values and the given context is a Point', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('-2,3', PrimitiveTypes.Point)).toEqual(PrimitiveTypes.Point);
        });
      });

      describe('when the values are strings and numbers', () => {
        it('should return null', () => {
          expect(TypeGetter.get(['str', 1, 'str'])).toEqual(ValidationPrimaryTypes.Null);
        });
      });

      describe('when there is no value', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get([])).toEqual(ValidationTypesArray.Empty);
        });
      });
    });

    describe('when the value is a number', () => {
      it('should the expected type', () => {
        expect(TypeGetter.get(1526)).toEqual(PrimitiveTypes.Number);
      });
    });

    describe('when the value is a json', () => {
      it('should return the expected type', () => {
        expect(TypeGetter.get(JSON.stringify({ message: 'hello' }))).toEqual(PrimitiveTypes.Json);
      });
    });

    describe('when the value is an object', () => {
      it('should return null', () => {
        expect(TypeGetter.get({ message: 'hello' })).toEqual(ValidationPrimaryTypes.Null);
      });
    });

    describe('when the value is a date', () => {
      describe('when it is a js date', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get(new Date(), PrimitiveTypes.Date)).toEqual(PrimitiveTypes.Date);
        });
      });

      describe('when it is a date without time', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2016-05-25')).toEqual(PrimitiveTypes.Dateonly);
        });
      });

      describe('when it is a date with time', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2016-05-25T09:24:15.123')).toEqual(PrimitiveTypes.Date);
        });
      });

      describe('when there is only the time', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('09:24:15.123')).toEqual(PrimitiveTypes.Timeonly);
        });
      });
    });

    describe('when the value is a string', () => {
      describe('when the value is a json and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(
            TypeGetter.get(JSON.stringify({ message: 'hello' }), PrimitiveTypes.String),
          ).toEqual(PrimitiveTypes.String);
        });
      });

      describe('when the given context is an Enum', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('an enum value', PrimitiveTypes.Enum)).toEqual(PrimitiveTypes.Enum);
        });
      });

      describe('when it is a date and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2016-05-25', PrimitiveTypes.String)).toEqual(
            PrimitiveTypes.String,
          );
        });
      });

      describe('when it is an uuid', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2d162303-78bf-599e-b197-93590ac3d315')).toEqual(
            PrimitiveTypes.Uuid,
          );
        });
      });

      describe('when the value is an uuid and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(
            TypeGetter.get('2d162303-78bf-599e-b197-93590ac3d315', PrimitiveTypes.String),
          ).toEqual(PrimitiveTypes.String);
        });
      });

      describe('when it is a number as string', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2258', PrimitiveTypes.Number)).toEqual(PrimitiveTypes.Number);
        });
      });

      describe('when the value is a number and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('12', PrimitiveTypes.String)).toEqual(PrimitiveTypes.String);
        });
      });

      describe('when it is not an uuid or a number', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('a string')).toEqual(PrimitiveTypes.String);
        });
      });
    });
  });
});
