import TypeGetterUtil from '../../src/utils/type-checker';
import { PrimitiveTypes } from '../../src/interfaces/schema';
import ValidationTypes from '../../src/interfaces/validation';

describe('TypeGetterUtil', () => {
  describe('get', () => {
    describe('when the value is an Array', () => {
      describe('when all the values are numbers', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get([1, 2, 3])).toEqual(ValidationTypes.ArrayOfNumber);
        });

        it('should return the expected type when there are negative numbers', () => {
          expect(TypeGetterUtil.get([-1, 2, 3])).toEqual(ValidationTypes.ArrayOfNumber);
        });

        describe('when values are number and string number', () => {
          it('should return the expected type', () => {
            expect(TypeGetterUtil.get(['1', 2, 3])).toEqual(ValidationTypes.ArrayOfNumber);
          });
        });
      });

      describe('when all the values are boolean', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get([true, false])).toEqual(ValidationTypes.ArrayOfBoolean);
        });
      });

      describe('when all the values are string', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get(['str', 'str2', 'str'])).toEqual(ValidationTypes.ArrayOfString);
        });
      });

      describe('when the values are strings and numbers', () => {
        it('should return null', () => {
          expect(TypeGetterUtil.get(['str', 1, 'str'])).toEqual(null);
        });
      });

      describe('when there is no value', () => {
        it('should return null', () => {
          expect(TypeGetterUtil.get([])).toEqual(ValidationTypes.EmptyArray);
        });
      });
    });

    describe('when the value is a Point', () => {
      it('should return null', () => {
        expect(TypeGetterUtil.get(JSON.stringify({ message: 'hello' }))).toEqual(
          PrimitiveTypes.Json,
        );
      });
    });

    describe('when the value is a number', () => {
      it('should the expected type', () => {
        expect(TypeGetterUtil.get(1526)).toEqual(PrimitiveTypes.Number);
      });
    });

    describe('when the value is a json', () => {
      it('should return the expected type', () => {
        expect(TypeGetterUtil.get(JSON.stringify({ message: 'hello' }))).toEqual(
          PrimitiveTypes.Json,
        );
      });
    });

    describe('when the value is an object', () => {
      it('should return null', () => {
        expect(TypeGetterUtil.get({ message: 'hello' })).toEqual(null);
      });
    });

    describe('when the value is a date', () => {
      describe('when it is a date without time', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get('2016-05-25')).toEqual(PrimitiveTypes.Dateonly);
        });
      });

      describe('when it is a date with time', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get('2016-05-25T09:24:15.123')).toEqual(PrimitiveTypes.Date);
        });
      });

      describe('when there is only the time', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get('09:24:15.123')).toEqual(PrimitiveTypes.Timeonly);
        });
      });
    });

    describe('when the value is a string', () => {
      describe('when it is an uuid', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get('2d162303-78bf-599e-b197-93590ac3d315')).toEqual(
            PrimitiveTypes.Uuid,
          );
        });
      });

      describe('when it is a number as string', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get('2258')).toEqual(PrimitiveTypes.Number);
        });
      });

      describe('when it is not an uuid or a number', () => {
        it('should return the expected type', () => {
          expect(TypeGetterUtil.get('a string')).toEqual(PrimitiveTypes.String);
        });
      });
    });
  });
});
