import type {
  ActionContextSingle,
  DynamicField,
  DynamicForm,
} from '@forestadmin/datasource-customizer';
import type { RecordData } from '@forestadmin/datasource-toolkit';

import { TICKET_PRIORITIES, TICKET_TYPES } from '../../enums';

export type EmailTemplate = { title: string; content: string };

export type FormBuilderOptions = {
  emailTemplates?: EmailTemplate[];
  requesterEmailDefault?: string | ((record: RecordData) => string);
  defaultSubject?: string | ((record: RecordData) => string);
  defaultMessage?: string | ((record: RecordData) => string);
  priorityOverride?: (typeof TICKET_PRIORITIES)[number];
  typeOverride?: (typeof TICKET_TYPES)[number];
  showInternalNote?: boolean;
};

export const FORM_FIELDS = {
  template: 'Template',
  requesterEmail: 'Requester email',
  subject: 'Subject',
  message: 'Message',
  priority: 'Priority',
  type: 'Type',
  internalNote: 'Send as internal note',
} as const;

const NO_TEMPLATE = 'No template';

type Ctx = ActionContextSingle;

const TOKEN_PATTERN = /{{\s*record\.([\w.]+)\s*}}/g;

function readPath(record: RecordData, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      record,
    );
}

export function interpolate(template: string, record: RecordData): string {
  return template.replace(TOKEN_PATTERN, (_match, path: string) => {
    const value = readPath(record, path);

    return value === undefined || value === null ? '' : String(value);
  });
}

// The column field names of the action's collection. `getRecord` only loads the fields it is
// asked for, so an empty projection would yield a record with no usable values to interpolate.
function recordColumns(ctx: Ctx): string[] {
  const fields = (
    ctx as unknown as { collection?: { schema?: { fields?: Record<string, { type?: string }> } } }
  ).collection?.schema?.fields;

  if (!fields) return [];

  return Object.entries(fields)
    .filter(([, schema]) => schema?.type === 'Column')
    .map(([name]) => name);
}

async function getSingleRecord(ctx: Ctx): Promise<RecordData> {
  if ('getRecord' in ctx && typeof ctx.getRecord === 'function') {
    try {
      return ((await ctx.getRecord(recordColumns(ctx))) ?? {}) as RecordData;
    } catch {
      return {};
    }
  }

  return {};
}

function withSingleRecord(
  source: string | ((record: RecordData) => string),
): (ctx: Ctx) => Promise<string> {
  return async (ctx: Ctx) => {
    const record = await getSingleRecord(ctx);

    if (typeof source === 'function') return interpolate(source(record), record);

    return interpolate(source, record);
  };
}

function applyMessageValue(
  field: DynamicField<Ctx>,
  options: FormBuilderOptions,
  useTemplate: boolean,
): void {
  if (!useTemplate) {
    if (typeof options.defaultMessage === 'string') {
      field.defaultValue = options.defaultMessage;
    } else if (typeof options.defaultMessage === 'function') {
      const fn = options.defaultMessage;

      field.defaultValue = async (ctx: Ctx) => {
        const record = await getSingleRecord(ctx);

        return interpolate(fn(record), record);
      };
    }

    return;
  }

  const templates = options.emailTemplates ?? [];
  const fallback = options.defaultMessage;

  field.value = async (ctx: Ctx): Promise<string> => {
    const selected = ctx.formValues[FORM_FIELDS.template];

    if (typeof selected === 'string' && selected !== NO_TEMPLATE) {
      const template = templates.find(t => t.title === selected);

      if (template) {
        const record = await getSingleRecord(ctx);

        return interpolate(template.content, record);
      }
    }

    if (fallback) {
      const record = await getSingleRecord(ctx);
      const resolved = typeof fallback === 'function' ? fallback(record) : fallback;

      return interpolate(resolved, record);
    }

    return '';
  };
}

function buildBodyFields(
  options: FormBuilderOptions,
  { useTemplate }: { useTemplate: boolean },
): DynamicField<Ctx>[] {
  const fields: DynamicField<Ctx>[] = [];

  const emailField: DynamicField<Ctx> = {
    label: FORM_FIELDS.requesterEmail,
    type: 'String',
    isRequired: true,
    description:
      'Email of the Zendesk requester. Pre-filled from the selected record when available.',
  };

  if (options.requesterEmailDefault !== undefined) {
    emailField.defaultValue = withSingleRecord(options.requesterEmailDefault);
  }

  fields.push(emailField);

  const subjectField: DynamicField<Ctx> = {
    label: FORM_FIELDS.subject,
    type: 'String',
    isRequired: true,
  };

  if (options.defaultSubject !== undefined) {
    subjectField.defaultValue = withSingleRecord(options.defaultSubject);
  }

  fields.push(subjectField);

  const messageField: DynamicField<Ctx> = {
    label: FORM_FIELDS.message,
    type: 'String',
    widget: 'RichText',
    isRequired: true,
    description:
      // eslint-disable-next-line max-len
      "Sent as the ticket's first comment (HTML). Public comments trigger the default Zendesk notification email to the requester.",
  };
  applyMessageValue(messageField, options, useTemplate);
  fields.push(messageField);

  if (!options.priorityOverride) {
    fields.push({
      label: FORM_FIELDS.priority,
      type: 'Enum',
      enumValues: [...TICKET_PRIORITIES],
      defaultValue: 'normal',
    });
  }

  if (!options.typeOverride) {
    fields.push({
      label: FORM_FIELDS.type,
      type: 'Enum',
      enumValues: [...TICKET_TYPES],
    });
  }

  if (options.showInternalNote) {
    fields.push({
      label: FORM_FIELDS.internalNote,
      type: 'Boolean',
      defaultValue: false,
      description:
        'When checked, the first comment is private and no email is sent to the requester.',
    });
  }

  return fields;
}

function buildMultiPageForm(options: FormBuilderOptions): DynamicForm<Ctx> {
  const templates = options.emailTemplates ?? [];
  const titles = templates.map(t => t.title);

  return [
    {
      type: 'Layout',
      component: 'Page',
      nextButtonLabel: 'Continue',
      elements: [
        {
          label: FORM_FIELDS.template,
          type: 'Enum',
          isRequired: true,
          enumValues: [NO_TEMPLATE, ...titles],
          defaultValue: NO_TEMPLATE,
        },
      ],
    },
    {
      type: 'Layout',
      component: 'Page',
      previousButtonLabel: 'Back',
      elements: buildBodyFields(options, { useTemplate: true }),
    },
  ];
}

export function buildForm(options: FormBuilderOptions): DynamicForm<Ctx> {
  return options.emailTemplates?.length
    ? buildMultiPageForm(options)
    : buildBodyFields(options, { useTemplate: false });
}
