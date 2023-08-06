/* eslint-disable max-len */
import { ActionDefinition } from '../../src/decorators/actions/types/actions';
import { DynamicField } from '../../src/decorators/actions/types/fields';
import ActionValidator from '../../src/validators/action';

describe('ActionValidator', () => {
  describe('validateActionConfiguration', () => {
    describe('success cases', () => {
      test('it should validate an action with a form', () => {
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'PDF',
              description: 'DJHBD',
              type: 'File',
            },
            {
              label: 'amount',
              description: 'The amount (USD) to charge the credit card. Example: 42.50',
              type: 'Number',
            },
            {
              label: 'description',
              description: 'Explain the reason why you want to charge manually the customer here',
              isRequired: true,
              type: 'String',
              if: context => Number(context.formValues.Amount) > 4,
            },
            {
              label: 'stripe_id',
              type: 'String',
              if: () => false,
            },
          ],
          execute: async (context, resultBuilder) => {
            return resultBuilder.success(`Well well done ${context.caller.email}!`);
          },
        };
        expect(() => ActionValidator.validateActionConfiguration('TheName', action)).not.toThrow();
      });
      test('it should validate an action without a form', () => {
        const action: ActionDefinition = {
          scope: 'Single',
          execute: async (context, resultBuilder) => {
            return resultBuilder.success(`Well well done ${context.caller.email}!`);
          },
        };
        expect(() => ActionValidator.validateActionConfiguration('TheName', action)).not.toThrow();
      });
      test('it should validate an action with an empty form', () => {
        const action: ActionDefinition = {
          scope: 'Bulk',
          form: [],
          execute: () => {},
        };
        expect(() => ActionValidator.validateActionConfiguration('TheName', action)).not.toThrow();
      });
      test('it should validate an action with correct fields types', () => {
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'field1',
              type: 'Enum',
              enumValues: ['1', '2', '3'],
              defaultValue: async () => '1',
            },
            {
              label: 'field1',
              type: 'EnumList',
              enumValues: ['1', '2', '3'],
              defaultValue: async context => ['2', '3', context.toString()],
            },
            { label: 'field2', type: 'NumberList', defaultValue: [12] },
            { label: 'field8', type: 'Number', defaultValue: async () => 12 },
            { label: 'field3', type: 'NumberList', value: () => [1, 2, 1000] },
            {
              label: 'field34',
              type: 'File',
              defaultValue: { name: 'string', lastModified: 'aa' } as unknown as File,
            },
            {
              label: 'field15',
              type: 'FileList',
              defaultValue: () => {
                return [{ name: 'string', lastModified: 'aa' } as unknown as File];
              },
            },
            { label: 'field26', type: 'Json', if: context => Boolean(context) },
            { label: 'field46', type: 'Date', description: 'The date' },
            { label: 'field66', type: 'Dateonly', description: 'the date only' },
            { label: 'field7', type: 'String', defaultValue: 'a' },
            { label: 'field4', type: 'StringList', defaultValue: ['1', '2'] },
            {
              label: 'field5',
              type: 'Boolean',
              isReadOnly: true,
              isRequired: () => false,
              defaultValue: false,
            },
            { label: 'field6', type: 'Collection', collectionName: () => ['Users'] },
          ],
          execute: () => {},
        };
        expect(() => ActionValidator.validateActionConfiguration('TheName', action)).not.toThrow();
      });

      test('it should validate an action with lower case scope', () => {
        const action = {
          scope: 'single',
          execute: async (context, resultBuilder) => {
            return resultBuilder.success(`Well well done !`);
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration(
            'TheName',
            action as unknown as ActionDefinition,
          ),
        ).not.toThrow();
      });
    });

    describe('documentation samples', () => {
      test('it should validate a simple action example', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions#in-your-code
        const action: ActionDefinition = {
          scope: 'Single',
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          execute: async context => {
            // Perform work here.
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      test('it should validate an action getting data from the context', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/scope-context#example-1-getting-data-from-the-selected-records
        const action: ActionDefinition = {
          scope: 'Single',
          execute: async context => {
            // use getRecords() for bulk and global actions
            const { firstName } = await context.getRecord(['firstName']);

            if (firstName === 'John') {
              // eslint-disable-next-line no-console
              console.log('Hi John!');
            } else {
              console.error('You are not John!');
            }
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      test('it should validate an action with a static form field', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/forms-static#field-configuration'
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'amount',
              description: 'The amount (USD) to charge the credit card. Example: 42.50',
              type: 'Number',
              isRequired: true,
            },
          ],
          execute: async (context, resultBuilder) => {
            // Retrieve values entered in the form and columns from the selected record.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { amount } = context.formValues;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { stripeId, address } = await context.getRecord(['stripeId', 'address:country']);

            /* ... Charge the credit card here ... */
            return resultBuilder.success('Amount charged!');
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      // eslint-disable-next-line max-len
      test('it should validate an action with a static form field that gets data from the context to execute', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/forms-static#references-to-records
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'Assignee',
              description: 'The user to assign the ticket to',
              type: 'Collection',
              collectionName: ['user'],
              isRequired: true,
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          execute: async (context, resultBuilder) => {
            // Retrieve user id from the form
            // (assuming the user collection has a single primary key)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [userId] = context.formValues.Assignee;
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      test('it should validate an action with a dynamic field', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/forms-dynamic
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'amount',
              type: 'Number',
              description: 'The amount (USD) to charge the credit card. Example: 42.50',
              isRequired: true,
            },
            {
              label: 'description',
              type: 'String',
              description: 'Explain why you want to charge the customer manually',

              /**
               * The field will only be required if the function returns true.
               */
              isRequired: context => context.formValues.amount > 1000,
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          execute: async (context, resultBuilder) => {
            // ...
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      test('it should validate an with a dynamic field dependant on record data', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/forms-dynamic#example-2-conditional-field-display-based-on-record-data
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            { label: 'Rating', type: 'Enum', enumValues: ['1', '2', '3', '4', '5'] },

            // Only display this field if the rating is 4 or 5
            {
              label: 'Put a comment',
              type: 'String',
              if: context => Number(context.formValues.Rating) >= 4,
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          execute: async context => {
            /* ... perform work here ... */
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      test('it should validate a complex dynamic action with dynamic enum', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/forms-dynamic#example-3-conditional-enum-values-based-on-both-record-data-and-form-values
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'How should we refer to you?',
              type: 'Enum',
              enumValues: async context => {
                let gender;
                // Enum values are computed based on the record data
                // Use an async function to fetch the record data
                const user = await context.getRecord(['firstName', 'lastName', 'gender']);
                const base = [user.firstName, `${user.firstName} ${user.lastName}`];

                if (gender === 'Female') {
                  return [...base, `Mrs. ${user.lastName}`, `Miss ${user.lastName}`];
                }

                return [...base, `Mr. ${user.lastName}`];
              },
            },
            {
              label: 'How loud should we say it?',
              type: 'Enum',
              enumValues: context => {
                // Enum values are computed based on another form field value
                // (no need to use an async function, but doing so would not be a problem)
                const denomination = context.formValues['How should we refer to you?'];

                return denomination === 'Morgan Freeman'
                  ? ['Whispering', 'Softly', 'Loudly']
                  : ['Softly', 'Loudly', 'Very Loudly'];
              },
            },
          ],
          execute: async (context, resultBuilder) => {
            const denomination = context.formValues['How should we refer to you?'];
            const loudness = context.formValues['How loud should we say it?'];

            let text = `Hello ${denomination}`;

            if (loudness === 'Whispering') {
              text = text.toLowerCase();
            } else if (loudness === 'Loudly') {
              text = text.toUpperCase();
            } else if (loudness === 'Very Loudly') {
              text = `${text.toUpperCase()}!!!`;
            }

            return resultBuilder.success(text);
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
      test('it should validate an action using changeField to reset a value', () => {
        // https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions/forms-dynamic#example-4-using-changedfield-to-reset-value
        const action: ActionDefinition = {
          scope: 'Single',
          form: [
            {
              label: 'Bank Name',
              type: 'Enum',
              enumValues: ['CE', 'BP'],
              isRequired: true,
            },
            {
              label: 'BIC',
              type: 'String',
              value: context => {
                if (context.changedField === 'Bank Name') {
                  return context.formValues['Bank Name'] === 'CE' ? 'CEPAFRPPXXX' : 'CCBPFRPPXXX';
                }

                return 'CEPAFRPPXXX';
              },
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          execute: async (context, resultBuilder) => {
            // ...
          },
        };
        expect(() =>
          ActionValidator.validateActionConfiguration('Mark as live', action),
        ).not.toThrow();
      });
    });

    describe('error cases', () => {
      test('it should reject an action with incorrect scope', () => {
        const action = {
          scope: 'Total',
          execute: () => {},
        };
        expect(() =>
          ActionValidator.validateActionConfiguration(
            'TheName',
            action as unknown as ActionDefinition,
          ),
        ).toThrow('scope must be equal to one of the allowed values: (Single,Bulk,Global');
      });
      test('it should reject an action with missing required scope property', () => {
        const action = {
          execute: () => {},
        };
        expect(() =>
          ActionValidator.validateActionConfiguration(
            'TheName',
            action as unknown as ActionDefinition,
          ),
        ).toThrow(`must have required property 'scope'`);
      });

      describe('action field error cases', () => {
        [
          {
            test: 'it should display the field label in the error message',
            field: { label: 'field1' } as unknown as DynamicField,
            error: `Error in action form configuration, field 'field1'`,
          },
          {
            test: 'it should display the action name in the error message',
            field: { label: 'field1' } as unknown as DynamicField,
            error: `Error in action 'TheName' configuration:`,
          },
          {
            field: { label: 'field1' } as unknown as DynamicField,
            error: `Invalid or missing action field type`,
          },
          {
            field: { label: 'field1', type: 'Boolean', isRequired: {} } as unknown as DynamicField,
            error: `Validation error: Expected boolean, received object at "isRequired"`,
          },
          {
            field: {
              label: 'field1',
              type: 'Collection',
              collectionName: {},
            } as unknown as DynamicField,
            error: `Validation error: Expected string, received object at "collectionName"`,
          },
          {
            field: { label: 123, type: 'String' } as unknown as DynamicField,
            error: `Validation error: Expected string, received number at "label"`,
          },
          {
            field: { label: 'field1', type: 'tartiflette' } as unknown as DynamicField,
            error: `Invalid or missing action field type`,
          },
        ].forEach(wrongField => {
          test(
            // eslint-disable-next-line jest/valid-title
            wrongField.test
              ? (wrongField.test as string)
              : `it should reject with a helpful message if a field is incorrect:
        ${JSON.stringify(wrongField.field)}`,
            () => {
              const action: ActionDefinition = {
                scope: 'Single',
                form: [wrongField.field, { label: 'field2', type: 'Number' }],
                execute: async () => {},
              };
              expect(() => ActionValidator.validateActionConfiguration('TheName', action)).toThrow(
                wrongField.error,
              );
            },
          );
        });
      });
    });
  });
});
