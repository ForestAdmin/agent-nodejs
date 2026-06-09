# @forestadmin/datasource-zendesk

Forest Admin datasource for Zendesk Support, with optional smart-action plugins.

Exposes three collections wired to the Zendesk REST + Search APIs:

| Forest collection       | Zendesk resource | CRUD          | Aggregation     |
| ----------------------- | ---------------- | ------------- | --------------- |
| `zendesk_ticket`        | Ticket           | List, create, update, delete | Count only |
| `zendesk_user`          | User             | List, create, update, delete | Count only |
| `zendesk_organization`  | Organization     | List, create, update, delete | Count only |

The datasource introspects Zendesk **custom fields** on startup (ticket, user, organization) and registers them as Forest columns.

## Installation

```bash
yarn add @forestadmin/datasource-zendesk
```

## Quick start

```ts
import { createAgent } from '@forestadmin/agent';
import {
  createZendeskClient,
  createZendeskDataSource,
  closeTicketPlugin,
  createTicketWithNotificationPlugin,
} from '@forestadmin/datasource-zendesk';

const zendeskClient = createZendeskClient({
  subdomain: process.env.ZENDESK_SUBDOMAIN!,
  email: process.env.ZENDESK_EMAIL!,
  apiToken: process.env.ZENDESK_API_TOKEN!,
});

const agent = createAgent({ /* ... */ })
  .addDataSource(createZendeskDataSource({ client: zendeskClient }))

  // Smart action on Zendesk tickets: Mark as solved / closed.
  .customizeCollection('zendesk_ticket', collection =>
    collection.use(closeTicketPlugin, {
      client: zendeskClient,
      ticketIdField: 'id',
    }),
  )

  // Smart action on ANY collection (here: customers): create a Zendesk ticket
  // and notify the requester by email.
  .customizeCollection('customers', collection =>
    collection.use(createTicketWithNotificationPlugin, {
      client: zendeskClient,
      requesterEmailDefault: record => String(record.email ?? ''),
      defaultSubject: 'Follow-up about your account',
      ticketIdField: 'last_zendesk_ticket_id',
    }),
  );
```

## Datasource

### `createZendeskDataSource(options)`

`options` accepts either an already-built `client` (recommended when also passing it to plugins) or raw credentials:

```ts
createZendeskDataSource({ client: createZendeskClient({ subdomain, email, apiToken }) });

// or
createZendeskDataSource({ subdomain, email, apiToken });
```

### Filter operators

Zendesk Search supports a restricted set of operators. The datasource exposes:

- `Equal`, `NotEqual`, `In`, `NotIn`, `Present`, `Blank` for strings, enums and booleans
- `Equal`, `NotEqual`, `In`, `NotIn`, `Present`, `Blank`, `GreaterThan`, `LessThan` for numbers
- `Equal`, `Before`, `After`, `Present`, `Blank` for dates

Unsupported operators (`Contains`, `Or` aggregator, …) raise `UnsupportedOperatorError`. The Zendesk Search API caps result pagination at 1000 records — large skips raise the same error.

### Custom fields

On boot, the datasource calls `GET /ticket_fields.json`, `/user_fields.json` and `/organization_fields.json`. Active fields are mapped to Forest columns:

| Zendesk type | Forest column |
| ------------ | ------------- |
| `text`, `textarea`, `regexp`, `partialcreditcard` | `String` |
| `integer`, `decimal`, `lookup` | `Number` |
| `date` | `Dateonly` |
| `checkbox` | `Boolean` |
| `dropdown`, `tagger` | `Enum` (or `String` if no options) |
| `multiselect` | `Json` |

Ticket custom fields are exposed as `custom_<id>`; user/organization ones use the Zendesk `key`.

## Plugins

### `closeTicketPlugin`

Adds Single + Bulk actions to mark Zendesk tickets as `solved` or `closed`. Tickets that Zendesk reports as already closed are folded into the success message rather than counted as failures.

```ts
collection.use(closeTicketPlugin, {
  client,
  ticketIdField: 'zendesk_id',
  // optional:
  statuses: ['solved'],            // default: ['solved', 'closed']
  scopes: ['Single'],              // default: ['Single', 'Bulk']
});
```

### `createTicketWithNotificationPlugin`

Adds a Single action that creates a Zendesk ticket. Useful on a customer-facing collection so an agent can reach out without leaving Forest. With `emailTemplates`, the form becomes two-page (template picker → body).

```ts
collection.use(createTicketWithNotificationPlugin, {
  client,
  actionName: 'Notify customer',                 // optional
  emailTemplates: [
    { title: 'Welcome', content: 'Hi {{ record.first_name }}, welcome aboard.' },
  ],
  requesterEmailDefault: record => String(record.email ?? ''),
  defaultSubject: 'Follow-up',
  priorityOverride: 'normal',                    // hides Priority from the form
  ticketIdField: 'last_zendesk_ticket_id',       // best-effort writeback after creation
  showInternalNote: true,                        // adds a "Send as internal note" toggle
});
```

Template interpolation supports `{{ record.field }}` (including dotted paths like `{{ record.org.name }}`).

## Errors

All exceptions raised by the datasource are subclasses of Forest Admin's `BusinessError` / `ValidationError`:

- `ZendeskConfigurationError` — missing/invalid client options
- `ZendeskApiError` — Zendesk HTTP failure (carries the operation, status code and response body)
- `UnsupportedOperatorError` — filter / aggregation that Zendesk cannot express
