export type CompositeId = Array<number | string>;

export type RecordData = { [field: string]: unknown };

export type RecordDataGenerator = AsyncGenerator<RecordData, void, undefined>;
