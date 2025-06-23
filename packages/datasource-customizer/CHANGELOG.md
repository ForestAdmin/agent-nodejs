## @forestadmin/datasource-customizer [1.67.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.67.0...@forestadmin/datasource-customizer@1.67.1) (2025-06-23)


### Bug Fixes

* **datasource customizer:** fix nullable customization to avoid crash with no code customization ([#1314](https://github.com/ForestAdmin/agent-nodejs/issues/1314)) ([030984f](https://github.com/ForestAdmin/agent-nodejs/commit/030984f6a088df9c29377c17366ff5a868da4ef9))

# @forestadmin/datasource-customizer [1.67.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.66.0...@forestadmin/datasource-customizer@1.67.0) (2025-06-18)


### Features

* **customizer:** customers can now mark a field as optional ([#1286](https://github.com/ForestAdmin/agent-nodejs/issues/1286)) ([4205252](https://github.com/ForestAdmin/agent-nodejs/commit/4205252354bfa24c95ce6da55df8ff1cfb856c7a))

# @forestadmin/datasource-customizer [1.66.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.65.1...@forestadmin/datasource-customizer@1.66.0) (2025-05-06)


### Bug Fixes

* **agent:** backup and restore stack properly when reload ([#1289](https://github.com/ForestAdmin/agent-nodejs/issues/1289)) ([7120857](https://github.com/ForestAdmin/agent-nodejs/commit/7120857ccbb4db0dd27d3c0a0e31f6184a4275d3))


### Features

* show a warning in case a mongoose relationship is omitted ([#1290](https://github.com/ForestAdmin/agent-nodejs/issues/1290)) ([93ed397](https://github.com/ForestAdmin/agent-nodejs/commit/93ed397e1601f2cf921a177897c90ad06bddb246))

## @forestadmin/datasource-customizer [1.65.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.65.0...@forestadmin/datasource-customizer@1.65.1) (2025-04-16)


### Bug Fixes

* **lazy join:** avoid crash when there is no filter to refine ([#1288](https://github.com/ForestAdmin/agent-nodejs/issues/1288)) ([52e0855](https://github.com/ForestAdmin/agent-nodejs/commit/52e085517e4094f93e59a7a08e021ed0d0a55f36))

# @forestadmin/datasource-customizer [1.65.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.64.0...@forestadmin/datasource-customizer@1.65.0) (2025-04-15)


### Features

* allow reload agent on datasource ([#1285](https://github.com/ForestAdmin/agent-nodejs/issues/1285)) ([667aa60](https://github.com/ForestAdmin/agent-nodejs/commit/667aa60b2bf1e2d338c0dad5343d81df82b62b8a))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.50.0

# @forestadmin/datasource-customizer [1.64.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.63.1...@forestadmin/datasource-customizer@1.64.0) (2025-03-26)


### Features

* allow reload agent ([#1276](https://github.com/ForestAdmin/agent-nodejs/issues/1276)) ([43cf128](https://github.com/ForestAdmin/agent-nodejs/commit/43cf128bf95672317f40e0b26865f513d72edf4d))

## @forestadmin/datasource-customizer [1.63.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.63.0...@forestadmin/datasource-customizer@1.63.1) (2025-03-11)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.49.1

# @forestadmin/datasource-customizer [1.63.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.62.0...@forestadmin/datasource-customizer@1.63.0) (2025-02-21)


### Features

* **chart:** allow date aggregation on quarter ([#1257](https://github.com/ForestAdmin/agent-nodejs/issues/1257)) ([67cbacd](https://github.com/ForestAdmin/agent-nodejs/commit/67cbacdfaac44623119d9636c44017c4a8f6c984))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.49.0

# @forestadmin/datasource-customizer [1.62.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.61.3...@forestadmin/datasource-customizer@1.62.0) (2025-02-14)


### Features

* throw a better error when no record is found for running action on ([#1249](https://github.com/ForestAdmin/agent-nodejs/issues/1249)) ([80e7c20](https://github.com/ForestAdmin/agent-nodejs/commit/80e7c20e877607ff62217a8de922dbb77a023b72))

## @forestadmin/datasource-customizer [1.61.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.61.2...@forestadmin/datasource-customizer@1.61.3) (2025-02-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.48.0

## @forestadmin/datasource-customizer [1.61.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.61.1...@forestadmin/datasource-customizer@1.61.2) (2025-01-28)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.47.1

## @forestadmin/datasource-customizer [1.61.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.61.0...@forestadmin/datasource-customizer@1.61.1) (2025-01-24)


### Bug Fixes

* **lazy join:** do not remove foreignkey when they are asking ([#1246](https://github.com/ForestAdmin/agent-nodejs/issues/1246)) ([621b243](https://github.com/ForestAdmin/agent-nodejs/commit/621b2434900f565e37fbd982dae6e82664797c37))

# @forestadmin/datasource-customizer [1.61.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.60.0...@forestadmin/datasource-customizer@1.61.0) (2025-01-23)


### Features

* add lazy join decorator ([#1240](https://github.com/ForestAdmin/agent-nodejs/issues/1240)) ([1b6b248](https://github.com/ForestAdmin/agent-nodejs/commit/1b6b248321944b67a71e1ce4f42ee0d3932ebd69))

# @forestadmin/datasource-customizer [1.60.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.59.0...@forestadmin/datasource-customizer@1.60.0) (2025-01-22)


### Features

* upgrade uuid package to handle uuid v7 ([#1243](https://github.com/ForestAdmin/agent-nodejs/issues/1243)) ([ebf9515](https://github.com/ForestAdmin/agent-nodejs/commit/ebf951561d49565e49fb6a5bfbb84209ded04c25))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.47.0

# @forestadmin/datasource-customizer [1.59.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.58.0...@forestadmin/datasource-customizer@1.59.0) (2025-01-13)


### Features

* allow disable search on collection ([#1236](https://github.com/ForestAdmin/agent-nodejs/issues/1236)) ([c9e5e67](https://github.com/ForestAdmin/agent-nodejs/commit/c9e5e677b08b326674fb40112ae541339f75cb8c))

# @forestadmin/datasource-customizer [1.58.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.57.1...@forestadmin/datasource-customizer@1.58.0) (2025-01-02)


### Features

* **segment:** support templating for segment live query ([#1235](https://github.com/ForestAdmin/agent-nodejs/issues/1235)) ([5452a95](https://github.com/ForestAdmin/agent-nodejs/commit/5452a95cc7c9340b81b30e91231b2b9ec5aa29b4))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.46.0

## @forestadmin/datasource-customizer [1.57.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.57.0...@forestadmin/datasource-customizer@1.57.1) (2024-12-18)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.45.1

# @forestadmin/datasource-customizer [1.57.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.56.0...@forestadmin/datasource-customizer@1.57.0) (2024-12-18)


### Features

* **native-query:** execute chart query requests ([#1225](https://github.com/ForestAdmin/agent-nodejs/issues/1225)) ([84b26dd](https://github.com/ForestAdmin/agent-nodejs/commit/84b26dd0fe58018482d530d2b60e2961dd9ec2f8))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.45.0

# @forestadmin/datasource-customizer [1.56.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.55.5...@forestadmin/datasource-customizer@1.56.0) (2024-11-27)


### Features

* **capabilities:** define native query connection capabilities ([#1220](https://github.com/ForestAdmin/agent-nodejs/issues/1220)) ([bd0fc7c](https://github.com/ForestAdmin/agent-nodejs/commit/bd0fc7cce7f9d6dec79f1e62bdd3e13c7b4f72e4))


### Reverts

*  "chore(capabilities): define native query connection capabilities ([#1219](https://github.com/ForestAdmin/agent-nodejs/issues/1219))" ([290cde3](https://github.com/ForestAdmin/agent-nodejs/commit/290cde383ab72c11050e27beba7214cf9802e5e0))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.44.0

## @forestadmin/datasource-customizer [1.55.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.55.4...@forestadmin/datasource-customizer@1.55.5) (2024-11-27)


### Bug Fixes

* **rename decorator:** properly map relation when renaming pk field ([#1217](https://github.com/ForestAdmin/agent-nodejs/issues/1217)) ([2de746f](https://github.com/ForestAdmin/agent-nodejs/commit/2de746f7325310d6138550cd75660cc1955c6114))

## @forestadmin/datasource-customizer [1.55.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.55.3...@forestadmin/datasource-customizer@1.55.4) (2024-11-05)


### Bug Fixes

* ignore inconsistent foreign key types ([#1202](https://github.com/ForestAdmin/agent-nodejs/issues/1202)) ([b5e8c6a](https://github.com/ForestAdmin/agent-nodejs/commit/b5e8c6a8dc784c819efd40fd1e9d6f03c2929c84))

## @forestadmin/datasource-customizer [1.55.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.55.2...@forestadmin/datasource-customizer@1.55.3) (2024-10-30)


### Bug Fixes

* change error message when mixing pages and other elements in an action form ([#1201](https://github.com/ForestAdmin/agent-nodejs/issues/1201)) ([c06e8f7](https://github.com/ForestAdmin/agent-nodejs/commit/c06e8f7a04b862341f22b8bd158540e56728231f))

## @forestadmin/datasource-customizer [1.55.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.55.1...@forestadmin/datasource-customizer@1.55.2) (2024-10-18)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.43.0

## @forestadmin/datasource-customizer [1.55.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.55.0...@forestadmin/datasource-customizer@1.55.1) (2024-10-10)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.42.1

# @forestadmin/datasource-customizer [1.55.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.54.1...@forestadmin/datasource-customizer@1.55.0) (2024-10-07)


### Features

* support static action forms with layout ([#1182](https://github.com/ForestAdmin/agent-nodejs/issues/1182)) ([92011d8](https://github.com/ForestAdmin/agent-nodejs/commit/92011d86b4e10dacf5783725cd864a31c7ce8fe5))

## @forestadmin/datasource-customizer [1.54.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.54.0...@forestadmin/datasource-customizer@1.54.1) (2024-10-07)


### Bug Fixes

* search hook with layout ([#1187](https://github.com/ForestAdmin/agent-nodejs/issues/1187)) ([e75a06e](https://github.com/ForestAdmin/agent-nodejs/commit/e75a06ed221696d90036f5585b5eb8c7849642fd))

# @forestadmin/datasource-customizer [1.54.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.53.0...@forestadmin/datasource-customizer@1.54.0) (2024-10-07)


### Features

* add pages in action forms ([#1179](https://github.com/ForestAdmin/agent-nodejs/issues/1179)) ([0b2dc0a](https://github.com/ForestAdmin/agent-nodejs/commit/0b2dc0a0d20b0f762aeb9eb6674693e05fd386c2))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.42.0

# @forestadmin/datasource-customizer [1.53.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.52.1...@forestadmin/datasource-customizer@1.53.0) (2024-10-04)


### Features

* **schema:** send a clear message when user wants to access to an unknown field ([#1186](https://github.com/ForestAdmin/agent-nodejs/issues/1186)) ([016aedd](https://github.com/ForestAdmin/agent-nodejs/commit/016aedd2e42c9424a531bea1370bc901126d535a))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.41.0

## @forestadmin/datasource-customizer [1.52.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.52.0...@forestadmin/datasource-customizer@1.52.1) (2024-09-27)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.40.0

# @forestadmin/datasource-customizer [1.52.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.51.0...@forestadmin/datasource-customizer@1.52.0) (2024-09-25)


### Features

* add action description and submit label button ([#1178](https://github.com/ForestAdmin/agent-nodejs/issues/1178)) ([8257a91](https://github.com/ForestAdmin/agent-nodejs/commit/8257a9156c9f2914fda43116ab3b05d6c1957623))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.39.0

# @forestadmin/datasource-customizer [1.51.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.50.0...@forestadmin/datasource-customizer@1.51.0) (2024-09-23)


### Features

* add optional id in action form fields ([#1174](https://github.com/ForestAdmin/agent-nodejs/issues/1174)) ([f2db803](https://github.com/ForestAdmin/agent-nodejs/commit/f2db803cba2e29d1b92845c376874560783221da))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.38.0

# @forestadmin/datasource-customizer [1.50.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.49.0...@forestadmin/datasource-customizer@1.50.0) (2024-09-18)


### Features

* add row in action forms ([#1173](https://github.com/ForestAdmin/agent-nodejs/issues/1173)) ([8770699](https://github.com/ForestAdmin/agent-nodejs/commit/87706996293e286846fdf5c7ae06e10f88e96176))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.37.0

# @forestadmin/datasource-customizer [1.49.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.48.0...@forestadmin/datasource-customizer@1.49.0) (2024-09-17)


### Features

* add html block in action forms ([#1172](https://github.com/ForestAdmin/agent-nodejs/issues/1172)) ([4c67ccd](https://github.com/ForestAdmin/agent-nodejs/commit/4c67ccd71f5a818fc8891366f44f84d5208e15dc))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.36.0

# @forestadmin/datasource-customizer [1.48.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.47.2...@forestadmin/datasource-customizer@1.48.0) (2024-09-17)


### Features

* add separator in action forms ([#1167](https://github.com/ForestAdmin/agent-nodejs/issues/1167)) ([7d61527](https://github.com/ForestAdmin/agent-nodejs/commit/7d615278b3897a8fbc60c5c6eaf6bb6cc53f7cef))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.35.0

## @forestadmin/datasource-customizer [1.47.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.47.1...@forestadmin/datasource-customizer@1.47.2) (2024-09-16)


### Performance Improvements

* **relation:** improve has many relation by using not in when possible and available ([#1148](https://github.com/ForestAdmin/agent-nodejs/issues/1148)) ([a15eefe](https://github.com/ForestAdmin/agent-nodejs/commit/a15eefe1b91e3842a76c095bda8e441d1976b91a))

## @forestadmin/datasource-customizer [1.47.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.47.0...@forestadmin/datasource-customizer@1.47.1) (2024-09-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.5

# @forestadmin/datasource-customizer [1.47.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.46.1...@forestadmin/datasource-customizer@1.47.0) (2024-08-23)


### Features

* make throw error function available in all customization context ([#1160](https://github.com/ForestAdmin/agent-nodejs/issues/1160)) ([f45f442](https://github.com/ForestAdmin/agent-nodejs/commit/f45f442391aa501f327ea91705212c679a955402))

## @forestadmin/datasource-customizer [1.46.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.46.0...@forestadmin/datasource-customizer@1.46.1) (2024-08-05)


### Bug Fixes

* update outdated links in jsdoc ([#1149](https://github.com/ForestAdmin/agent-nodejs/issues/1149)) ([81cd9d4](https://github.com/ForestAdmin/agent-nodejs/commit/81cd9d447cb4a6059a20706ffa22b140bcf1f5d7))

# @forestadmin/datasource-customizer [1.46.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.6...@forestadmin/datasource-customizer@1.46.0) (2024-08-05)


### Features

* **action:** allow dynamic form ([#915](https://github.com/ForestAdmin/agent-nodejs/issues/915)) ([5327460](https://github.com/ForestAdmin/agent-nodejs/commit/5327460b765ad3dcf7c6eb2ce0500ee74365d6da))

## @forestadmin/datasource-customizer [1.45.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.5...@forestadmin/datasource-customizer@1.45.6) (2024-07-16)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.4

## @forestadmin/datasource-customizer [1.45.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.4...@forestadmin/datasource-customizer@1.45.5) (2024-07-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.3

## @forestadmin/datasource-customizer [1.45.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.3...@forestadmin/datasource-customizer@1.45.4) (2024-07-11)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.2

## @forestadmin/datasource-customizer [1.45.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.2...@forestadmin/datasource-customizer@1.45.3) (2024-07-10)


### Bug Fixes

* **override-create:** clean returned records by removing unknown fields ([#1141](https://github.com/ForestAdmin/agent-nodejs/issues/1141)) ([b05f5c5](https://github.com/ForestAdmin/agent-nodejs/commit/b05f5c513913e30b9b280fc33eb6dbeda7d69763))

## @forestadmin/datasource-customizer [1.45.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.1...@forestadmin/datasource-customizer@1.45.2) (2024-07-09)


### Bug Fixes

* **customizer-stack:** reduce customizer stack to avoid issues ([#1139](https://github.com/ForestAdmin/agent-nodejs/issues/1139)) ([b13965f](https://github.com/ForestAdmin/agent-nodejs/commit/b13965ff18fc1070df60de07e9a5235ce6f546a4))

## @forestadmin/datasource-customizer [1.45.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.45.0...@forestadmin/datasource-customizer@1.45.1) (2024-07-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.1

# @forestadmin/datasource-customizer [1.45.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.44.3...@forestadmin/datasource-customizer@1.45.0) (2024-06-19)


### Features

* don't throw an error when adding a customization on a missing collection or field if catchMissingSchemaElementErrors is true ([#1128](https://github.com/ForestAdmin/agent-nodejs/issues/1128)) ([249589c](https://github.com/ForestAdmin/agent-nodejs/commit/249589cab78326a26149e5e354a9a8ea220d203d))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.34.0

## @forestadmin/datasource-customizer [1.44.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.44.2...@forestadmin/datasource-customizer@1.44.3) (2024-04-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.33.0

## @forestadmin/datasource-customizer [1.44.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.44.1...@forestadmin/datasource-customizer@1.44.2) (2024-04-10)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.3

## @forestadmin/datasource-customizer [1.44.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.44.0...@forestadmin/datasource-customizer@1.44.1) (2024-04-08)


### Bug Fixes

* **datasource-customizer:** correct confusing type when using addExternalRelation ([#1099](https://github.com/ForestAdmin/agent-nodejs/issues/1099)) ([34e27ab](https://github.com/ForestAdmin/agent-nodejs/commit/34e27ab4ef827a4c79ac11e078dca0d47a03145f))

# @forestadmin/datasource-customizer [1.44.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.6...@forestadmin/datasource-customizer@1.44.0) (2024-04-05)


### Features

* **datasource-customizer:** add override decorator ([#814](https://github.com/ForestAdmin/agent-nodejs/issues/814)) ([21ffef7](https://github.com/ForestAdmin/agent-nodejs/commit/21ffef7381151250abebbcea0db58afce302baa7))

## @forestadmin/datasource-customizer [1.43.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.5...@forestadmin/datasource-customizer@1.43.6) (2024-03-14)


### Bug Fixes

* addField is marked as deprecated by webstorm ([#1067](https://github.com/ForestAdmin/agent-nodejs/issues/1067)) ([735d20b](https://github.com/ForestAdmin/agent-nodejs/commit/735d20b82dc50541ffa9081792e3602264f426ae))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.2

## @forestadmin/datasource-customizer [1.43.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.4...@forestadmin/datasource-customizer@1.43.5) (2024-03-12)


### Bug Fixes

* addField dependencies are mandatory ([#1066](https://github.com/ForestAdmin/agent-nodejs/issues/1066)) ([92d38a1](https://github.com/ForestAdmin/agent-nodejs/commit/92d38a1f883a6726c4f2d46761ecd1f5c9ac6717))

## @forestadmin/datasource-customizer [1.43.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.3...@forestadmin/datasource-customizer@1.43.4) (2024-03-11)


### Performance Improvements

* **computed:** avoid calling computed handler when there is nothing to compute ([#1054](https://github.com/ForestAdmin/agent-nodejs/issues/1054)) ([1a32df8](https://github.com/ForestAdmin/agent-nodejs/commit/1a32df84988002dea90a747eaf8f1bc8d4be4d3c))

## @forestadmin/datasource-customizer [1.43.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.2...@forestadmin/datasource-customizer@1.43.3) (2024-02-28)


### Bug Fixes

* **agent:** action default success message is now handled by the frontend ([#1040](https://github.com/ForestAdmin/agent-nodejs/issues/1040)) ([42cd54b](https://github.com/ForestAdmin/agent-nodejs/commit/42cd54be194d196a3defd962c36ffe910222110f))

## @forestadmin/datasource-customizer [1.43.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.1...@forestadmin/datasource-customizer@1.43.2) (2024-02-27)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.1

## @forestadmin/datasource-customizer [1.43.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.43.0...@forestadmin/datasource-customizer@1.43.1) (2024-02-07)


### Bug Fixes

* **types:** allow to use relationships in generateSearchFilter ([#985](https://github.com/ForestAdmin/agent-nodejs/issues/985)) ([3219b6c](https://github.com/ForestAdmin/agent-nodejs/commit/3219b6cb1641120be002255ee49f6cb00184c47c))

# @forestadmin/datasource-customizer [1.43.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.42.0...@forestadmin/datasource-customizer@1.43.0) (2024-02-06)


### Features

* add access to the default search in replaceSearch on a collection ([#966](https://github.com/ForestAdmin/agent-nodejs/issues/966)) ([8e3c0ce](https://github.com/ForestAdmin/agent-nodejs/commit/8e3c0cef623ee6e1fc683e7d9728dd0a979774d5))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.32.0

# @forestadmin/datasource-customizer [1.42.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.41.1...@forestadmin/datasource-customizer@1.42.0) (2024-02-02)


### Features

* **action result builder:** allow user to set SA response headers ([#945](https://github.com/ForestAdmin/agent-nodejs/issues/945)) ([ce37c01](https://github.com/ForestAdmin/agent-nodejs/commit/ce37c01df1e92628788c0bb3dc0eb8d6409b7aef))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.31.0

## @forestadmin/datasource-customizer [1.41.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.41.0...@forestadmin/datasource-customizer@1.41.1) (2024-02-01)


### Bug Fixes

* **typings:** support strict null checking in typescript ([#927](https://github.com/ForestAdmin/agent-nodejs/issues/927)) ([80fa64d](https://github.com/ForestAdmin/agent-nodejs/commit/80fa64d0bf85ee36ab330a8f983b8bf593ae34f1))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.30.1

# @forestadmin/datasource-customizer [1.41.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.40.4...@forestadmin/datasource-customizer@1.41.0) (2024-01-26)


### Features

* **datasource-customizer:** implement gmail-style search ([#780](https://github.com/ForestAdmin/agent-nodejs/issues/780)) ([3ad8ed8](https://github.com/ForestAdmin/agent-nodejs/commit/3ad8ed895c44ec17959e062dacf085691d42e528))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.30.0

## @forestadmin/datasource-customizer [1.40.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.40.3...@forestadmin/datasource-customizer@1.40.4) (2024-01-22)


### Bug Fixes

* **replaceFieldWriting:** force customer to give a replaceFieldWriting definition to avoid emulation when null is given ([#913](https://github.com/ForestAdmin/agent-nodejs/issues/913)) ([b0b1862](https://github.com/ForestAdmin/agent-nodejs/commit/b0b1862dfba148acf61b0463f246dbc19a4b5afd))

## @forestadmin/datasource-customizer [1.40.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.40.2...@forestadmin/datasource-customizer@1.40.3) (2024-01-22)


### Bug Fixes

* disableFieldSorting is now only preventing frontend to sort the collection ([7f1481b](https://github.com/ForestAdmin/agent-nodejs/commit/7f1481bd56fc98da87fa4aa473cb7b806851c551))

## @forestadmin/datasource-customizer [1.40.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.40.1...@forestadmin/datasource-customizer@1.40.2) (2024-01-18)


### Bug Fixes

* **replaceFieldOperator:** disallow to pass null because it will emulate instead to remove the operator ([#911](https://github.com/ForestAdmin/agent-nodejs/issues/911)) ([bf0c105](https://github.com/ForestAdmin/agent-nodejs/commit/bf0c105cfb5850ede7be223bfbe59044ff6fe9cb))

## @forestadmin/datasource-customizer [1.40.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.40.0...@forestadmin/datasource-customizer@1.40.1) (2024-01-17)


### Bug Fixes

* allow to use skip lib check = false in tsconfig ([#909](https://github.com/ForestAdmin/agent-nodejs/issues/909)) ([da69776](https://github.com/ForestAdmin/agent-nodejs/commit/da697766745983bfb334488ca946ff8f69281e63))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.29.2

# @forestadmin/datasource-customizer [1.40.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.39.3...@forestadmin/datasource-customizer@1.40.0) (2024-01-03)


### Features

* **customizer:** allow users to disable sort properly on column ([#904](https://github.com/ForestAdmin/agent-nodejs/issues/904)) ([2dfaeac](https://github.com/ForestAdmin/agent-nodejs/commit/2dfaeac0aa84f6372f717b4fc4118ba187ecb08c))

## @forestadmin/datasource-customizer [1.39.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.39.2...@forestadmin/datasource-customizer@1.39.3) (2023-12-21)


### Bug Fixes

* cloud sync error with customization applied to missing collections ([#901](https://github.com/ForestAdmin/agent-nodejs/issues/901)) ([60e8d1c](https://github.com/ForestAdmin/agent-nodejs/commit/60e8d1c55017d47f7ab296da4f88490328a6ce13))

## @forestadmin/datasource-customizer [1.39.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.39.1...@forestadmin/datasource-customizer@1.39.2) (2023-12-15)


### Bug Fixes

* quote typing keys in the generated typing file ([#899](https://github.com/ForestAdmin/agent-nodejs/issues/899)) ([d522d03](https://github.com/ForestAdmin/agent-nodejs/commit/d522d03a5f7961aed57c9d34a9b74c09568af7ae))

## @forestadmin/datasource-customizer [1.39.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.39.0...@forestadmin/datasource-customizer@1.39.1) (2023-12-12)


### Bug Fixes

* field formValue is sometimes not correctly provided in execute context ([#894](https://github.com/ForestAdmin/agent-nodejs/issues/894)) ([a24aab1](https://github.com/ForestAdmin/agent-nodejs/commit/a24aab1b51c89df7ff72f7325dd3471a7e71a68a))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.29.1

# @forestadmin/datasource-customizer [1.39.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.38.0...@forestadmin/datasource-customizer@1.39.0) (2023-12-04)


### Features

* **datasource-customizer:** add helper to fetch values from selected record in single actions ([#891](https://github.com/ForestAdmin/agent-nodejs/issues/891)) ([24d3e50](https://github.com/ForestAdmin/agent-nodejs/commit/24d3e50b618f0ccf90bf26d2601628487c3e56ee))

# @forestadmin/datasource-customizer [1.38.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.37.5...@forestadmin/datasource-customizer@1.38.0) (2023-11-30)


### Features

* **datasource-customizer:** sort enum values in typings file ([#892](https://github.com/ForestAdmin/agent-nodejs/issues/892)) ([564974d](https://github.com/ForestAdmin/agent-nodejs/commit/564974d077805794f3d2748fe2a77765f1247e51))

## @forestadmin/datasource-customizer [1.37.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.37.4...@forestadmin/datasource-customizer@1.37.5) (2023-11-24)


### Bug Fixes

* **typing:** avoid ordering issues that causes issue with typing ([#890](https://github.com/ForestAdmin/agent-nodejs/issues/890)) ([1c9628c](https://github.com/ForestAdmin/agent-nodejs/commit/1c9628cd183a827b3e1c60143163c1b5f7e337b7))

## @forestadmin/datasource-customizer [1.37.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.37.3...@forestadmin/datasource-customizer@1.37.4) (2023-11-16)


### Bug Fixes

* do not generate typing aliases with dashes ([#883](https://github.com/ForestAdmin/agent-nodejs/issues/883)) ([f971b68](https://github.com/ForestAdmin/agent-nodejs/commit/f971b68edb7b64bc5fc87dba83b6ef627fb23009))

## @forestadmin/datasource-customizer [1.37.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.37.2...@forestadmin/datasource-customizer@1.37.3) (2023-11-14)


### Bug Fixes

* **smart-field:** log error on missing parameter dependencies and avoid crash ([#873](https://github.com/ForestAdmin/agent-nodejs/issues/873)) ([e7f80e2](https://github.com/ForestAdmin/agent-nodejs/commit/e7f80e280ed10739b379df1ba8e8892e7061e04a))

## @forestadmin/datasource-customizer [1.37.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.37.1...@forestadmin/datasource-customizer@1.37.2) (2023-11-02)


### Bug Fixes

* **renameAndRemoveField:** allow to rename or remove a relation by improving the TS typing ([#865](https://github.com/ForestAdmin/agent-nodejs/issues/865)) ([1a6a4b4](https://github.com/ForestAdmin/agent-nodejs/commit/1a6a4b45d878eb6c71787b5c8d725ec61e09cc25))

## @forestadmin/datasource-customizer [1.37.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.37.0...@forestadmin/datasource-customizer@1.37.1) (2023-10-27)


### Bug Fixes

* **charts:** remove option to set zeros instead of null values & do it by default ([#863](https://github.com/ForestAdmin/agent-nodejs/issues/863)) ([5f88663](https://github.com/ForestAdmin/agent-nodejs/commit/5f8866301b82fdfd0694010aad432fea99c1955e))

# @forestadmin/datasource-customizer [1.37.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.36.1...@forestadmin/datasource-customizer@1.37.0) (2023-10-26)


### Features

* **charts:** timebasedCharts: add option to display missing points as zeros ([#861](https://github.com/ForestAdmin/agent-nodejs/issues/861)) ([b314d3a](https://github.com/ForestAdmin/agent-nodejs/commit/b314d3a7715e06d7ae7a7ec4bb9b89e4c776e0fd))

## @forestadmin/datasource-customizer [1.36.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.36.0...@forestadmin/datasource-customizer@1.36.1) (2023-10-12)


### Bug Fixes

* **time-based-chart:** don't crash when there is no value and format the data to display "no data" on the front ([#852](https://github.com/ForestAdmin/agent-nodejs/issues/852)) ([3f033eb](https://github.com/ForestAdmin/agent-nodejs/commit/3f033eb7526f1681f15d9e89b36210b7aef6c536))

# @forestadmin/datasource-customizer [1.36.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.35.5...@forestadmin/datasource-customizer@1.36.0) (2023-10-11)


### Features

* **chart:** add multiple time based chart ([#848](https://github.com/ForestAdmin/agent-nodejs/issues/848)) ([0d67ee6](https://github.com/ForestAdmin/agent-nodejs/commit/0d67ee6c62e13f3efb31394177abae6681187e63))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.29.0

## @forestadmin/datasource-customizer [1.35.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.35.4...@forestadmin/datasource-customizer@1.35.5) (2023-10-11)


### Bug Fixes

* error starting the server because of a too large string when generating typings ([#849](https://github.com/ForestAdmin/agent-nodejs/issues/849)) ([b2d4943](https://github.com/ForestAdmin/agent-nodejs/commit/b2d4943537211b867e0030f70b8ac271f2f85aa7))

## @forestadmin/datasource-customizer [1.35.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.35.3...@forestadmin/datasource-customizer@1.35.4) (2023-10-05)

## @forestadmin/datasource-customizer [1.35.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.35.2...@forestadmin/datasource-customizer@1.35.3) (2023-10-05)


### Bug Fixes

* keep searched value in smart action form changes ([#840](https://github.com/ForestAdmin/agent-nodejs/issues/840)) ([83c0b31](https://github.com/ForestAdmin/agent-nodejs/commit/83c0b31422e622bed4867c4b882cba2f9571066d))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.28.1

## @forestadmin/datasource-customizer [1.35.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.35.1...@forestadmin/datasource-customizer@1.35.2) (2023-10-04)


### Bug Fixes

* **widgets:** fix the definition of the options property on dropdown to correctly retrieve the type of context ([#842](https://github.com/ForestAdmin/agent-nodejs/issues/842)) ([ee07a42](https://github.com/ForestAdmin/agent-nodejs/commit/ee07a422f1e823076e8c0c08c2643786ad1528be))

## @forestadmin/datasource-customizer [1.35.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.35.0...@forestadmin/datasource-customizer@1.35.1) (2023-09-28)


### Performance Improvements

* do not send large files to apimap ([#838](https://github.com/ForestAdmin/agent-nodejs/issues/838)) ([30ca9d1](https://github.com/ForestAdmin/agent-nodejs/commit/30ca9d11fbed081770ceb22b19479fd0dd48fda8))

# @forestadmin/datasource-customizer [1.35.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.34.1...@forestadmin/datasource-customizer@1.35.0) (2023-09-28)


### Features

* support file picker widget in smart action form fields ([#835](https://github.com/ForestAdmin/agent-nodejs/issues/835)) ([b895784](https://github.com/ForestAdmin/agent-nodejs/commit/b8957840458513c2127df5e62d76f5c26637ff0e))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.28.0

## @forestadmin/datasource-customizer [1.34.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.34.0...@forestadmin/datasource-customizer@1.34.1) (2023-09-26)


### Bug Fixes

* prevent smart action from from being cleared on change hook ([#834](https://github.com/ForestAdmin/agent-nodejs/issues/834)) ([f9ab089](https://github.com/ForestAdmin/agent-nodejs/commit/f9ab0892fb8f4b20fbccccaca6f1013cdf664988))

# @forestadmin/datasource-customizer [1.34.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.33.0...@forestadmin/datasource-customizer@1.34.0) (2023-09-26)


### Features

* **widgets:** add support for address picker in custom actions ([#832](https://github.com/ForestAdmin/agent-nodejs/issues/832)) ([6441d8e](https://github.com/ForestAdmin/agent-nodejs/commit/6441d8ee257ef6bef3e27f18f37377eecf0c0730))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.27.0

# @forestadmin/datasource-customizer [1.33.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.32.0...@forestadmin/datasource-customizer@1.33.0) (2023-09-25)


### Features

* support user dropdown in smart action forms ([#831](https://github.com/ForestAdmin/agent-nodejs/issues/831)) ([e88e43a](https://github.com/ForestAdmin/agent-nodejs/commit/e88e43a30694f9b5f3e7ce2d627388f6576111c3))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.26.0

# @forestadmin/datasource-customizer [1.32.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.31.0...@forestadmin/datasource-customizer@1.32.0) (2023-09-25)


### Bug Fixes

* allow dynamic description in smart action form fields ([#833](https://github.com/ForestAdmin/agent-nodejs/issues/833)) ([26e8d62](https://github.com/ForestAdmin/agent-nodejs/commit/26e8d62bf23cadde8567a9f1e5c353b83edd37b9))


### Features

* support time picker widget ([#825](https://github.com/ForestAdmin/agent-nodejs/issues/825)) ([e6acd0a](https://github.com/ForestAdmin/agent-nodejs/commit/e6acd0a85c78725ffd5bd31580aef7ce4b90a665)), closes [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828) [#828](https://github.com/ForestAdmin/agent-nodejs/issues/828)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.25.0

# @forestadmin/datasource-customizer [1.31.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.30.0...@forestadmin/datasource-customizer@1.31.0) (2023-09-22)


### Features

* **widgets:** add support for the json editor widget in actions ([#830](https://github.com/ForestAdmin/agent-nodejs/issues/830)) ([cbd2661](https://github.com/ForestAdmin/agent-nodejs/commit/cbd26616af62846d54a596ce14fe972b8df73bab))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.24.0

# @forestadmin/datasource-customizer [1.30.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.29.2...@forestadmin/datasource-customizer@1.30.0) (2023-09-21)


### Features

* dynamic search support for dropdown widget in smart action forms ([#810](https://github.com/ForestAdmin/agent-nodejs/issues/810)) ([92460a8](https://github.com/ForestAdmin/agent-nodejs/commit/92460a86fb4504047d35203440cc9a5e96af599b))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.23.0

## @forestadmin/datasource-customizer [1.29.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.29.1...@forestadmin/datasource-customizer@1.29.2) (2023-09-20)


### Bug Fixes

* deprecate timeonly custom field type and map it to time ([#827](https://github.com/ForestAdmin/agent-nodejs/issues/827)) ([0311f7d](https://github.com/ForestAdmin/agent-nodejs/commit/0311f7d8367abc4cd9aed7f73c8bbe09dc203821))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.22.1

## @forestadmin/datasource-customizer [1.29.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.29.0...@forestadmin/datasource-customizer@1.29.1) (2023-09-18)


### Bug Fixes

* formValues type definition on action context ([#828](https://github.com/ForestAdmin/agent-nodejs/issues/828)) ([2659435](https://github.com/ForestAdmin/agent-nodejs/commit/26594353f99c03a974bb89d43561d6c4325d6414))

# @forestadmin/datasource-customizer [1.29.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.28.2...@forestadmin/datasource-customizer@1.29.0) (2023-09-15)


### Features

* support date picker in action form widgets ([#819](https://github.com/ForestAdmin/agent-nodejs/issues/819)) ([f7ead87](https://github.com/ForestAdmin/agent-nodejs/commit/f7ead87f6c4bc3970f07ec7c965725a4c40b4ad6))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.22.0

## @forestadmin/datasource-customizer [1.28.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.28.1...@forestadmin/datasource-customizer@1.28.2) (2023-09-13)


### Bug Fixes

* **datasource-customizer:** add hasFieldChanged function to handle change hook on this field ([#816](https://github.com/ForestAdmin/agent-nodejs/issues/816)) ([46bae6d](https://github.com/ForestAdmin/agent-nodejs/commit/46bae6d92d6fefe93b43a8a58ae6d7127fa3eacf))

## @forestadmin/datasource-customizer [1.28.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.28.0...@forestadmin/datasource-customizer@1.28.1) (2023-09-13)


### Bug Fixes

* **datasource-customizer:** fix smart action default value behavior ([#817](https://github.com/ForestAdmin/agent-nodejs/issues/817)) ([2f9c4c1](https://github.com/ForestAdmin/agent-nodejs/commit/2f9c4c1a967bd4b2189ff10c24d536f4124f37a1))

# @forestadmin/datasource-customizer [1.28.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.27.1...@forestadmin/datasource-customizer@1.28.0) (2023-09-12)


### Features

* **widgets:** add support for currency widget ([#812](https://github.com/ForestAdmin/agent-nodejs/issues/812)) ([2f263bb](https://github.com/ForestAdmin/agent-nodejs/commit/2f263bb2d263a6e942a349ec7744284837e01ad4))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.21.0

## @forestadmin/datasource-customizer [1.27.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.27.0...@forestadmin/datasource-customizer@1.27.1) (2023-09-08)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.20.1

# @forestadmin/datasource-customizer [1.27.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.26.0...@forestadmin/datasource-customizer@1.27.0) (2023-09-07)


### Features

* **widgets:** add support for color picker in actions ([bae889c](https://github.com/ForestAdmin/agent-nodejs/commit/bae889c144e6d24d58a601f1ea4dea658889b321))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.20.0

# @forestadmin/datasource-customizer [1.26.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.25.0...@forestadmin/datasource-customizer@1.26.0) (2023-09-05)


### Features

* **widgets:** add support for number input lists with options in actions ([519d1b7](https://github.com/ForestAdmin/agent-nodejs/commit/519d1b7c344456cdcf26a8972cef619c4efb1a48))
* **widgets:** add support for number input lists with options in actions ([#807](https://github.com/ForestAdmin/agent-nodejs/issues/807)) ([22d84bd](https://github.com/ForestAdmin/agent-nodejs/commit/22d84bd104dcc7893a9536365329db5ee2467c28))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.19.0

# @forestadmin/datasource-customizer [1.25.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.24.0...@forestadmin/datasource-customizer@1.25.0) (2023-09-05)


### Features

* **widgets:** add support for number input in custom actions ([8f52fb3](https://github.com/ForestAdmin/agent-nodejs/commit/8f52fb3c90e5050873390a167fbb11df5fa34863))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.18.0

# @forestadmin/datasource-customizer [1.24.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.23.0...@forestadmin/datasource-customizer@1.24.0) (2023-09-01)


### Features

* **widgets:** add support for the checkbox group widget in custom actions ([ee9ba13](https://github.com/ForestAdmin/agent-nodejs/commit/ee9ba13f90cce42d9f0a60ace483246cbaf3048f))
* **widgets:** add support for the checkbox group widget in custom actions ([#804](https://github.com/ForestAdmin/agent-nodejs/issues/804)) ([e579850](https://github.com/ForestAdmin/agent-nodejs/commit/e57985009eed12362695c0dc029c25277900a626))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.17.0

# @forestadmin/datasource-customizer [1.23.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.22.0...@forestadmin/datasource-customizer@1.23.0) (2023-08-31)


### Bug Fixes

* allow dynamic options ([badea1b](https://github.com/ForestAdmin/agent-nodejs/commit/badea1b11e4d5ccaa25f0b29d3fc49a23a84043c))
* type for dynamic dropdowns and radio groups ([7df4523](https://github.com/ForestAdmin/agent-nodejs/commit/7df452344cc48435deb91ca67818594523abb65a))


### Features

* **widgets:** add support for the radio button group widget in custom actions ([dfba9dc](https://github.com/ForestAdmin/agent-nodejs/commit/dfba9dc84c7e2ddf06cfa7331df8b6c9840692c2))
* **widgets:** add support for the radio button group widget in custom actions ([#803](https://github.com/ForestAdmin/agent-nodejs/issues/803)) ([e2e6a40](https://github.com/ForestAdmin/agent-nodejs/commit/e2e6a406515023d807bf36ec6e594c616f509ea1))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.16.0

# @forestadmin/datasource-customizer [1.22.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.21.0...@forestadmin/datasource-customizer@1.22.0) (2023-08-31)


### Features

* **widgets:** support rich text widget in custom actions ([4a30c7d](https://github.com/ForestAdmin/agent-nodejs/commit/4a30c7d4d4810f2875199f74e38ac8f5ecfa63ce))
* **widgets:** support rich text widget in custom actions ([#802](https://github.com/ForestAdmin/agent-nodejs/issues/802)) ([e4ebbde](https://github.com/ForestAdmin/agent-nodejs/commit/e4ebbde7238abb797af42d16d47f2431c1d78db8))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.15.0

# @forestadmin/datasource-customizer [1.21.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.20.0...@forestadmin/datasource-customizer@1.21.0) (2023-08-31)


### Features

* **widgets:** add support for textarea widget in custom actions ([a15ae51](https://github.com/ForestAdmin/agent-nodejs/commit/a15ae514467545f9db1ba8c6a9ece49d2e97c7ae))
* **widgets:** add support for textarea widget in custom actions ([#801](https://github.com/ForestAdmin/agent-nodejs/issues/801)) ([9dfa02c](https://github.com/ForestAdmin/agent-nodejs/commit/9dfa02c4703d47dd6a0c77a68e71dec993ed246f))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.14.0

# @forestadmin/datasource-customizer [1.20.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.19.0...@forestadmin/datasource-customizer@1.20.0) (2023-08-31)


### Features

* add support for dynamic options ([#799](https://github.com/ForestAdmin/agent-nodejs/issues/799)) ([264f8d0](https://github.com/ForestAdmin/agent-nodejs/commit/264f8d09a4286b4a8aab64ed150edd909893cd9f))

# @forestadmin/datasource-customizer [1.19.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.18.1...@forestadmin/datasource-customizer@1.19.0) (2023-08-31)


### Features

* **widgets:** add support for TextInputList in smart actions ([779c600](https://github.com/ForestAdmin/agent-nodejs/commit/779c600a8f0ca4b9fc96d39dd6368e43e74aa41f))
* **widgets:** add support for TextInputList in smart actions ([#798](https://github.com/ForestAdmin/agent-nodejs/issues/798)) ([bab54a8](https://github.com/ForestAdmin/agent-nodejs/commit/bab54a8fb36dd31dbb9c25415248d84e3f9a32f5))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.13.0

## @forestadmin/datasource-customizer [1.18.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.18.0...@forestadmin/datasource-customizer@1.18.1) (2023-08-30)


### Bug Fixes

* **widgets:** allow to use StringList type without a widget in smart actions ([ada41d5](https://github.com/ForestAdmin/agent-nodejs/commit/ada41d544977893b92c1832b0e48bf82a076a795))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.12.1

# @forestadmin/datasource-customizer [1.18.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.17.0...@forestadmin/datasource-customizer@1.18.0) (2023-08-29)


### Features

* **widgets:** add support for text input widget in smart actions ([70c517b](https://github.com/ForestAdmin/agent-nodejs/commit/70c517bdb1d763e62c69dd63c033f3e6c2bcafe8))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.12.0

# @forestadmin/datasource-customizer [1.17.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.16.0...@forestadmin/datasource-customizer@1.17.0) (2023-08-29)


### Features

* add support for the checkbox widget for boolean fields in smart actions ([f6de833](https://github.com/ForestAdmin/agent-nodejs/commit/f6de8337497b8ef0b92b5cbd627fddf87d75f3d3))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.11.0

# @forestadmin/datasource-customizer [1.16.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.15.0...@forestadmin/datasource-customizer@1.16.0) (2023-08-28)


### Features

* add dropdown to form field options ([#776](https://github.com/ForestAdmin/agent-nodejs/issues/776)) ([2b7a9a2](https://github.com/ForestAdmin/agent-nodejs/commit/2b7a9a29b573e95dd03374341e848578774f1975))
* add support for stringList dropdown ([#793](https://github.com/ForestAdmin/agent-nodejs/issues/793)) ([7a42278](https://github.com/ForestAdmin/agent-nodejs/commit/7a422781a499d5da0bc37d291e2bc664b0216f8f))
* allow to use an array of values for dropdown options ([#790](https://github.com/ForestAdmin/agent-nodejs/issues/790)) ([8f09376](https://github.com/ForestAdmin/agent-nodejs/commit/8f09376cee2649a96edc3c2563814e15af5d63be))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.10.0

# @forestadmin/datasource-customizer [1.16.0-alpha-widgets.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.16.0-alpha-widgets.1...@forestadmin/datasource-customizer@1.16.0-alpha-widgets.2) (2023-08-25)


### Features

* add support for stringList dropdown ([#793](https://github.com/ForestAdmin/agent-nodejs/issues/793)) ([7a42278](https://github.com/ForestAdmin/agent-nodejs/commit/7a422781a499d5da0bc37d291e2bc664b0216f8f))

# @forestadmin/datasource-customizer [1.16.0-alpha-widgets.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.15.0...@forestadmin/datasource-customizer@1.16.0-alpha-widgets.1) (2023-08-23)


### Features

* add dropdown to form field options ([#776](https://github.com/ForestAdmin/agent-nodejs/issues/776)) ([2b7a9a2](https://github.com/ForestAdmin/agent-nodejs/commit/2b7a9a29b573e95dd03374341e848578774f1975))
* allow to use an array of values for dropdown options ([#790](https://github.com/ForestAdmin/agent-nodejs/issues/790)) ([8f09376](https://github.com/ForestAdmin/agent-nodejs/commit/8f09376cee2649a96edc3c2563814e15af5d63be))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.10.0-alpha-widgets.1

# @forestadmin/datasource-customizer [1.15.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.14.0...@forestadmin/datasource-customizer@1.15.0) (2023-08-11)


### Features

* **datasource-replica:** add replica datasource ([#783](https://github.com/ForestAdmin/agent-nodejs/issues/783)) ([e57a444](https://github.com/ForestAdmin/agent-nodejs/commit/e57a4440eb0f2ef69b95e42e1c41fd81e1813bb2))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.9.0

# @forestadmin/datasource-customizer [1.15.0-alpha-widgets.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.15.0-alpha-widgets.1...@forestadmin/datasource-customizer@1.15.0-alpha-widgets.2) (2023-08-23)


### Features

* allow to use an array of values for dropdown options ([#790](https://github.com/ForestAdmin/agent-nodejs/issues/790)) ([8f09376](https://github.com/ForestAdmin/agent-nodejs/commit/8f09376cee2649a96edc3c2563814e15af5d63be))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.9.0-alpha-widgets.2

# @forestadmin/datasource-customizer [1.15.0-alpha-widgets.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.14.0...@forestadmin/datasource-customizer@1.15.0-alpha-widgets.1) (2023-08-23)


### Features

* add dropdown to form field options ([#776](https://github.com/ForestAdmin/agent-nodejs/issues/776)) ([2b7a9a2](https://github.com/ForestAdmin/agent-nodejs/commit/2b7a9a29b573e95dd03374341e848578774f1975))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.9.0-alpha-widgets.1

# @forestadmin/datasource-customizer [1.14.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.13.0...@forestadmin/datasource-customizer@1.14.0) (2023-07-27)


### Features

* **datasource-customizer:** expose native driver to customers ([#779](https://github.com/ForestAdmin/agent-nodejs/issues/779)) ([350b1c3](https://github.com/ForestAdmin/agent-nodejs/commit/350b1c3dc076ab2fdfb2fbba1532548624131b94))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.8.0

# @forestadmin/datasource-customizer [1.13.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.12.1...@forestadmin/datasource-customizer@1.13.0) (2023-07-26)


### Features

* **datasource-customizer:** allow removing collections during customization ([#715](https://github.com/ForestAdmin/agent-nodejs/issues/715)) ([831c3c5](https://github.com/ForestAdmin/agent-nodejs/commit/831c3c5c6714f78570a946677749abcbcd768e72))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.7.0

## @forestadmin/datasource-customizer [1.12.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.12.0...@forestadmin/datasource-customizer@1.12.1) (2023-07-26)


### Bug Fixes

* **datasource-customizer:** fix addChart tsdoc ([#778](https://github.com/ForestAdmin/agent-nodejs/issues/778)) ([f1101fb](https://github.com/ForestAdmin/agent-nodejs/commit/f1101fb432f1b43d7ea1aa27bbe7da9890f1f075))

# @forestadmin/datasource-customizer [1.12.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.11.0...@forestadmin/datasource-customizer@1.12.0) (2023-07-26)


### Features

* **datasource-customizer:** generate typings aliases for easier use ([#777](https://github.com/ForestAdmin/agent-nodejs/issues/777)) ([7f8f03c](https://github.com/ForestAdmin/agent-nodejs/commit/7f8f03c71b3eedebdfd2deb094a55f05ecba746d))

# @forestadmin/datasource-customizer [1.11.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.10.2...@forestadmin/datasource-customizer@1.11.0) (2023-07-25)


### Features

* add changed field to action context ([#769](https://github.com/ForestAdmin/agent-nodejs/issues/769)) ([dbfa25e](https://github.com/ForestAdmin/agent-nodejs/commit/dbfa25ec3e0dd09acb39be1ee702505a5cdd60f5))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.6.0

## @forestadmin/datasource-customizer [1.10.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.10.1...@forestadmin/datasource-customizer@1.10.2) (2023-07-20)


### Bug Fixes

* **add field decorator:** throw when put space inside fieldName ([#767](https://github.com/ForestAdmin/agent-nodejs/issues/767)) ([b6840ef](https://github.com/ForestAdmin/agent-nodejs/commit/b6840efaeada99d8056802566e557f57f0c8b4e4))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.5.2

## @forestadmin/datasource-customizer [1.10.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.10.0...@forestadmin/datasource-customizer@1.10.1) (2023-07-05)


### Bug Fixes

* **datasource-customizer:** attempt to fix install when using latest nestjs version ([#758](https://github.com/ForestAdmin/agent-nodejs/issues/758)) ([04098ab](https://github.com/ForestAdmin/agent-nodejs/commit/04098abee10495c83881e08a231ecae266c2fefa))

# @forestadmin/datasource-customizer [1.10.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.9.3...@forestadmin/datasource-customizer@1.10.0) (2023-07-05)


### Features

* **config:** configuration now allows to differenciate bucket path and database path ([#752](https://github.com/ForestAdmin/agent-nodejs/issues/752)) ([dbc3b78](https://github.com/ForestAdmin/agent-nodejs/commit/dbc3b788585857107c1baf3f0d134408b9eaec2b))

## @forestadmin/datasource-customizer [1.9.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.9.2...@forestadmin/datasource-customizer@1.9.3) (2023-06-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.5.1

## @forestadmin/datasource-customizer [1.9.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.9.1...@forestadmin/datasource-customizer@1.9.2) (2023-06-26)


### Bug Fixes

* **rename field decorator:** throw when put space inside fieldName ([#748](https://github.com/ForestAdmin/agent-nodejs/issues/748)) ([5793eff](https://github.com/ForestAdmin/agent-nodejs/commit/5793eff8040c04b33afe31932b050fb6f0beb578))

## @forestadmin/datasource-customizer [1.9.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.9.0...@forestadmin/datasource-customizer@1.9.1) (2023-06-19)


### Bug Fixes

* **customizer:** validate fields on user facing collection interface ([#731](https://github.com/ForestAdmin/agent-nodejs/issues/731)) ([56d4278](https://github.com/ForestAdmin/agent-nodejs/commit/56d42788d9f66fddc88bb79ccf6573bb88202687))

# @forestadmin/datasource-customizer [1.9.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.8.0...@forestadmin/datasource-customizer@1.9.0) (2023-06-15)


### Features

* **agent:** allow to create update record custom actions from the frontend ([#729](https://github.com/ForestAdmin/agent-nodejs/issues/729)) ([e06ac79](https://github.com/ForestAdmin/agent-nodejs/commit/e06ac79111378c7bdf6e7ab9219e9ea2377e6649))

# @forestadmin/datasource-customizer [1.8.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.7.2...@forestadmin/datasource-customizer@1.8.0) (2023-06-08)


### Features

* **webhook-custom-actions:** use webhook nocode smart actions configured in the frontend ([#671](https://github.com/ForestAdmin/agent-nodejs/issues/671)) ([7629699](https://github.com/ForestAdmin/agent-nodejs/commit/762969922c98ad4b15ee2407d5789ab939059020))

# @forestadmin/datasource-customizer [1.8.0-alpha-webhook-custom-actions.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.8.0-alpha-webhook-custom-actions.1...@forestadmin/datasource-customizer@1.8.0-alpha-webhook-custom-actions.2) (2023-06-07)


### Bug Fixes

* **typings:** allow incomplete records to be passed to collection.create ([#700](https://github.com/ForestAdmin/agent-nodejs/issues/700)) ([95483e2](https://github.com/ForestAdmin/agent-nodejs/commit/95483e277d695a9f3ed19d86b2f6834413007afc))

# @forestadmin/datasource-customizer [1.8.0-alpha-webhook-custom-actions.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.7.1...@forestadmin/datasource-customizer@1.8.0-alpha-webhook-custom-actions.1) (2023-04-28)


### Features

* **webhook-custom-actions:** use webhook nocode smart actions configured in the frontend ([#671](https://github.com/ForestAdmin/agent-nodejs/issues/671)) ([7629699](https://github.com/ForestAdmin/agent-nodejs/commit/762969922c98ad4b15ee2407d5789ab939059020))
## @forestadmin/datasource-customizer [1.7.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.7.1...@forestadmin/datasource-customizer@1.7.2) (2023-05-24)


### Bug Fixes

* **typings:** allow incomplete records to be passed to collection.create ([#700](https://github.com/ForestAdmin/agent-nodejs/issues/700)) ([95483e2](https://github.com/ForestAdmin/agent-nodejs/commit/95483e277d695a9f3ed19d86b2f6834413007afc))

## @forestadmin/datasource-customizer [1.7.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.7.0...@forestadmin/datasource-customizer@1.7.1) (2023-04-27)


### Bug Fixes

* **customizer:** crash at startup when using collections with native actions ([#681](https://github.com/ForestAdmin/agent-nodejs/issues/681)) ([abe3edf](https://github.com/ForestAdmin/agent-nodejs/commit/abe3edfd476d4d0fe9b14f1d8b7c40717e3e349a))

# @forestadmin/datasource-customizer [1.7.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.6.2...@forestadmin/datasource-customizer@1.7.0) (2023-04-26)


### Features

* **datasource-customizer:** add support for binary fields ([#673](https://github.com/ForestAdmin/agent-nodejs/issues/673)) ([419727c](https://github.com/ForestAdmin/agent-nodejs/commit/419727cce812af10fa5917f1b94a2064d06883f7))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.5.0

# @forestadmin/datasource-customizer [1.7.0-alpha-webhook-custom-actions.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.6.2...@forestadmin/datasource-customizer@1.7.0-alpha-webhook-custom-actions.1) (2023-04-20)


### Features

* **webhook-custom-actions:** use webhook nocode smart actions configured in the frontend ([#671](https://github.com/ForestAdmin/agent-nodejs/issues/671)) ([7629699](https://github.com/ForestAdmin/agent-nodejs/commit/762969922c98ad4b15ee2407d5789ab939059020))

## @forestadmin/datasource-customizer [1.6.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.6.1...@forestadmin/datasource-customizer@1.6.2) (2023-04-19)


### Bug Fixes

* **validation:** make frontend validation more reliable ([#655](https://github.com/ForestAdmin/agent-nodejs/issues/655)) ([75255b0](https://github.com/ForestAdmin/agent-nodejs/commit/75255b083edc422c5bd3582c069849728d595e98))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.3

## @forestadmin/datasource-customizer [1.6.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.6.0...@forestadmin/datasource-customizer@1.6.1) (2023-03-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.2

# @forestadmin/datasource-customizer [1.6.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.13...@forestadmin/datasource-customizer@1.6.0) (2023-03-22)


### Features

* **computed:** remove need for promise.all on customer code when using async handler ([#652](https://github.com/ForestAdmin/agent-nodejs/issues/652)) ([3dab13c](https://github.com/ForestAdmin/agent-nodejs/commit/3dab13c49ecd5737aeeedb9ad21cbe44b81dfe32))

## @forestadmin/datasource-customizer [1.5.13](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.12...@forestadmin/datasource-customizer@1.5.13) (2023-03-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.1

## @forestadmin/datasource-customizer [1.5.12](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.11...@forestadmin/datasource-customizer@1.5.12) (2023-02-28)

## @forestadmin/datasource-customizer [1.5.11](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.10...@forestadmin/datasource-customizer@1.5.11) (2023-02-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.4.0

## @forestadmin/datasource-customizer [1.5.10](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.9...@forestadmin/datasource-customizer@1.5.10) (2023-01-19)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.3.0

## @forestadmin/datasource-customizer [1.5.9](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.8...@forestadmin/datasource-customizer@1.5.9) (2023-01-16)


### Bug Fixes

* when json array is passed to the validator ([#601](https://github.com/ForestAdmin/agent-nodejs/issues/601)) ([f275c22](https://github.com/ForestAdmin/agent-nodejs/commit/f275c223b9338ab3685eb9734fbfdefb4d3a16bf))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.2.2

## @forestadmin/datasource-customizer [1.5.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.7...@forestadmin/datasource-customizer@1.5.8) (2023-01-16)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.2.1

## @forestadmin/datasource-customizer [1.5.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.6...@forestadmin/datasource-customizer@1.5.7) (2023-01-13)


### Bug Fixes

* **customizer:** validation decorator should only validate its own rules ([#602](https://github.com/ForestAdmin/agent-nodejs/issues/602)) ([b626a89](https://github.com/ForestAdmin/agent-nodejs/commit/b626a89642faaf2805fb663feea4593852becae3))

## @forestadmin/datasource-customizer [1.5.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.5...@forestadmin/datasource-customizer@1.5.6) (2022-12-22)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.2.0

## @forestadmin/datasource-customizer [1.5.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.4...@forestadmin/datasource-customizer@1.5.5) (2022-12-21)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.4

## @forestadmin/datasource-customizer [1.5.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.3...@forestadmin/datasource-customizer@1.5.4) (2022-12-20)


### Bug Fixes

* **customizer:** add support for collection renaming function ([#579](https://github.com/ForestAdmin/agent-nodejs/issues/579)) ([000fa85](https://github.com/ForestAdmin/agent-nodejs/commit/000fa8523212fc211941d1d0de9788b34af4111d))

## @forestadmin/datasource-customizer [1.5.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.2...@forestadmin/datasource-customizer@1.5.3) (2022-12-20)


### Performance Improvements

* **customizer:** improve CPU usage and response time ([#571](https://github.com/ForestAdmin/agent-nodejs/issues/571)) ([addd8f8](https://github.com/ForestAdmin/agent-nodejs/commit/addd8f8d88c670a825440aa0a928a2761c8da688))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.3

## @forestadmin/datasource-customizer [1.5.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.1...@forestadmin/datasource-customizer@1.5.2) (2022-12-20)


### Bug Fixes

* **computed:** keep track of nested null values when building DAG for computation ([#575](https://github.com/ForestAdmin/agent-nodejs/issues/575)) ([2a33096](https://github.com/ForestAdmin/agent-nodejs/commit/2a330969651945525ec349d6732f532f71399aa4))

## @forestadmin/datasource-customizer [1.5.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.5.0...@forestadmin/datasource-customizer@1.5.1) (2022-12-19)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.2

# @forestadmin/datasource-customizer [1.5.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.4...@forestadmin/datasource-customizer@1.5.0) (2022-12-09)


### Features

* **plugin-flattener:** rename plugin, and add support for nested relations and field flattening ([#565](https://github.com/ForestAdmin/agent-nodejs/issues/565)) ([8158b2f](https://github.com/ForestAdmin/agent-nodejs/commit/8158b2f5fc38e52e466c09f9ba365e4c42b01108))

## @forestadmin/datasource-customizer [1.4.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.3...@forestadmin/datasource-customizer@1.4.4) (2022-12-07)


### Bug Fixes

* **customizer:** fix issues with replaceFieldWriting ([#564](https://github.com/ForestAdmin/agent-nodejs/issues/564)) ([a43a618](https://github.com/ForestAdmin/agent-nodejs/commit/a43a618d495190b4b1bf987f237acda4c691e996))

## @forestadmin/datasource-customizer [1.4.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.2...@forestadmin/datasource-customizer@1.4.3) (2022-11-29)


### Bug Fixes

* **customizer:** resolve operator equivalence between datasource composition and computed fields ([#561](https://github.com/ForestAdmin/agent-nodejs/issues/561)) ([95c9a12](https://github.com/ForestAdmin/agent-nodejs/commit/95c9a12d91dab71f07f14e77d154098edc500b5a))

## @forestadmin/datasource-customizer [1.4.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.1...@forestadmin/datasource-customizer@1.4.2) (2022-11-07)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.1

## @forestadmin/datasource-customizer [1.4.2-alpha.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.1...@forestadmin/datasource-customizer@1.4.2-alpha.1) (2022-11-03)

## @forestadmin/datasource-customizer [1.4.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.0...@forestadmin/datasource-customizer@1.4.1) (2022-11-03)


### Bug Fixes

* **sequelize:** fields of type "enum list" are missing "enumValues" ([#518](https://github.com/ForestAdmin/agent-nodejs/issues/518)) ([3c02bd8](https://github.com/ForestAdmin/agent-nodejs/commit/3c02bd867a6433004c018925f9564f0c00585987))

## @forestadmin/datasource-customizer [1.4.1-alpha.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.4.0...@forestadmin/datasource-customizer@1.4.1-alpha.1) (2022-11-03)


### Bug Fixes

* **sequelize:** fields of type "enum list" are missing "enumValues" ([#518](https://github.com/ForestAdmin/agent-nodejs/issues/518)) ([3c02bd8](https://github.com/ForestAdmin/agent-nodejs/commit/3c02bd867a6433004c018925f9564f0c00585987))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.1-alpha.1

# @forestadmin/datasource-customizer [1.4.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.3.0...@forestadmin/datasource-customizer@1.4.0) (2022-10-27)


### Features

* allow creating collection charts ([#506](https://github.com/ForestAdmin/agent-nodejs/issues/506)) ([e707757](https://github.com/ForestAdmin/agent-nodejs/commit/e707757376990888a1d037abf477537f513728ac))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.1.0

# @forestadmin/datasource-customizer [1.3.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.2.1...@forestadmin/datasource-customizer@1.3.0) (2022-10-27)


### Features

* **plugin:** import all fields from a relation ([#510](https://github.com/ForestAdmin/agent-nodejs/issues/510)) ([77f54c6](https://github.com/ForestAdmin/agent-nodejs/commit/77f54c6ef3359ac39f11e76c6881a246db42817c))

## @forestadmin/datasource-customizer [1.2.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.2.0...@forestadmin/datasource-customizer@1.2.1) (2022-10-24)


### Bug Fixes

* **schema-emitter:** better handling of schema edge-cases ([#496](https://github.com/ForestAdmin/agent-nodejs/issues/496)) ([53c9cea](https://github.com/ForestAdmin/agent-nodejs/commit/53c9cea190b017aa16b3691972d21d07fdf549d6))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.1

# @forestadmin/datasource-customizer [1.2.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.1.1...@forestadmin/datasource-customizer@1.2.0) (2022-10-18)


### Features

* **customization:** plugin system ([#397](https://github.com/ForestAdmin/agent-nodejs/issues/397)) ([06d4de7](https://github.com/ForestAdmin/agent-nodejs/commit/06d4de76a42233511a1741cb9a77c6f36d13c249))

## @forestadmin/datasource-customizer [1.1.2-alpha.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.1.1...@forestadmin/datasource-customizer@1.1.2-alpha.1) (2022-10-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.1-alpha.1

## @forestadmin/datasource-customizer [1.1.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.1.0...@forestadmin/datasource-customizer@1.1.1) (2022-10-13)


### Bug Fixes

* **customizer:** write overrides should be called before record validation ([#490](https://github.com/ForestAdmin/agent-nodejs/issues/490)) ([449d056](https://github.com/ForestAdmin/agent-nodejs/commit/449d056c2be866f4f8d90c691b6b6e4e377a7db6))

# @forestadmin/datasource-customizer [1.1.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.0.0...@forestadmin/datasource-customizer@1.1.0) (2022-10-11)


### Features

* **customizer:** automatically detect fields that can be computed before emulating relations ([#487](https://github.com/ForestAdmin/agent-nodejs/issues/487)) ([04f6fd8](https://github.com/ForestAdmin/agent-nodejs/commit/04f6fd84073b629f5576e3e46b58434e9fb08c26))

# @forestadmin/datasource-customizer 1.0.0 (2022-10-07)


### Features

* allow including/excluding collection when adding datasources ([#462](https://github.com/ForestAdmin/agent-nodejs/issues/462)) ([cda74d3](https://github.com/ForestAdmin/agent-nodejs/commit/cda74d3d34e8ca04db65f467a9bce41294ebd991))
* **datasource-customizer:** add empty package ([#449](https://github.com/ForestAdmin/agent-nodejs/issues/449)) ([d144dd4](https://github.com/ForestAdmin/agent-nodejs/commit/d144dd46f7e7f3177d2a552b35c54f31a8995989))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0

# @forestadmin/datasource-customizer [1.0.0-beta.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.0.0-beta.3...@forestadmin/datasource-customizer@1.0.0-beta.4) (2022-10-06)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.36

# @forestadmin/datasource-customizer [1.0.0-alpha.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.0.0-alpha.2...@forestadmin/datasource-customizer@1.0.0-alpha.3) (2022-10-06)


### Features

* allow including/excluding collection when adding datasources ([#462](https://github.com/ForestAdmin/agent-nodejs/issues/462)) ([cda74d3](https://github.com/ForestAdmin/agent-nodejs/commit/cda74d3d34e8ca04db65f467a9bce41294ebd991))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.3

# @forestadmin/datasource-customizer [1.0.0-beta.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.0.0-beta.2...@forestadmin/datasource-customizer@1.0.0-beta.3) (2022-10-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.35

# @forestadmin/datasource-customizer [1.0.0-beta.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.0.0-beta.1...@forestadmin/datasource-customizer@1.0.0-beta.2) (2022-10-05)


### Features

* allow including/excluding collection when adding datasources ([#462](https://github.com/ForestAdmin/agent-nodejs/issues/462)) ([cda74d3](https://github.com/ForestAdmin/agent-nodejs/commit/cda74d3d34e8ca04db65f467a9bce41294ebd991))

# @forestadmin/datasource-customizer [1.0.0-alpha.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-customizer@1.0.0-alpha.1...@forestadmin/datasource-customizer@1.0.0-alpha.2) (2022-09-28)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.2

# @forestadmin/datasource-customizer 1.0.0-alpha.1 (2022-09-28)


### Features

* **datasource-customizer:** add empty package ([#449](https://github.com/ForestAdmin/agent-nodejs/issues/449)) ([d144dd4](https://github.com/ForestAdmin/agent-nodejs/commit/d144dd46f7e7f3177d2a552b35c54f31a8995989))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.1

# @forestadmin/datasource-customizer 1.0.0-beta.1 (2022-09-26)


### Features

* **datasource-customizer:** add empty package ([#449](https://github.com/ForestAdmin/agent-nodejs/issues/449)) ([d144dd4](https://github.com/ForestAdmin/agent-nodejs/commit/d144dd46f7e7f3177d2a552b35c54f31a8995989))
