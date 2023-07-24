const COMPANIES = 'companies';
export const CONTACTS = 'contacts';
const DEALS = 'deals';
const FEEDBACK_SUBMISSIONS = 'feedback_submissions';
const LINE_ITEMS = 'line_items';
const PRODUCTS = 'products';
const QUOTES = 'quotes';
const TICKETS = 'tickets';

export const HUBSPOT_COLLECTIONS = [
  COMPANIES,
  CONTACTS,
  DEALS,
  FEEDBACK_SUBMISSIONS,
  LINE_ITEMS,
  PRODUCTS,
  QUOTES,
  TICKETS,
];

/**
 * This seems to be the actual maximum page size (did not find it in the documentation).
 * @see https://community.hubspot.com/t5/HubSpot-Ideas/Increase-API-Response-Maximum-Page-Size-Maximum-Record-Count/idi-p/435453
 */
export const HUBSPOT_MAX_PAGE_SIZE = 100;
export const HUBSPOT_RATE_LIMIT_SEARCH_REQUEST_BY_SECOND = 4;
export const HUBSPOT_RATE_LIMIT_FILTER_VALUES = 100;

export const MANY_TO_MANY_SEPARATOR = '___';
