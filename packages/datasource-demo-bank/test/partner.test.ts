import { readApplication } from '../src/customizations/actions/partner';

// A valid application, as the partner portal sends it.
const application = {
  Partner: 'Jest Partner',
  'First name': 'Ada',
  'Last name': 'Testerson',
  'Date of birth': '1990-05-12',
  Nationality: 'FR',
  Email: 'ada.testerson@example.com',
  Phone: '+33 6 12 34 56 78',
  Address: '1 rue de la Paix',
  'Postal code': '75002',
  City: 'Paris',
  Country: 'FR',
  'Employment status': 'EMPLOYED',
  Occupation: 'Engineer',
  'Income band': 'FROM_40K_TO_70K',
  'Source of funds': 'SALARY',
  'Expected monthly income': 3200,
  'Expected monthly spending': 2100,
};

describe('readApplication', () => {
  it('should read a valid application, its date of birth as typed', () => {
    expect(readApplication(application)).toMatchObject({
      partner: 'Jest Partner',
      person: { date_of_birth: '1990-05-12', income_band: 'FROM_40K_TO_70K', is_us_person: false },
      monthlyIn: 3200,
      monthlyOut: 2100,
      language: null,
    });
  });

  it.each([
    ['Employment status', 'an employment status from its list'],
    ['Income band', 'an income band from its list'],
    ['Source of funds', 'a source of funds from its list'],
  ])('should refuse an application without its %s', (field, what) => {
    expect(readApplication({ ...application, [field]: undefined })).toEqual({
      error: `The application needs ${what}.`,
    });
  });

  it('should refuse an Enum value its list does not hold, the preferred language too', () => {
    expect(readApplication({ ...application, 'Income band': 'BILLIONS' })).toEqual({
      error: 'The application needs an income band from its list.',
    });
    expect(readApplication({ ...application, 'Preferred language': 'KLINGON' })).toEqual({
      error: 'The application needs a language from its list.',
    });
  });

  it.each(['1990-02-31', '2024-13-45', 'not a date'])(
    'should refuse a date of birth that is no real day (%s)',
    day => {
      expect(readApplication({ ...application, 'Date of birth': day })).toEqual({
        error: 'The application needs a date of birth at least 18 years ago.',
      });
    },
  );

  it.each([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    [undefined, false],
  ])('should read "US person" %p as %p', (given, expected) => {
    expect(readApplication({ ...application, 'US person': given })).toMatchObject({
      person: { is_us_person: expected },
    });
  });

  it.each(['Infinity', -1, ''])('should refuse an expected monthly income of %p', amount => {
    expect(readApplication({ ...application, 'Expected monthly income': amount })).toEqual({
      error: 'The application needs the expected monthly income.',
    });
  });
});
