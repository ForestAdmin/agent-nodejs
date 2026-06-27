# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/plugin-aws-s3` is a Forest Admin plugin (`createFileField`) that turns an existing `String` column — which stores an S3 object key — into a file-picker field on a collection. It plugs into the customization layer (`@forestadmin/datasource-customizer`) and uses the AWS SDK v3 to upload/download/delete objects.

## Architecture

The single public entry point is `createFileField(dataSource, collection, options)` in `src/index.ts`. It validates that `options.fieldname` is an existing `String` column, builds a `Configuration` object (with defaults: `readMode: 'url'`, `acl: 'private'`, `storeAt: <collection>/<id>/<name>`), instantiates the S3 `Client`, then applies a pipeline of field decorators from `src/field/`. Understanding the package means understanding this two-field swap:

- The original column is `sourcename` (e.g. `avatar`). It holds the raw **S3 object key** string in the database.
- A computed companion field `filename` (`<sourcename>__file`) is added (`create-field.ts`) that exposes the file to the frontend. On read it resolves the key to a signed URL (`getSignedUrl`, 5-min expiry), a public URL (when `acl` is `public-*`), or — when `readMode: 'proxy'` — streams the object through the agent and encodes it as a base64 data URI.
- The remaining decorators forward writing/sorting/filtering/required-ness from `filename` onto `sourcename`, then `replace-field.ts` **removes `sourcename` and renames `filename` to `sourcename`** so end users only ever see one field with the original name. This rename-last ordering is load-bearing.

Write flow (`make-field-writable.ts`): the frontend sends a data URI; `parseDataUri` (`utils/data-uri.ts`) decodes it into a `File` (`{ name, buffer, mimeType, charset? }`); `storeAt` computes the DB value; the object is uploaded via `Client.save`. On `update`, the existing record is re-fetched from the DB to recover PKs and `objectKeyFromRecord` dependencies. `objectKeyFromRecord` lets the actual S3 key diverge from the stored DB value.

`utils/s3.ts` wraps the AWS SDK v3 (`S3Client` + `s3-request-presigner`). All AWS config falls back to env vars (`AWS_S3_BUCKET`, `AWS_DEFAULT_REGION`, `AWS_S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

## Commands

```bash
yarn workspace @forestadmin/plugin-aws-s3 build   # tsc
yarn workspace @forestadmin/plugin-aws-s3 lint
yarn workspace @forestadmin/plugin-aws-s3 test
# single test:
yarn workspace @forestadmin/plugin-aws-s3 test -- -t "name of test"
```

## Gotchas

- File deletion (`make-field-deleteable.ts`) only runs when `deleteFiles: true`, and is wired through `Before`/`Update` + `Before`/`Delete` collection hooks — not through the write replacement.
- `data-uri.ts` parses URIs by stripping the first 5 chars (`data:`) and splitting on `,`/`;`; it does not tolerate malformed input gracefully. The `charset` and other `key=value` media-type params survive the encode/decode round-trip.
- `make-field-filterable.ts` carries a `@fixme` about operator forwarding — be careful if touching filter behavior.
- `types.ts` imports from deep `@forestadmin/datasource-customizer/dist/...` paths for context types; keep those in sync when bumping that sibling dependency.
- `index.ts`'s `createFileField` is loosely typed at the `dataSource`/`collection` params (no explicit types) despite the generic `Options<S, N>` signature.
