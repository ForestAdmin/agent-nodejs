import type { CustomersCustomizer } from '../typings';

import { demoFields } from '../../connections/data-model';
import { history, now, one, patch } from '../case-helpers';

const LANGUAGE_NAMES = {
  FR: 'French',
  EN: 'English',
  DE: 'German',
  ES: 'Spanish',
  IT: 'Italian',
  NL: 'Dutch',
};
const languageLabel = (code: string) => (code ? `${LANGUAGE_NAMES[code] || code} (${code})` : null);
const LANGUAGES = demoFields('customers')
  .find(field => field.name === 'preferred_language')
  .enum.map(languageLabel);
const languageCode = (text: string) => /\((\w+)\)$/.exec(text || '')?.[1] || null;
const CUSTOMER_LANGUAGE_FIELDS = ['id', 'reference', 'display_name', 'preferred_language'];

export function languageAction(customerIdOf: (context) => Promise<string>) {
  const customerOf = async context =>
    one(context, 'customers', await customerIdOf(context), CUSTOMER_LANGUAGE_FIELDS);

  return {
    scope: 'Single' as const,
    form: [
      {
        label: 'Language',
        type: 'Enum' as const,
        enumValues: LANGUAGES,
        isRequired: true,
        description: 'Letters, emails and calls to the customer use it',
        defaultValue: async context =>
          languageLabel((await customerOf(context))?.preferred_language),
      },
    ],
    execute: async (context, resultBuilder) => {
      const customer = await customerOf(context);
      if (!customer) return resultBuilder.error('No customer on this record.');
      const to = languageCode(context.formValues.Language);
      if (!to) return resultBuilder.error('Pick a language.');
      const from = customer.preferred_language || null;

      if (to === from) {
        return resultBuilder.success(
          `${customer.display_name} already speaks ${languageLabel(to)} with us: nothing changed.`,
        );
      }

      await patch(context, 'customers', customer.id, { preferred_language: to, updated_at: now() });
      await history(
        context,
        'CUSTOMERS',
        customer.id,
        [from, to],
        'Preferred language changed',
        'preferred_language',
      );

      return resultBuilder.success(
        `${customer.display_name}: preferred language ${
          languageLabel(from) || 'none'
        } → ${languageLabel(to)}.`,
      );
    },
  };
}

export default (collection: CustomersCustomizer) =>
  collection
    .addOneToManyRelation('cards', 'cards', { originKey: 'customer_id' })
    .addOneToManyRelation('alerts', 'alerts', { originKey: 'customer_id' })
    .addOneToManyRelation('kyc_cases', 'kyc_cases', { originKey: 'customer_id' })
    .addOneToManyRelation('chargebacks', 'chargebacks', { originKey: 'customer_id' })

    .addAction(
      'Change preferred language',
      languageAction(async context => (await context.getRecord(['id'])).id),
    );
