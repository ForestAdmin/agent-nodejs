export default {
  address: {
    id: { columnType: 'Number', isPrimaryKey: true, type: 'Column' },
    zipCode: { columnType: 'String', type: 'Column' },
    address: { columnType: 'String', type: 'Column' },
    storeId: { columnType: 'Number', type: 'Column' },
  },
} as const;
