const { addLanguageOnCustomer } = require('./actions/onboarding');
const { addLiveDay } = require('../seed/live');

/** Customers: "Change preferred language", then the presenter's "Start the day". */
function customizeCustomers(collection) {
  addLanguageOnCustomer(collection);
  addLiveDay(collection);
}

module.exports = customizeCustomers;
