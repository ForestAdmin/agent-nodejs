Implementing a connector using the "local cache" strategy is much quicker than using the "query translation" strategy:

- Forest Admin will take care of implementing all read operations (no need to translate queries)
- Your connectors natively supports all query operations (no need to declare capabilities)

This strategy is a good match for APIs and SaaS which often have a limited querying capability.
