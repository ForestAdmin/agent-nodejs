import { queryMerchants } from '../src/merchants-api';

const merchants = [
  { id: 'a', name: 'Carrefour Market', city: 'Paris', category: 'GROCERIES' },
  { id: 'b', name: 'Monoprix', city: 'Lyon', category: 'GROCERIES' },
  { id: 'c', name: 'Spotify', city: 'Stockholm', category: 'SHOPPING' },
  { id: 'd', name: 'Franprix', city: 'Paris', category: 'GROCERIES' },
];

describe('queryMerchants', () => {
  it('returns every merchant when the query is empty', () => {
    expect(queryMerchants(merchants, {})).toEqual({ total: 4, page: merchants });
  });

  it('keeps the merchants whose field equals the value', () => {
    expect(queryMerchants(merchants, { city: 'Paris' }).page.map(m => m.id)).toEqual(['a', 'd']);
  });

  it('reads a repeated parameter as a list of accepted values', () => {
    expect(queryMerchants(merchants, { id: ['b', 'c'] }).page.map(m => m.id)).toEqual(['b', 'c']);
  });

  it('combines filters on different fields', () => {
    const { page } = queryMerchants(merchants, { city: 'Paris', id: ['a', 'b'] });

    expect(page.map(m => m.id)).toEqual(['a']);
  });

  it('searches every text field, ignoring case', () => {
    expect(queryMerchants(merchants, { q: 'PRIX' }).page.map(m => m.id)).toEqual(['b', 'd']);
  });

  it('sorts on several fields with their own direction', () => {
    const { page } = queryMerchants(merchants, { _sort: 'category,name', _order: 'desc,asc' });

    expect(page.map(m => m.id)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('pages the results and counts every match', () => {
    const { total, page } = queryMerchants(merchants, { _sort: 'name', _start: '1', _limit: '2' });

    expect(total).toBe(4);
    expect(page.map(m => m.id)).toEqual(['d', 'b']);
  });

  it('answers a zero limit with the count only', () => {
    expect(queryMerchants(merchants, { city: 'Paris', _limit: '0' })).toEqual({
      total: 2,
      page: [],
    });
  });

  it('returns nothing when no merchant matches', () => {
    expect(queryMerchants(merchants, { city: 'Berlin' })).toEqual({ total: 0, page: [] });
  });
});
