## @forestadmin/datasource-mongoose [1.7.14](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.13...@forestadmin/datasource-mongoose@1.7.14) (2024-09-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.5

## @forestadmin/datasource-mongoose [1.7.13](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.12...@forestadmin/datasource-mongoose@1.7.13) (2024-08-21)


### Performance Improvements

* improve mongodb collection page load time ([#1154](https://github.com/ForestAdmin/agent-nodejs/issues/1154)) ([33cc718](https://github.com/ForestAdmin/agent-nodejs/commit/33cc71861520ba9489fe7ad0bffc50b493715a7e))

## @forestadmin/datasource-mongoose [1.7.12](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.11...@forestadmin/datasource-mongoose@1.7.12) (2024-07-16)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.4

## @forestadmin/datasource-mongoose [1.7.11](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.10...@forestadmin/datasource-mongoose@1.7.11) (2024-07-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.3

## @forestadmin/datasource-mongoose [1.7.10](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.9...@forestadmin/datasource-mongoose@1.7.10) (2024-07-11)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.2

## @forestadmin/datasource-mongoose [1.7.9](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.8...@forestadmin/datasource-mongoose@1.7.9) (2024-07-09)


### Bug Fixes

* **documentDB:** prevent field addition from flattener to exceed 30 fields to meet with DocumentDB limitation ([#1140](https://github.com/ForestAdmin/agent-nodejs/issues/1140)) ([10d4e67](https://github.com/ForestAdmin/agent-nodejs/commit/10d4e67fbd049befab80ab89adb95a0001e569a8))

## @forestadmin/datasource-mongoose [1.7.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.7...@forestadmin/datasource-mongoose@1.7.8) (2024-07-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.1

## @forestadmin/datasource-mongoose [1.7.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.6...@forestadmin/datasource-mongoose@1.7.7) (2024-06-19)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.0

## @forestadmin/datasource-mongoose [1.7.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.5...@forestadmin/datasource-mongoose@1.7.6) (2024-04-26)


### Performance Improvements

* **mongoose:** speed up queries with relationships by filtering before retrieving relations ([#1116](https://github.com/ForestAdmin/agent-nodejs/issues/1116)) ([ff0bfc9](https://github.com/ForestAdmin/agent-nodejs/commit/ff0bfc99d3e8952851b3901fa63c86e1f0615ac1))

## @forestadmin/datasource-mongoose [1.7.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.4...@forestadmin/datasource-mongoose@1.7.5) (2024-04-24)


### Bug Fixes

* **mongoose:** error when applying auto flattening on deeply nested collections ([#1114](https://github.com/ForestAdmin/agent-nodejs/issues/1114)) ([426a6ae](https://github.com/ForestAdmin/agent-nodejs/commit/426a6aec84da3e9b4b25d5e951dece91fbe6806a))

## @forestadmin/datasource-mongoose [1.7.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.3...@forestadmin/datasource-mongoose@1.7.4) (2024-04-24)


### Bug Fixes

* **mongoose:** max call stack size error when using auto flattening with empty property names ([#1113](https://github.com/ForestAdmin/agent-nodejs/issues/1113)) ([ae096d1](https://github.com/ForestAdmin/agent-nodejs/commit/ae096d1c3dd4935fa5e22d80de3672159c64fbb5))

## @forestadmin/datasource-mongoose [1.7.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.2...@forestadmin/datasource-mongoose@1.7.3) (2024-04-16)


### Bug Fixes

* **mongoose:** error when flattening collections with a dot in their name ([#1109](https://github.com/ForestAdmin/agent-nodejs/issues/1109)) ([6b803ba](https://github.com/ForestAdmin/agent-nodejs/commit/6b803ba50253712b41505e474b7bd7fc8c5ba840))

## @forestadmin/datasource-mongoose [1.7.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.1...@forestadmin/datasource-mongoose@1.7.2) (2024-04-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.33.0

## @forestadmin/datasource-mongoose [1.7.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.7.0...@forestadmin/datasource-mongoose@1.7.1) (2024-04-10)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.3

# @forestadmin/datasource-mongoose [1.7.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.7...@forestadmin/datasource-mongoose@1.7.0) (2024-04-09)


### Features

* support mongodb cloud customizations ([#1097](https://github.com/ForestAdmin/agent-nodejs/issues/1097)) ([65ce409](https://github.com/ForestAdmin/agent-nodejs/commit/65ce409f1d107c62a42f483033ee1eae6536f7ca))

## @forestadmin/datasource-mongoose [1.6.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.6...@forestadmin/datasource-mongoose@1.6.7) (2024-03-25)


### Bug Fixes

* **mongo-datasource:** should return record with empty flattened record ([#1080](https://github.com/ForestAdmin/agent-nodejs/issues/1080)) ([420fbfc](https://github.com/ForestAdmin/agent-nodejs/commit/420fbfc245665c96bf5798211749a69f93ba777a))

## @forestadmin/datasource-mongoose [1.6.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.5...@forestadmin/datasource-mongoose@1.6.6) (2024-03-20)


### Bug Fixes

* mongoose relation flattened field not showing ([#1076](https://github.com/ForestAdmin/agent-nodejs/issues/1076)) ([0a64c00](https://github.com/ForestAdmin/agent-nodejs/commit/0a64c0047f63ed82d66846e85cbb69795ccf5b5b))

## @forestadmin/datasource-mongoose [1.6.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.4...@forestadmin/datasource-mongoose@1.6.5) (2024-03-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.2

## @forestadmin/datasource-mongoose [1.6.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.3...@forestadmin/datasource-mongoose@1.6.4) (2024-02-27)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.1

## @forestadmin/datasource-mongoose [1.6.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.2...@forestadmin/datasource-mongoose@1.6.3) (2024-02-06)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.0

## @forestadmin/datasource-mongoose [1.6.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.1...@forestadmin/datasource-mongoose@1.6.2) (2024-02-02)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.31.0

## @forestadmin/datasource-mongoose [1.6.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.6.0...@forestadmin/datasource-mongoose@1.6.1) (2024-02-01)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.30.1

# @forestadmin/datasource-mongoose [1.6.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.33...@forestadmin/datasource-mongoose@1.6.0) (2024-01-26)


### Features

* **datasource-customizer:** implement gmail-style search ([#780](https://github.com/ForestAdmin/agent-nodejs/issues/780)) ([3ad8ed8](https://github.com/ForestAdmin/agent-nodejs/commit/3ad8ed895c44ec17959e062dacf085691d42e528))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.30.0

## @forestadmin/datasource-mongoose [1.5.33](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.32...@forestadmin/datasource-mongoose@1.5.33) (2024-01-17)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.29.2

## @forestadmin/datasource-mongoose [1.5.32](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.31...@forestadmin/datasource-mongoose@1.5.32) (2023-12-15)


### Bug Fixes

* **mongoose:** export mongoose options type ([#900](https://github.com/ForestAdmin/agent-nodejs/issues/900)) ([f822279](https://github.com/ForestAdmin/agent-nodejs/commit/f8222799aeafa86415744f6e18b2b53de1b8b662))

## @forestadmin/datasource-mongoose [1.5.31](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.30...@forestadmin/datasource-mongoose@1.5.31) (2023-12-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.29.1

## @forestadmin/datasource-mongoose [1.5.30](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.29...@forestadmin/datasource-mongoose@1.5.30) (2023-10-31)


### Bug Fixes

* support mangoose decimal128 type ([#864](https://github.com/ForestAdmin/agent-nodejs/issues/864)) ([5bbed39](https://github.com/ForestAdmin/agent-nodejs/commit/5bbed39c05546ffcba8d4de2f7aef3844a4e1972))

## @forestadmin/datasource-mongoose [1.5.29](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.28...@forestadmin/datasource-mongoose@1.5.29) (2023-10-26)


### Bug Fixes

* **datasource-mongoose:** error on a nested field when requesting a child property on a missing value ([#860](https://github.com/ForestAdmin/agent-nodejs/issues/860)) ([6a04be7](https://github.com/ForestAdmin/agent-nodejs/commit/6a04be7bd525e5d4c73a95c019191a8c0ec3c0db))

## @forestadmin/datasource-mongoose [1.5.28](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.27...@forestadmin/datasource-mongoose@1.5.28) (2023-10-17)


### Bug Fixes

* **datasource-mongoose:** don't return records for null values of flattened fields when using asModel on object fields ([#853](https://github.com/ForestAdmin/agent-nodejs/issues/853)) ([d4b3f0c](https://github.com/ForestAdmin/agent-nodejs/commit/d4b3f0c9b671efc5df7ab9af6b939ba5a587862b))

## @forestadmin/datasource-mongoose [1.5.27](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.26...@forestadmin/datasource-mongoose@1.5.27) (2023-10-11)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.29.0

## @forestadmin/datasource-mongoose [1.5.26](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.25...@forestadmin/datasource-mongoose@1.5.26) (2023-10-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.28.1

## @forestadmin/datasource-mongoose [1.5.25](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.24...@forestadmin/datasource-mongoose@1.5.25) (2023-09-28)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.28.0

## @forestadmin/datasource-mongoose [1.5.24](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.23...@forestadmin/datasource-mongoose@1.5.24) (2023-09-26)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.27.0

## @forestadmin/datasource-mongoose [1.5.23](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.22...@forestadmin/datasource-mongoose@1.5.23) (2023-09-25)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.26.0

## @forestadmin/datasource-mongoose [1.5.22](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.21...@forestadmin/datasource-mongoose@1.5.22) (2023-09-25)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.25.0

## @forestadmin/datasource-mongoose [1.5.21](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.20...@forestadmin/datasource-mongoose@1.5.21) (2023-09-22)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.24.0

## @forestadmin/datasource-mongoose [1.5.20](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.19...@forestadmin/datasource-mongoose@1.5.20) (2023-09-21)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.23.0

## @forestadmin/datasource-mongoose [1.5.19](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.18...@forestadmin/datasource-mongoose@1.5.19) (2023-09-20)


### Bug Fixes

* deprecate timeonly custom field type and map it to time ([#827](https://github.com/ForestAdmin/agent-nodejs/issues/827)) ([0311f7d](https://github.com/ForestAdmin/agent-nodejs/commit/0311f7d8367abc4cd9aed7f73c8bbe09dc203821))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.22.1

## @forestadmin/datasource-mongoose [1.5.18](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.17...@forestadmin/datasource-mongoose@1.5.18) (2023-09-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.22.0

## @forestadmin/datasource-mongoose [1.5.17](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.16...@forestadmin/datasource-mongoose@1.5.17) (2023-09-13)


### Bug Fixes

* **datasource-mongoose:** fix errors when creating or retrieving records from collections created with asModel on an object field ([#821](https://github.com/ForestAdmin/agent-nodejs/issues/821)) ([d3858fe](https://github.com/ForestAdmin/agent-nodejs/commit/d3858fedbdde37c20811ff9505e9fd57d4c6b2c5))

## @forestadmin/datasource-mongoose [1.5.16](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.15...@forestadmin/datasource-mongoose@1.5.16) (2023-09-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.21.0

## @forestadmin/datasource-mongoose [1.5.15](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.14...@forestadmin/datasource-mongoose@1.5.15) (2023-09-12)


### Bug Fixes

* **datasource-mongoose:** return values instead of null when querying nested properties on a flattened field ([#820](https://github.com/ForestAdmin/agent-nodejs/issues/820)) ([1434c9f](https://github.com/ForestAdmin/agent-nodejs/commit/1434c9f53896a54b470a3a226e62865d80318ace))

## @forestadmin/datasource-mongoose [1.5.14](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.13...@forestadmin/datasource-mongoose@1.5.14) (2023-09-08)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.20.1

## @forestadmin/datasource-mongoose [1.5.13](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.12...@forestadmin/datasource-mongoose@1.5.13) (2023-09-07)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.20.0

## @forestadmin/datasource-mongoose [1.5.12](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.11...@forestadmin/datasource-mongoose@1.5.12) (2023-09-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.19.0

## @forestadmin/datasource-mongoose [1.5.11](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.10...@forestadmin/datasource-mongoose@1.5.11) (2023-09-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.18.0

## @forestadmin/datasource-mongoose [1.5.10](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.9...@forestadmin/datasource-mongoose@1.5.10) (2023-09-01)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.17.0

## @forestadmin/datasource-mongoose [1.5.9](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.8...@forestadmin/datasource-mongoose@1.5.9) (2023-08-31)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.16.0

## @forestadmin/datasource-mongoose [1.5.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.7...@forestadmin/datasource-mongoose@1.5.8) (2023-08-31)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.15.0

## @forestadmin/datasource-mongoose [1.5.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.6...@forestadmin/datasource-mongoose@1.5.7) (2023-08-31)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.14.0

## @forestadmin/datasource-mongoose [1.5.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.5...@forestadmin/datasource-mongoose@1.5.6) (2023-08-31)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.13.0

## @forestadmin/datasource-mongoose [1.5.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.4...@forestadmin/datasource-mongoose@1.5.5) (2023-08-30)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.12.1

## @forestadmin/datasource-mongoose [1.5.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.3...@forestadmin/datasource-mongoose@1.5.4) (2023-08-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.12.0

## @forestadmin/datasource-mongoose [1.5.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.2...@forestadmin/datasource-mongoose@1.5.3) (2023-08-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.11.0

## @forestadmin/datasource-mongoose [1.5.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.1...@forestadmin/datasource-mongoose@1.5.2) (2023-08-28)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.10.0

## @forestadmin/datasource-mongoose [1.5.2-alpha-widgets.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.1...@forestadmin/datasource-mongoose@1.5.2-alpha-widgets.1) (2023-08-23)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.10.0-alpha-widgets.1

## @forestadmin/datasource-mongoose [1.5.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.0...@forestadmin/datasource-mongoose@1.5.1) (2023-08-11)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.9.0

## @forestadmin/datasource-mongoose [1.5.1-alpha-widgets.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.1-alpha-widgets.1...@forestadmin/datasource-mongoose@1.5.1-alpha-widgets.2) (2023-08-23)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.9.0-alpha-widgets.2

## @forestadmin/datasource-mongoose [1.5.1-alpha-widgets.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.5.0...@forestadmin/datasource-mongoose@1.5.1-alpha-widgets.1) (2023-08-23)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.9.0-alpha-widgets.1

# @forestadmin/datasource-mongoose [1.5.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.4.5...@forestadmin/datasource-mongoose@1.5.0) (2023-07-27)


### Features

* **datasource-customizer:** expose native driver to customers ([#779](https://github.com/ForestAdmin/agent-nodejs/issues/779)) ([350b1c3](https://github.com/ForestAdmin/agent-nodejs/commit/350b1c3dc076ab2fdfb2fbba1532548624131b94))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.8.0

## @forestadmin/datasource-mongoose [1.4.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.4.4...@forestadmin/datasource-mongoose@1.4.5) (2023-07-26)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.7.0

## @forestadmin/datasource-mongoose [1.4.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.4.3...@forestadmin/datasource-mongoose@1.4.4) (2023-07-25)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.6.0

## @forestadmin/datasource-mongoose [1.4.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.4.2...@forestadmin/datasource-mongoose@1.4.3) (2023-07-20)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.5.2

## @forestadmin/datasource-mongoose [1.4.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.4.1...@forestadmin/datasource-mongoose@1.4.2) (2023-07-10)


### Bug Fixes

* **datasource-mongoose:** when combining asModels and asFields, collection.create returns invalid records for subcollections ([#763](https://github.com/ForestAdmin/agent-nodejs/issues/763)) ([dda1008](https://github.com/ForestAdmin/agent-nodejs/commit/dda1008dff0362c5784e325dfe55e021cfe390b0))

## @forestadmin/datasource-mongoose [1.4.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.4.0...@forestadmin/datasource-mongoose@1.4.1) (2023-06-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.5.1

# @forestadmin/datasource-mongoose [1.4.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.3.5...@forestadmin/datasource-mongoose@1.4.0) (2023-04-26)


### Features

* **datasource-customizer:** add support for binary fields ([#673](https://github.com/ForestAdmin/agent-nodejs/issues/673)) ([419727c](https://github.com/ForestAdmin/agent-nodejs/commit/419727cce812af10fa5917f1b94a2064d06883f7))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.5.0

## @forestadmin/datasource-mongoose [1.3.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.3.4...@forestadmin/datasource-mongoose@1.3.5) (2023-04-19)


### Bug Fixes

* **validation:** make frontend validation more reliable ([#655](https://github.com/ForestAdmin/agent-nodejs/issues/655)) ([75255b0](https://github.com/ForestAdmin/agent-nodejs/commit/75255b083edc422c5bd3582c069849728d595e98))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.3

## @forestadmin/datasource-mongoose [1.3.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.3.3...@forestadmin/datasource-mongoose@1.3.4) (2023-03-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.2

## @forestadmin/datasource-mongoose [1.3.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.3.2...@forestadmin/datasource-mongoose@1.3.3) (2023-03-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.1

## @forestadmin/datasource-mongoose [1.3.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.3.1...@forestadmin/datasource-mongoose@1.3.2) (2023-03-13)


### Bug Fixes

* **datasource-mongoose:** mongoose 7.0 should return the right type for _id ([#636](https://github.com/ForestAdmin/agent-nodejs/issues/636)) ([a043a15](https://github.com/ForestAdmin/agent-nodejs/commit/a043a156016c68e5a9e55174020704102555e691))

## @forestadmin/datasource-mongoose [1.3.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.3.0...@forestadmin/datasource-mongoose@1.3.1) (2023-02-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.0

# @forestadmin/datasource-mongoose [1.3.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.6...@forestadmin/datasource-mongoose@1.3.0) (2023-01-19)


### Features

* **mongoose:** implement field flattener on top of model splitter ([#593](https://github.com/ForestAdmin/agent-nodejs/issues/593)) ([d340b05](https://github.com/ForestAdmin/agent-nodejs/commit/d340b052235f40c77a07b89c3c47cf6e91d538e8))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.3.0

## @forestadmin/datasource-mongoose [1.2.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.5...@forestadmin/datasource-mongoose@1.2.6) (2023-01-16)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.2.2

## @forestadmin/datasource-mongoose [1.2.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.4...@forestadmin/datasource-mongoose@1.2.5) (2023-01-16)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.2.1

## @forestadmin/datasource-mongoose [1.2.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.3...@forestadmin/datasource-mongoose@1.2.4) (2022-12-22)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.2.0

## @forestadmin/datasource-mongoose [1.2.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.2...@forestadmin/datasource-mongoose@1.2.3) (2022-12-21)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.4

## @forestadmin/datasource-mongoose [1.2.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.1...@forestadmin/datasource-mongoose@1.2.2) (2022-12-20)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.3

## @forestadmin/datasource-mongoose [1.2.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.2.0...@forestadmin/datasource-mongoose@1.2.1) (2022-12-19)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.2

# @forestadmin/datasource-mongoose [1.2.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.1.3...@forestadmin/datasource-mongoose@1.2.0) (2022-12-09)


### Features

* **mongoose:** convert mongoose validation errors so that they show up on the frontend ([#567](https://github.com/ForestAdmin/agent-nodejs/issues/567)) ([a04e07d](https://github.com/ForestAdmin/agent-nodejs/commit/a04e07dcec493a7d56cb6823f35d3bcdf6652ed9))

## @forestadmin/datasource-mongoose [1.1.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.1.2...@forestadmin/datasource-mongoose@1.1.3) (2022-11-22)


### Bug Fixes

* **datasource mongoose:** replace _pid by parentId more understandable error ([#550](https://github.com/ForestAdmin/agent-nodejs/issues/550)) ([b4c1fe7](https://github.com/ForestAdmin/agent-nodejs/commit/b4c1fe7e347004ffe46de8841698578d3a4efb58))
* **datasource mongoose:** use updateOne when there are only one record to allow mongoose hook ([#547](https://github.com/ForestAdmin/agent-nodejs/issues/547)) ([837f727](https://github.com/ForestAdmin/agent-nodejs/commit/837f7279451caaffb736e9a0532acffcfd99e93f))

## @forestadmin/datasource-mongoose [1.1.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.1.1...@forestadmin/datasource-mongoose@1.1.2) (2022-11-07)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.1

## @forestadmin/datasource-mongoose [1.1.2-alpha.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.1.1...@forestadmin/datasource-mongoose@1.1.2-alpha.1) (2022-11-03)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.1-alpha.1

## @forestadmin/datasource-mongoose [1.1.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.1.0...@forestadmin/datasource-mongoose@1.1.1) (2022-10-27)


### Bug Fixes

* **mongoose:** when updating a field on flattened collections, all fields are overwritten ([#514](https://github.com/ForestAdmin/agent-nodejs/issues/514)) ([6204327](https://github.com/ForestAdmin/agent-nodejs/commit/620432747fb26c0f03784a88ac4a53d64f878df4))

# @forestadmin/datasource-mongoose [1.1.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.2...@forestadmin/datasource-mongoose@1.1.0) (2022-10-27)


### Features

* allow creating collection charts ([#506](https://github.com/ForestAdmin/agent-nodejs/issues/506)) ([e707757](https://github.com/ForestAdmin/agent-nodejs/commit/e707757376990888a1d037abf477537f513728ac))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.0

## @forestadmin/datasource-mongoose [1.0.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.1...@forestadmin/datasource-mongoose@1.0.2) (2022-10-25)


### Bug Fixes

* mongoose connector broken for all versions besides 6.6.3 ([#509](https://github.com/ForestAdmin/agent-nodejs/issues/509)) ([9cece2c](https://github.com/ForestAdmin/agent-nodejs/commit/9cece2c2adf5b7edfcad515e6c3c340faa757f79))

## @forestadmin/datasource-mongoose [1.0.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0...@forestadmin/datasource-mongoose@1.0.1) (2022-10-24)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.1

## @forestadmin/datasource-mongoose [1.0.1-alpha.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0...@forestadmin/datasource-mongoose@1.0.1-alpha.1) (2022-10-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.1-alpha.1

# @forestadmin/datasource-mongoose 1.0.0 (2022-10-07)


### Bug Fixes

* **mongoose:** options are not required when creating the connector ([#391](https://github.com/ForestAdmin/agent-nodejs/issues/391)) ([0cdd295](https://github.com/ForestAdmin/agent-nodejs/commit/0cdd295d8fce2f851622fd9537893c3b1b12a31e))
* **security:** upgrade mongoose to fix a vulnerability ([#469](https://github.com/ForestAdmin/agent-nodejs/issues/469)) ([74e16bb](https://github.com/ForestAdmin/agent-nodejs/commit/74e16bb019a72fbfaabbccc6b1d932989a4d04fa))


### Features

* add support for mongoose datasource ([#339](https://github.com/ForestAdmin/agent-nodejs/issues/339)) ([5515286](https://github.com/ForestAdmin/agent-nodejs/commit/55152862dceff4714bf9b36ed6c138acdf8cb9e3))
* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))
* **mongoose:** add schema generator ([#303](https://github.com/ForestAdmin/agent-nodejs/issues/303)) ([55fa26a](https://github.com/ForestAdmin/agent-nodejs/commit/55fa26a3d1c975c35bdab6a20655573ecaceb31e))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0

# @forestadmin/datasource-mongoose [1.0.0-beta.25](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.24...@forestadmin/datasource-mongoose@1.0.0-beta.25) (2022-10-06)


### Bug Fixes

* **security:** upgrade mongoose to fix a vulnerability ([#469](https://github.com/ForestAdmin/agent-nodejs/issues/469)) ([74e16bb](https://github.com/ForestAdmin/agent-nodejs/commit/74e16bb019a72fbfaabbccc6b1d932989a4d04fa))

# @forestadmin/datasource-mongoose [1.0.0-beta.24](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.23...@forestadmin/datasource-mongoose@1.0.0-beta.24) (2022-10-06)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.36

# @forestadmin/datasource-mongoose [1.0.0-alpha.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-alpha.2...@forestadmin/datasource-mongoose@1.0.0-alpha.3) (2022-10-06)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.3

# @forestadmin/datasource-mongoose [1.0.0-beta.23](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.22...@forestadmin/datasource-mongoose@1.0.0-beta.23) (2022-10-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.35

# @forestadmin/datasource-mongoose [1.0.0-alpha.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-alpha.1...@forestadmin/datasource-mongoose@1.0.0-alpha.2) (2022-09-28)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.2

# @forestadmin/datasource-mongoose 1.0.0-alpha.1 (2022-09-28)


### Bug Fixes

* **mongoose:** options are not required when creating the connector ([#391](https://github.com/ForestAdmin/agent-nodejs/issues/391)) ([0cdd295](https://github.com/ForestAdmin/agent-nodejs/commit/0cdd295d8fce2f851622fd9537893c3b1b12a31e))


### Features

* add support for mongoose datasource ([#339](https://github.com/ForestAdmin/agent-nodejs/issues/339)) ([5515286](https://github.com/ForestAdmin/agent-nodejs/commit/55152862dceff4714bf9b36ed6c138acdf8cb9e3))
* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))
* **mongoose:** add schema generator ([#303](https://github.com/ForestAdmin/agent-nodejs/issues/303)) ([55fa26a](https://github.com/ForestAdmin/agent-nodejs/commit/55fa26a3d1c975c35bdab6a20655573ecaceb31e))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.1

# @forestadmin/datasource-mongoose [1.0.0-beta.22](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.21...@forestadmin/datasource-mongoose@1.0.0-beta.22) (2022-09-22)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.34

# @forestadmin/datasource-mongoose [1.0.0-beta.21](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.20...@forestadmin/datasource-mongoose@1.0.0-beta.21) (2022-09-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.33

# @forestadmin/datasource-mongoose [1.0.0-beta.20](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.19...@forestadmin/datasource-mongoose@1.0.0-beta.20) (2022-09-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.32

# @forestadmin/datasource-mongoose [1.0.0-beta.19](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.18...@forestadmin/datasource-mongoose@1.0.0-beta.19) (2022-09-08)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.31

# @forestadmin/datasource-mongoose [1.0.0-beta.18](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.17...@forestadmin/datasource-mongoose@1.0.0-beta.18) (2022-09-07)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.30

# @forestadmin/datasource-mongoose [1.0.0-beta.17](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.16...@forestadmin/datasource-mongoose@1.0.0-beta.17) (2022-09-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.29

# @forestadmin/datasource-mongoose [1.0.0-beta.16](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.15...@forestadmin/datasource-mongoose@1.0.0-beta.16) (2022-09-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.28

# @forestadmin/datasource-mongoose [1.0.0-beta.15](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.14...@forestadmin/datasource-mongoose@1.0.0-beta.15) (2022-08-24)


### Bug Fixes

* **mongoose:** options are not required when creating the connector ([#391](https://github.com/ForestAdmin/agent-nodejs/issues/391)) ([0cdd295](https://github.com/ForestAdmin/agent-nodejs/commit/0cdd295d8fce2f851622fd9537893c3b1b12a31e))

# @forestadmin/datasource-mongoose [1.0.0-beta.14](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.13...@forestadmin/datasource-mongoose@1.0.0-beta.14) (2022-08-23)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.27

# @forestadmin/datasource-mongoose [1.0.0-beta.13](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.12...@forestadmin/datasource-mongoose@1.0.0-beta.13) (2022-06-16)


### Features

* add support for mongoose datasource ([#339](https://github.com/ForestAdmin/agent-nodejs/issues/339)) ([5515286](https://github.com/ForestAdmin/agent-nodejs/commit/55152862dceff4714bf9b36ed6c138acdf8cb9e3))

# @forestadmin/datasource-mongoose [1.0.0-beta.12](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.11...@forestadmin/datasource-mongoose@1.0.0-beta.12) (2022-06-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.26

# @forestadmin/datasource-mongoose [1.0.0-beta.11](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.10...@forestadmin/datasource-mongoose@1.0.0-beta.11) (2022-06-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.25

# @forestadmin/datasource-mongoose [1.0.0-beta.10](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.9...@forestadmin/datasource-mongoose@1.0.0-beta.10) (2022-06-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.24

# @forestadmin/datasource-mongoose [1.0.0-beta.9](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.8...@forestadmin/datasource-mongoose@1.0.0-beta.9) (2022-06-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.23

# @forestadmin/datasource-mongoose [1.0.0-beta.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.7...@forestadmin/datasource-mongoose@1.0.0-beta.8) (2022-06-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.22

# @forestadmin/datasource-mongoose [1.0.0-beta.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.6...@forestadmin/datasource-mongoose@1.0.0-beta.7) (2022-06-01)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.21

# @forestadmin/datasource-mongoose [1.0.0-beta.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.5...@forestadmin/datasource-mongoose@1.0.0-beta.6) (2022-05-31)


### Features

* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.20

# @forestadmin/datasource-mongoose [1.0.0-beta.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.4...@forestadmin/datasource-mongoose@1.0.0-beta.5) (2022-05-25)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.19

# @forestadmin/datasource-mongoose [1.0.0-beta.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.3...@forestadmin/datasource-mongoose@1.0.0-beta.4) (2022-05-24)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.18

# @forestadmin/datasource-mongoose [1.0.0-beta.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.2...@forestadmin/datasource-mongoose@1.0.0-beta.3) (2022-05-24)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.17

# @forestadmin/datasource-mongoose [1.0.0-beta.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-mongoose@1.0.0-beta.1...@forestadmin/datasource-mongoose@1.0.0-beta.2) (2022-05-23)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.17

# @forestadmin/datasource-mongoose 1.0.0-beta.1 (2022-05-17)


### Features

* **mongoose:** add schema generator ([#303](https://github.com/ForestAdmin/agent-nodejs/issues/303)) ([55fa26a](https://github.com/ForestAdmin/agent-nodejs/commit/55fa26a3d1c975c35bdab6a20655573ecaceb31e))
