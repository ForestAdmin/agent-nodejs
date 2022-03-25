- Coding a translation layer
  - Implement a method which, given a forest admin filter and projection retrieve the records
  - Implement a method which, given a forest admin filter and aggregation query, compute the aggregated values
  - When relevant, implement methods for record creation, update and delete.

# Tooling

In order to make your journey easier, a `npm` package which contains tooling is provided: [npmjs://@forestadmin/connector-toolkit](https://www.npmjs.com/package/@forestadmin/connector-toolkit)

It contains:

- All interfaces that you'll be either using or implementing while making your connector
- An implementation of a caching connector, which implements all forest admin features.
- Aggregation, filtering, projection and sorting emulators which can be called from inside your collection
  - This is a perfect match during development
  - It allows to be up and running with all features in minutes (with low performance)
  - You can then translate forest admin concepts one by one, and improve performance gradually
- Decorators which can be loaded on top of your collections to add new behaviors
  - This is a good match to implement features which are not natively supported by the target
  - It allows to bundle reusable behaviors in your connector, that would otherwise need to be added on the configuration of agents by using `customizeCollection`.

Take note that all connectors which are provided by Forest Admin were actually coded using this same toolkit, so you'll be using the same tools as we are.
