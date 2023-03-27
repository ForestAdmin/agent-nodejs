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
          expect(TypeGetter.get('09:24:15.123', 'Date')).toEqual('Timeonly');
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
        describe('when v1', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get('3defd622-ccb4-11ed-afa1-0242ac120002', 'Uuid')).toEqual('Uuid');
          });
        });

        describe('when v3', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get('1d36d561-950c-3f6a-9710-e51e740e8c8b', 'Uuid')).toEqual('Uuid');
          });
        });

        describe('when v4', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get('7202e0e8-06ca-4f67-af5e-fb7205a08648', 'Uuid')).toEqual('Uuid');
          });
        });

        describe('when v5', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get('ae8a0c9b-144c-5380-bfe3-8eb67c3c2196', 'Uuid')).toEqual('Uuid');
          });
        });

        describe('when the version is unknown', () => {
          it('should return the expected type', () => {
            expect(TypeGetter.get('ae8a0c9b-144c-8380-bfe3-8eb67c3c2196', 'Uuid')).toEqual('Uuid');
          });
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
