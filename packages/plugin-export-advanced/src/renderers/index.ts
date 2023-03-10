import renderCsv from './csv';
import renderJson from './json';
import renderXlsx from './xlsx';

export default {
  '.csv': {
    handler: renderCsv,
    mimeType: 'text/csv',
  },
  '.xlsx': {
    handler: renderXlsx,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  '.json': {
    handler: renderJson,
    mimeType: 'application/json',
  },
};
