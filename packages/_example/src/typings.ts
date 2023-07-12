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
  'hubspot_companies_contacts': {
    plain: {
      'companies_id': string;
      'contacts_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:description': string;
      'companies:days_to_close': number;
      'companies:city': string;
      'companies:owneremail': string;
      'companies:state': string;
      'contacts:id': string;
      'contacts:city': string;
    };
  };
  'hubspot_companies_deals': {
    plain: {
      'companies_id': string;
      'deals_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:description': string;
      'companies:days_to_close': number;
      'companies:city': string;
      'companies:owneremail': string;
      'companies:state': string;
      'deals:id': string;
      'deals:closed_lost_reason': string;
      'deals:closed_won_reason': string;
    };
  };
  'hubspot_companies_tickets': {
    plain: {
      'companies_id': string;
      'tickets_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:description': string;
      'companies:days_to_close': number;
      'companies:city': string;
      'companies:owneremail': string;
      'companies:state': string;
      'tickets:id': string;
      'tickets:createdate': string;
    };
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'city': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_contacts_deals': {
    plain: {
      'contacts_id': string;
      'deals_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:city': string;
      'deals:id': string;
      'deals:closed_lost_reason': string;
      'deals:closed_won_reason': string;
    };
  };
  'hubspot_contacts_tickets': {
    plain: {
      'contacts_id': string;
      'tickets_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:city': string;
      'tickets:id': string;
      'tickets:createdate': string;
    };
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
  'hubspot_deals_tickets': {
    plain: {
      'deals_id': string;
      'tickets_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:closed_lost_reason': string;
      'deals:closed_won_reason': string;
      'tickets:id': string;
      'tickets:createdate': string;
    };
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
