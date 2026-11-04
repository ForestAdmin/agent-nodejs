const render = require('./shared/render');

/** Invoices: the invoice itself, as a PDF. */
function customizeInvoices(collection) {
  collection.addField('file', {
    columnType: 'String',
    dependencies: render.INVOICE_DEPENDENCIES,
    getValues: records => records.map(render.invoiceUri),
  });
}

module.exports = customizeInvoices;
