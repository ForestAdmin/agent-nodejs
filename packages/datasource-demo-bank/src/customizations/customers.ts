import { addLanguageOnCustomer } from './actions/onboarding';
import { addLiveDay } from '../seed/live';

/** Customers: "Change preferred language", then the presenter's "Start the day". */
export default function customizeCustomers(collection) {
  addLanguageOnCustomer(collection);
  addLiveDay(collection);
}
