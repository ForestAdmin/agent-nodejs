/* eslint-disable */
export type Schema = {
  'hubspot_companies': {
    plain: {
      'id': string;
      'description': string;
      'days_to_close': number;
      'city': string;
      'owneremail': string;
      'state': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'city': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_deals': {
    plain: {
      'id': string;
      'closed_lost_reason': string;
      'closed_won_reason': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_feedback_submissions': {
    plain: {
      'id': string;
      'hs_agent_name': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_line_items': {
    plain: {
      'id': string;
      'hs_product_id': number;
      'description': string;
      'discount': number;
      'createdate': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_quotes': {
    plain: {
      'id': string;
      'hs_proposal_domain': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_tickets': {
    plain: {
      'id': string;
      'createdate': string;
    };
    nested: {};
    flat: {};
  };
  'typicode_posts': {
    plain: {
      'id': number;
      'userId': number;
      'title': string;
      'body': string;
    };
    nested: {
      'user': Schema['typicode_users']['plain'] & Schema['typicode_users']['nested'];
    };
    flat: {
      'user:id': number;
    };
  };
  'typicode_users': {
    plain: {
      'id': number;
    };
    nested: {};
    flat: {};
  };
  'whatever_users': {
    plain: {
      'id': number;
      'name': string;
      'address@@@city': string;
      'address@@@street': string;
    };
    nested: {};
    flat: {};
  };
  'whatever_users_address_zipCodes': {
    plain: {
      'value': number;
      '_fid': string;
      '_fpid': number;
    };
    nested: {
      'parent': Schema['whatever_users']['plain'] & Schema['whatever_users']['nested'];
    };
    flat: {
      'parent:id': number;
      'parent:name': string;
      'parent:address@@@city': string;
      'parent:address@@@street': string;
    };
  };
};
