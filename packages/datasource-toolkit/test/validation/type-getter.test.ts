import TypeGetter from '../../dist/validation/type-getter';
import { PrimitiveTypes } from '../../dist/interfaces/schema';
import ValidationTypes from '../../dist/validation/types';

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
          expect(TypeGetter.get([1, 2, 3])).toEqual(ValidationTypes.ArrayOfNumber);
        });

        it('should return the expected type when there are negative numbers', () => {
          expect(TypeGetter.get([-1, 2, 3])).toEqual(ValidationTypes.ArrayOfNumber);
        });

        describe('when values are number and string number', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get(['1', 2, 3])).toEqual(ValidationTypes.ArrayOfNumber);
          });
        });
      });

      describe('when all the values are boolean', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get([true, false])).toEqual(ValidationTypes.ArrayOfBoolean);
        });
      });

      describe('when all the values are string', () => {
        describe('when the given context is an Enum', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get(['an enum value'], PrimitiveTypes.Enum)).toEqual(
              ValidationTypes.ArrayOfEnum,
            );
          });
        });

        it('should return the expected type', () => {
          expect(TypeGetter.get(['str', 'str2', 'str'])).toEqual(ValidationTypes.ArrayOfString);
        });
      });

      describe('when there are 2 values and the given context is a Point', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('-2,3', PrimitiveTypes.Point)).toEqual(PrimitiveTypes.Point);
        });
      });

      describe('when the values are strings and numbers', () => {
        it('should return null', () => {
          expect(TypeGetter.get(['str', 1, 'str'])).toEqual(null);
        });
      });

      describe('when there is no value', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get([])).toEqual(ValidationTypes.EmptyArray);
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
        expect(TypeGetter.get({ message: 'hello' })).toEqual(null);
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

      describe('when the value is a uuid and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(
            TypeGetter.get('2d162303-78bf-599e-b197-93590ac3d315', PrimitiveTypes.String),
          ).toEqual(PrimitiveTypes.String);
        });
      });

      describe('when it is a number as string', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2258')).toEqual(PrimitiveTypes.Number);
        });

        it('should not return Number when the given context is a Number', () => {
          expect(TypeGetter.get('2258', PrimitiveTypes.Number)).not.toEqual(PrimitiveTypes.Number);
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
