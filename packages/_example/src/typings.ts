/* eslint-disable */
export type Schema = {
  'hubspot_companies': {
    plain: {
      'id': string;
      'city': string;
      'name': string;
      'country': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_companies___contacts': {
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
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
    };
  };
  'hubspot_companies___deals': {
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
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'deals:id': string;
      'deals:description': string;
    };
  };
  'hubspot_companies___feedback_submissions': {
    plain: {
      'companies_id': string;
      'feedback_submissions_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'feedback_submissions:id': string;
    };
  };
  'hubspot_companies___forests': {
    plain: {
      'companies_id': string;
      'forests_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'forests:id': string;
      'forests:fieldpro': string;
    };
  };
  'hubspot_companies___line_items': {
    plain: {
      'companies_id': string;
      'line_items_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'line_items:id': string;
    };
  };
  'hubspot_companies___quotes': {
    plain: {
      'companies_id': string;
      'quotes_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
    };
  };
  'hubspot_companies___testalbans': {
    plain: {
      'companies_id': string;
      'testalbans_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_companies___tickets': {
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
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'email': string;
      'firstname': string;
      'lastname': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_contacts___deals': {
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
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'deals:id': string;
      'deals:description': string;
    };
  };
  'hubspot_contacts___feedback_submissions': {
    plain: {
      'contacts_id': string;
      'feedback_submissions_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'feedback_submissions:id': string;
    };
  };
  'hubspot_contacts___forests': {
    plain: {
      'contacts_id': string;
      'forests_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'forests:id': string;
      'forests:fieldpro': string;
    };
  };
  'hubspot_contacts___line_items': {
    plain: {
      'contacts_id': string;
      'line_items_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'line_items:id': string;
    };
  };
  'hubspot_contacts___quotes': {
    plain: {
      'contacts_id': string;
      'quotes_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
    };
  };
  'hubspot_contacts___testalbans': {
    plain: {
      'contacts_id': string;
      'testalbans_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_contacts___tickets': {
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
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_deals': {
    plain: {
      'id': string;
      'description': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_deals___feedback_submissions': {
    plain: {
      'deals_id': string;
      'feedback_submissions_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'feedback_submissions:id': string;
    };
  };
  'hubspot_deals___forests': {
    plain: {
      'deals_id': string;
      'forests_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'forests:id': string;
      'forests:fieldpro': string;
    };
  };
  'hubspot_deals___line_items': {
    plain: {
      'deals_id': string;
      'line_items_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'line_items:id': string;
    };
  };
  'hubspot_deals___quotes': {
    plain: {
      'deals_id': string;
      'quotes_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
    };
  };
  'hubspot_deals___testalbans': {
    plain: {
      'deals_id': string;
      'testalbans_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_deals___tickets': {
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
      'deals:description': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_feedback_submissions': {
    plain: {
      'id': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_feedback_submissions___forests': {
    plain: {
      'feedback_submissions_id': string;
      'forests_id': string;
    };
    nested: {
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
    };
    flat: {
      'feedback_submissions:id': string;
      'forests:id': string;
      'forests:fieldpro': string;
    };
  };
  'hubspot_feedback_submissions___line_items': {
    plain: {
      'feedback_submissions_id': string;
      'line_items_id': string;
    };
    nested: {
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
    };
    flat: {
      'feedback_submissions:id': string;
      'line_items:id': string;
    };
  };
  'hubspot_feedback_submissions___quotes': {
    plain: {
      'feedback_submissions_id': string;
      'quotes_id': string;
    };
    nested: {
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
    };
    flat: {
      'feedback_submissions:id': string;
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
    };
  };
  'hubspot_feedback_submissions___testalbans': {
    plain: {
      'feedback_submissions_id': string;
      'testalbans_id': string;
    };
    nested: {
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'feedback_submissions:id': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_feedback_submissions___tickets': {
    plain: {
      'feedback_submissions_id': string;
      'tickets_id': string;
    };
    nested: {
      'feedback_submissions': Schema['hubspot_feedback_submissions']['plain'] & Schema['hubspot_feedback_submissions']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'feedback_submissions:id': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_forests': {
    plain: {
      'id': string;
      'fieldpro': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_forests___line_items': {
    plain: {
      'forests_id': string;
      'line_items_id': string;
    };
    nested: {
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
    };
    flat: {
      'forests:id': string;
      'forests:fieldpro': string;
      'line_items:id': string;
    };
  };
  'hubspot_forests___quotes': {
    plain: {
      'forests_id': string;
      'quotes_id': string;
    };
    nested: {
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
    };
    flat: {
      'forests:id': string;
      'forests:fieldpro': string;
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
    };
  };
  'hubspot_forests___testalbans': {
    plain: {
      'forests_id': string;
      'testalbans_id': string;
    };
    nested: {
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'forests:id': string;
      'forests:fieldpro': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_forests___tickets': {
    plain: {
      'forests_id': string;
      'tickets_id': string;
    };
    nested: {
      'forests': Schema['hubspot_forests']['plain'] & Schema['hubspot_forests']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'forests:id': string;
      'forests:fieldpro': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_line_items': {
    plain: {
      'id': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_line_items___quotes': {
    plain: {
      'line_items_id': string;
      'quotes_id': string;
    };
    nested: {
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
    };
    flat: {
      'line_items:id': string;
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
    };
  };
  'hubspot_line_items___testalbans': {
    plain: {
      'line_items_id': string;
      'testalbans_id': string;
    };
    nested: {
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'line_items:id': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_line_items___tickets': {
    plain: {
      'line_items_id': string;
      'tickets_id': string;
    };
    nested: {
      'line_items': Schema['hubspot_line_items']['plain'] & Schema['hubspot_line_items']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'line_items:id': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_quotes': {
    plain: {
      'id': string;
      'hs_sender_company_name': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_quotes___testalbans': {
    plain: {
      'quotes_id': string;
      'testalbans_id': string;
    };
    nested: {
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_quotes___tickets': {
    plain: {
      'quotes_id': string;
      'tickets_id': string;
    };
    nested: {
      'quotes': Schema['hubspot_quotes']['plain'] & Schema['hubspot_quotes']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'quotes:id': string;
      'quotes:hs_sender_company_name': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_testalbans': {
    plain: {
      'id': string;
      'mon_object_perso': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_testalbans___tickets': {
    plain: {
      'testalbans_id': string;
      'tickets_id': string;
    };
    nested: {
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
      'tickets': Schema['hubspot_tickets']['plain'] & Schema['hubspot_tickets']['nested'];
    };
    flat: {
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
      'tickets:id': string;
      'tickets:content': string;
    };
  };
  'hubspot_tickets': {
    plain: {
      'id': string;
      'content': string;
    };
    nested: {};
    flat: {};
  };
};
