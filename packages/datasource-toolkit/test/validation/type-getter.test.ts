import TypeGetter from '../../src/validation/type-getter';

describe('TypeGetter', () => {
  describe('get', () => {
    describe('when the value is a number', () => {
      it('should the expected type', () => {
        expect(TypeGetter.get(1526, 'Number')).toEqual('Number');
      });
    });

    describe('when the value is a json', () => {
      it('should return the expected type', () => {
        expect(TypeGetter.get(JSON.stringify({ message: 'hello' }), 'Json')).toEqual('Json');
      });

      describe('when the value is an array of string and the expected type is json', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get(['item1'], 'Json')).toEqual('Json');
        });
      });

      describe('when the value is an array of plain object the expected type is json', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get([{ foo: 'bar' }], 'Json')).toEqual('Json');
        });
      });

      describe('when the value is a valid JSON', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('item1', 'Json')).toEqual('Json');
        });
      });
    });

    describe('when the value is an object', () => {
      it('should return Json', () => {
        expect(TypeGetter.get({ message: 'hello' }, 'Json')).toEqual('Json');
      });
    });

    describe('when the value is a date', () => {
      describe('when it is a js date', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get(new Date(), 'Date')).toEqual('Date');
        });
      });

      describe('when it is a date without time', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2016-05-25', 'Dateonly')).toEqual('Dateonly');
        });
      });

      describe('when it is a date with time', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2016-05-25T09:24:15.123', 'Date')).toEqual('Date');
        });
      });

      describe('when there is only the time', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('09:24:15.123', 'Date')).toEqual('Time');
        });
      });
    });

    describe('when the value is a string', () => {
      describe('when the value is a json and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get(JSON.stringify({ message: 'hello' }), 'String')).toEqual('String');
        });
      });

      describe('when the given context is an Enum', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('an enum value', 'Enum')).toEqual('Enum');
        });
      });

      describe('when it is a date and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2016-05-25', 'String')).toEqual('String');
        });
      });

      describe('when it is an uuid', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2d162303-78bf-599e-b197-93590ac3d315', 'Uuid')).toEqual('Uuid');
        });
      });

      describe('when the value is an uuid and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('2d162303-78bf-599e-b197-93590ac3d315', 'String')).toEqual(
            'String',
          );
        });
      });

      describe('when the value is a number and the given context is a String', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('12', 'String')).toEqual('String');
        });
      });

      describe('when it is not an uuid or a number', () => {
        it('should return the expected type', () => {
          expect(TypeGetter.get('a string', 'String')).toEqual('String');
        });
      });
    });
  });
});
