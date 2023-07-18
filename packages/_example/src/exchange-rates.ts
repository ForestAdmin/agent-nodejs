/* eslint-disable no-await-in-loop */
import { CollectionReplicaSchema, createReplicaDataSource } from '@forestadmin/datasource-replica';
import axios from 'axios';

const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api`;

const currencyApiSchema: CollectionReplicaSchema[] = [
  {
    name: 'country',
    fields: {
      country_iso3: { type: 'String', isPrimaryKey: true },
      country_name: { type: 'String' },
      currency_code: {
        type: 'String',
        reference: {
          relationName: 'currency',
          targetCollection: 'currency',
          targetField: 'code',
          relationInverse: 'countries',
        },
      },
    },
  },
  {
    name: 'currency',
    fields: {
      code: { type: 'String', isPrimaryKey: true },
      name: { type: 'String' },
    },
  },
  {
    name: 'exchange_rate',
    fields: {
      date: { type: 'Dateonly', isPrimaryKey: true },
      currency_code: {
        type: 'String',
        isPrimaryKey: true,
        reference: {
          relationName: 'currency',
          targetCollection: 'currency',
          targetField: 'code',
          relationInverse: 'rates',
        },
      },
      rate: { type: 'Number' },
    },
  },
];

function getDateFromXDaysAgo(numDays: number) {
  const today = new Date();
  const xDaysAgo = new Date(new Date().setDate(today.getDate() - numDays)).toISOString();

  return xDaysAgo.substring(0, 10);
}

async function getCountries() {
  const countries = await axios.get(`${url}@1/country.json`);

  return Object.entries(countries.data).map(([code, country]) => ({
    collection: 'country',
    record: { country_iso2: code, ...(country as Record<string, unknown>) },
  }));
}

async function getCurrencies() {
  const currencies = await axios.get(`${url}@1/latest/currencies.json`);

  return Object.entries(currencies.data).map(([code, name]) => ({
    collection: 'currency',
    record: { code, name },
  }));
}

async function getRatesFromXDaysAgo(numDays: number) {
  try {
    const rates = await axios.get(`${url}@1/${getDateFromXDaysAgo(numDays)}/currencies/eur.json`);

    return Object.entries(rates.data.eur).map(([currency_code, rate]) => ({
      collection: 'exchange_rate',
      record: { date: rates.data.date, currency_code, rate },
    }));
  } catch {
    // The API does not have data for this day
    return [];
  }
}

export default function createCurrencyApiDataSource(days: number) {
  return createReplicaDataSource({
    cacheInto: 'sqlite::memory:',
    schema: currencyApiSchema,
    pullDumpOnSchedule: '@monthly', // Reset cache each month
    pullDumpHandler: async () => {
      const rates = [];
      for (let i = 0; i < days; i += 1) rates.push(...(await getRatesFromXDaysAgo(i)));

      return {
        more: false,
        nextDeltaState: rates[0].record.date,
        entries: [...(await getCountries()), ...(await getCurrencies()), ...rates],
      };
    },

    pullDeltaOnSchedule: '0 30 0 * * *', // Update cache each day at 00:30
    pullDeltaHandler: async request => {
      const today = getDateFromXDaysAgo(0);
      const rates = request.previousDeltaState <= today ? await getRatesFromXDaysAgo(0) : [];

      return {
        more: false,
        nextDeltaState: rates?.[0].record.date ?? request.previousDeltaState,
        newOrUpdatedEntries: rates,
        deletedEntries: [],
      };
    },
  });
}
