import { AllRecordsMode } from './forest-http-api';

export default class Data {
  static parseAllRecordsMode(context): AllRecordsMode {
    const attributes = context.request.body?.data?.attributes;

    return {
      isActivated: Boolean(attributes?.all_records),
      excludedIds: attributes?.all_records_ids_excluded,
    };
  }
}
