import * as render from './shared/render';

/** Invoices: the invoice itself, as a PDF. */
export default function customizeInvoices(collection) {
  collection.addField('file', {
    columnType: 'String',
    dependencies: render.INVOICE_DEPENDENCIES,
    getValues: records => records.map(render.invoiceUri),
  });
}
