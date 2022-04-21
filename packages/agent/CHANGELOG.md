# @forestadmin/agent [1.0.0-beta.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.7...@forestadmin/agent@1.0.0-beta.8) (2022-04-21)


### Features

* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.6

# @forestadmin/agent [1.0.0-beta.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.6...@forestadmin/agent@1.0.0-beta.7) (2022-04-21)


### Bug Fixes

* **cors:** handle future private network access header ([#259](https://github.com/ForestAdmin/agent-nodejs/issues/259)) ([e9442f8](https://github.com/ForestAdmin/agent-nodejs/commit/e9442f8aa508dd4e6c663f1641d3161d35da321a))

# @forestadmin/agent [1.0.0-beta.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.5...@forestadmin/agent@1.0.0-beta.6) (2022-04-19)


### Bug Fixes

* leaderboard chart and aggregation emulation ([#241](https://github.com/ForestAdmin/agent-nodejs/issues/241)) ([d2015d7](https://github.com/ForestAdmin/agent-nodejs/commit/d2015d7f82fe6a42b36d797d6e5945b0b8f1c6ba))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.5

# @forestadmin/agent [1.0.0-beta.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.4...@forestadmin/agent@1.0.0-beta.5) (2022-04-19)


### Bug Fixes

* unpublished fields should be usable on actions ([#245](https://github.com/ForestAdmin/agent-nodejs/issues/245)) ([52c8a68](https://github.com/ForestAdmin/agent-nodejs/commit/52c8a680c1341232d8fb87f18d9d9fb802ff03d9))

# @forestadmin/agent [1.0.0-beta.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.3...@forestadmin/agent@1.0.0-beta.4) (2022-04-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.4

# @forestadmin/agent [1.0.0-beta.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.2...@forestadmin/agent@1.0.0-beta.3) (2022-04-15)


### Bug Fixes

* correct versions in package.json of all datasources ([540d395](https://github.com/ForestAdmin/agent-nodejs/commit/540d395bc5e42bdd7edb3dce5806ade8554f3d7a))

# @forestadmin/agent [1.0.0-beta.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/agent@1.0.0-beta.1...@forestadmin/agent@1.0.0-beta.2) (2022-04-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.3

# @forestadmin/agent 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* actions & delete ignored filters, search and segment ([#172](https://github.com/ForestAdmin/agent-nodejs/issues/172)) ([c0877a2](https://github.com/ForestAdmin/agent-nodejs/commit/c0877a26ad8b63721184f5fbe33922d30637d59c))
* actions needs an id to serialize properly ([#136](https://github.com/ForestAdmin/agent-nodejs/issues/136)) ([6da7fb2](https://github.com/ForestAdmin/agent-nodejs/commit/6da7fb26fe3913a95237ec3c4b8bcaaab8796d9f))
* add error message inside logger ([#143](https://github.com/ForestAdmin/agent-nodejs/issues/143)) ([54492e8](https://github.com/ForestAdmin/agent-nodejs/commit/54492e8beb7d748e9689ac6746f26be45474b7f5))
* **agent:** ignore nulls when striping undefined values in serializer ([#68](https://github.com/ForestAdmin/agent-nodejs/issues/68)) ([8fc4828](https://github.com/ForestAdmin/agent-nodejs/commit/8fc4828f70d2739f080e8f2a1e8db10ec9ff7b3e))
* **agent:** properly handle missing pagination values ([#61](https://github.com/ForestAdmin/agent-nodejs/issues/61)) ([cd9b6ca](https://github.com/ForestAdmin/agent-nodejs/commit/cd9b6caa18ce2bf800194836b46eb0e8b647355e))
* bugs in count and delete ([#93](https://github.com/ForestAdmin/agent-nodejs/issues/93)) ([f806fa2](https://github.com/ForestAdmin/agent-nodejs/commit/f806fa270d26933ac45c90f6da07f4f9e7f85a90))
* chaining methods on the collection builder ([#199](https://github.com/ForestAdmin/agent-nodejs/issues/199)) ([d9042a1](https://github.com/ForestAdmin/agent-nodejs/commit/d9042a161bc67c2d43debe4a58369d1b1dbf7ba3))
* **charts:** permission issue when aggregating by a relation ([#150](https://github.com/ForestAdmin/agent-nodejs/issues/150)) ([9ffec08](https://github.com/ForestAdmin/agent-nodejs/commit/9ffec0838d60d47969566853d4d04b038ae91fbd))
* creation of record with relationship ([#148](https://github.com/ForestAdmin/agent-nodejs/issues/148)) ([fae54a9](https://github.com/ForestAdmin/agent-nodejs/commit/fae54a960267c04810f6a1eff72f9ee999cd26d4))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* decorator ordering in builder ([#216](https://github.com/ForestAdmin/agent-nodejs/issues/216)) ([31843f9](https://github.com/ForestAdmin/agent-nodejs/commit/31843f9ce3e50d3cff2a3e8a72adc1bbc3f810f8))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fail to update records from collection with relations ([#95](https://github.com/ForestAdmin/agent-nodejs/issues/95)) ([5643d2a](https://github.com/ForestAdmin/agent-nodejs/commit/5643d2a021e3ef6571a446ad27522741244d4d6e))
* fix one to one relation creation ([#231](https://github.com/ForestAdmin/agent-nodejs/issues/231)) ([2b21bb9](https://github.com/ForestAdmin/agent-nodejs/commit/2b21bb9cf9afd71b54a7645316edbac1a8af6ab3))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* isFilterable apimap generation ([#218](https://github.com/ForestAdmin/agent-nodejs/issues/218)) ([3e9e579](https://github.com/ForestAdmin/agent-nodejs/commit/3e9e579c3882cdcf68fa35402ba7dc09b740fa7c))
* mark relations as filterable when relevant ([#113](https://github.com/ForestAdmin/agent-nodejs/issues/113)) ([2d064b2](https://github.com/ForestAdmin/agent-nodejs/commit/2d064b2e8f67b2a293ccfb7dedc5e9d40f57909c))
* **pagination:** default page should be one ([#90](https://github.com/ForestAdmin/agent-nodejs/issues/90)) ([4284417](https://github.com/ForestAdmin/agent-nodejs/commit/428441793bd25db47108e992f1c192d5207263c7))
* **release:** set bump policy to override patch ([e70c03d](https://github.com/ForestAdmin/agent-nodejs/commit/e70c03df0daecbd87ebf3a120e4dcee7585a934c))
* renderingId is a number ([#112](https://github.com/ForestAdmin/agent-nodejs/issues/112)) ([8f0166a](https://github.com/ForestAdmin/agent-nodejs/commit/8f0166ae83d66f0999057c8938bbb0d51212bf4f))
* route update returns record ([#174](https://github.com/ForestAdmin/agent-nodejs/issues/174)) ([95d2349](https://github.com/ForestAdmin/agent-nodejs/commit/95d23491f31abce121b3c2e369017792ab50445d))
* **route-update:** build projection correctly when there are relations ([#190](https://github.com/ForestAdmin/agent-nodejs/issues/190)) ([f8b83d0](https://github.com/ForestAdmin/agent-nodejs/commit/f8b83d0ac62f8353bbafdba76ff5a4aae7556015))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))
* **serialization:** workaround lost reference while schemas are not cached ([#82](https://github.com/ForestAdmin/agent-nodejs/issues/82)) ([87f1bc6](https://github.com/ForestAdmin/agent-nodejs/commit/87f1bc6d19c93e3d55781d79311ef412c7efcaa0))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))
* **unpack:** throw error when the column schema has not the same type of the value ([#134](https://github.com/ForestAdmin/agent-nodejs/issues/134)) ([f6db66c](https://github.com/ForestAdmin/agent-nodejs/commit/f6db66cfc9ca45c638a1b2078bc8fb767b858048))
* warning at installation ([#94](https://github.com/ForestAdmin/agent-nodejs/issues/94)) ([2a79baf](https://github.com/ForestAdmin/agent-nodejs/commit/2a79baf8767ec7161478b2b3e2be42c7c969ed4b))
* wrong collection targeted in count-related ([#115](https://github.com/ForestAdmin/agent-nodejs/issues/115)) ([e1459f0](https://github.com/ForestAdmin/agent-nodejs/commit/e1459f0f884c2fcaff3e5b98c772de39b617734b))
* wrong http status in logs and add support for printing the request body ([#141](https://github.com/ForestAdmin/agent-nodejs/issues/141)) ([70fb7ee](https://github.com/ForestAdmin/agent-nodejs/commit/70fb7eecd3d1ce60a1620f653eb5453be8f73dad))


### Features

* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add chart route ([#120](https://github.com/ForestAdmin/agent-nodejs/issues/120)) ([2310510](https://github.com/ForestAdmin/agent-nodejs/commit/2310510d545672cf18ccbe956a1d5c716b17cff7))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add get one route ([#53](https://github.com/ForestAdmin/agent-nodejs/issues/53)) ([3115336](https://github.com/ForestAdmin/agent-nodejs/commit/311533674edf4e467f1da49f298fd7578b706730))
* add new shared utils ([#44](https://github.com/ForestAdmin/agent-nodejs/issues/44)) ([4c67f9e](https://github.com/ForestAdmin/agent-nodejs/commit/4c67f9ea8b72b5f76286ad15f31fb9b41d77b980))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* **agent:** handle leaderboard chart ([#142](https://github.com/ForestAdmin/agent-nodejs/issues/142)) ([e20744b](https://github.com/ForestAdmin/agent-nodejs/commit/e20744b22d00252636f04cfe70d9eb523b190b57))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **collections:** add list and count routes ([#42](https://github.com/ForestAdmin/agent-nodejs/issues/42)) ([5584f08](https://github.com/ForestAdmin/agent-nodejs/commit/5584f08e16d84447ba6fdeb960c9776d49424c55))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* handle pagination parameters in list and count routes ([#57](https://github.com/ForestAdmin/agent-nodejs/issues/57)) ([13bddb9](https://github.com/ForestAdmin/agent-nodejs/commit/13bddb948e6fadb6c963b4834a8d12a5d92882f6))
* handle sort parameters in list and count routes ([#58](https://github.com/ForestAdmin/agent-nodejs/issues/58)) ([c17744b](https://github.com/ForestAdmin/agent-nodejs/commit/c17744b52f98262014f025e26119167123684d3d))
* highlight search values ([#240](https://github.com/ForestAdmin/agent-nodejs/issues/240)) ([40d05a9](https://github.com/ForestAdmin/agent-nodejs/commit/40d05a9b556df27aed8b5a06f637545e775bb4aa))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* implement roles restrictions ([#135](https://github.com/ForestAdmin/agent-nodejs/issues/135)) ([62f4328](https://github.com/ForestAdmin/agent-nodejs/commit/62f4328e8bfbc01ff6bd908c2164ec69f9c2da5d))
* implement schema conversion ([#16](https://github.com/ForestAdmin/agent-nodejs/issues/16)) ([d641263](https://github.com/ForestAdmin/agent-nodejs/commit/d6412636950370a4189a746888dca0b02247df3a))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* implement scopes ([#114](https://github.com/ForestAdmin/agent-nodejs/issues/114)) ([39f7748](https://github.com/ForestAdmin/agent-nodejs/commit/39f77485c436b9c083984a73aa3330b698f33380))
* parse query params for list and count services ([#51](https://github.com/ForestAdmin/agent-nodejs/issues/51)) ([a72b8a3](https://github.com/ForestAdmin/agent-nodejs/commit/a72b8a3eb831f9ac21161000c3a40d744198d42d))
* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **route:** add count-related route ([#87](https://github.com/ForestAdmin/agent-nodejs/issues/87)) ([4dfedea](https://github.com/ForestAdmin/agent-nodejs/commit/4dfedeadf8e19fb10466d42bb6d270a3745717d5))
* **route:** add create route ([#56](https://github.com/ForestAdmin/agent-nodejs/issues/56)) ([23c6639](https://github.com/ForestAdmin/agent-nodejs/commit/23c66397016c61f8487ac17d95d3eaf2c235afa4))
* **route:** add csv list and related routes ([#152](https://github.com/ForestAdmin/agent-nodejs/issues/152)) ([7c30a3c](https://github.com/ForestAdmin/agent-nodejs/commit/7c30a3c534d25184a6f897aab51434d0b93bbccb))
* **route:** add delete and dissociate routes ([#138](https://github.com/ForestAdmin/agent-nodejs/issues/138)) ([f228aac](https://github.com/ForestAdmin/agent-nodejs/commit/f228aaca0db144abd1d4fc952b8f215b96e29b3b))
* **route:** add list-related route ([#116](https://github.com/ForestAdmin/agent-nodejs/issues/116)) ([758abcd](https://github.com/ForestAdmin/agent-nodejs/commit/758abcdb7c6446b007c641e0f0f908d747162115))
* **route:** implement all the delete routes ([#59](https://github.com/ForestAdmin/agent-nodejs/issues/59)) ([0a46f10](https://github.com/ForestAdmin/agent-nodejs/commit/0a46f10badc3e5c33b85242377afb7f54bdf8365))
* **route:** implement update route ([#65](https://github.com/ForestAdmin/agent-nodejs/issues/65)) ([2aac22a](https://github.com/ForestAdmin/agent-nodejs/commit/2aac22a0b0706cb364fc8e79b3e9451b9800e137))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* **route:** register the update related route ([#145](https://github.com/ForestAdmin/agent-nodejs/issues/145)) ([95ed908](https://github.com/ForestAdmin/agent-nodejs/commit/95ed908c47cf852cf891bd62eee5d72692e19005))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))
* **whitelist:** add the whitelist route ([#30](https://github.com/ForestAdmin/agent-nodejs/issues/30)) ([3436d29](https://github.com/ForestAdmin/agent-nodejs/commit/3436d293338222f4b7585983a7edf40440709f1b))

# @forestadmin/agent 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* actions & delete ignored filters, search and segment ([#172](https://github.com/ForestAdmin/agent-nodejs/issues/172)) ([c0877a2](https://github.com/ForestAdmin/agent-nodejs/commit/c0877a26ad8b63721184f5fbe33922d30637d59c))
* actions needs an id to serialize properly ([#136](https://github.com/ForestAdmin/agent-nodejs/issues/136)) ([6da7fb2](https://github.com/ForestAdmin/agent-nodejs/commit/6da7fb26fe3913a95237ec3c4b8bcaaab8796d9f))
* add error message inside logger ([#143](https://github.com/ForestAdmin/agent-nodejs/issues/143)) ([54492e8](https://github.com/ForestAdmin/agent-nodejs/commit/54492e8beb7d748e9689ac6746f26be45474b7f5))
* **agent:** ignore nulls when striping undefined values in serializer ([#68](https://github.com/ForestAdmin/agent-nodejs/issues/68)) ([8fc4828](https://github.com/ForestAdmin/agent-nodejs/commit/8fc4828f70d2739f080e8f2a1e8db10ec9ff7b3e))
* **agent:** properly handle missing pagination values ([#61](https://github.com/ForestAdmin/agent-nodejs/issues/61)) ([cd9b6ca](https://github.com/ForestAdmin/agent-nodejs/commit/cd9b6caa18ce2bf800194836b46eb0e8b647355e))
* bugs in count and delete ([#93](https://github.com/ForestAdmin/agent-nodejs/issues/93)) ([f806fa2](https://github.com/ForestAdmin/agent-nodejs/commit/f806fa270d26933ac45c90f6da07f4f9e7f85a90))
* chaining methods on the collection builder ([#199](https://github.com/ForestAdmin/agent-nodejs/issues/199)) ([d9042a1](https://github.com/ForestAdmin/agent-nodejs/commit/d9042a161bc67c2d43debe4a58369d1b1dbf7ba3))
* **charts:** permission issue when aggregating by a relation ([#150](https://github.com/ForestAdmin/agent-nodejs/issues/150)) ([9ffec08](https://github.com/ForestAdmin/agent-nodejs/commit/9ffec0838d60d47969566853d4d04b038ae91fbd))
* creation of record with relationship ([#148](https://github.com/ForestAdmin/agent-nodejs/issues/148)) ([fae54a9](https://github.com/ForestAdmin/agent-nodejs/commit/fae54a960267c04810f6a1eff72f9ee999cd26d4))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* decorator ordering in builder ([#216](https://github.com/ForestAdmin/agent-nodejs/issues/216)) ([31843f9](https://github.com/ForestAdmin/agent-nodejs/commit/31843f9ce3e50d3cff2a3e8a72adc1bbc3f810f8))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fail to update records from collection with relations ([#95](https://github.com/ForestAdmin/agent-nodejs/issues/95)) ([5643d2a](https://github.com/ForestAdmin/agent-nodejs/commit/5643d2a021e3ef6571a446ad27522741244d4d6e))
* fix one to one relation creation ([#231](https://github.com/ForestAdmin/agent-nodejs/issues/231)) ([2b21bb9](https://github.com/ForestAdmin/agent-nodejs/commit/2b21bb9cf9afd71b54a7645316edbac1a8af6ab3))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* isFilterable apimap generation ([#218](https://github.com/ForestAdmin/agent-nodejs/issues/218)) ([3e9e579](https://github.com/ForestAdmin/agent-nodejs/commit/3e9e579c3882cdcf68fa35402ba7dc09b740fa7c))
* mark relations as filterable when relevant ([#113](https://github.com/ForestAdmin/agent-nodejs/issues/113)) ([2d064b2](https://github.com/ForestAdmin/agent-nodejs/commit/2d064b2e8f67b2a293ccfb7dedc5e9d40f57909c))
* **pagination:** default page should be one ([#90](https://github.com/ForestAdmin/agent-nodejs/issues/90)) ([4284417](https://github.com/ForestAdmin/agent-nodejs/commit/428441793bd25db47108e992f1c192d5207263c7))
* **release:** set bump policy to override patch ([e70c03d](https://github.com/ForestAdmin/agent-nodejs/commit/e70c03df0daecbd87ebf3a120e4dcee7585a934c))
* renderingId is a number ([#112](https://github.com/ForestAdmin/agent-nodejs/issues/112)) ([8f0166a](https://github.com/ForestAdmin/agent-nodejs/commit/8f0166ae83d66f0999057c8938bbb0d51212bf4f))
* route update returns record ([#174](https://github.com/ForestAdmin/agent-nodejs/issues/174)) ([95d2349](https://github.com/ForestAdmin/agent-nodejs/commit/95d23491f31abce121b3c2e369017792ab50445d))
* **route-update:** build projection correctly when there are relations ([#190](https://github.com/ForestAdmin/agent-nodejs/issues/190)) ([f8b83d0](https://github.com/ForestAdmin/agent-nodejs/commit/f8b83d0ac62f8353bbafdba76ff5a4aae7556015))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))
* **serialization:** workaround lost reference while schemas are not cached ([#82](https://github.com/ForestAdmin/agent-nodejs/issues/82)) ([87f1bc6](https://github.com/ForestAdmin/agent-nodejs/commit/87f1bc6d19c93e3d55781d79311ef412c7efcaa0))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))
* **unpack:** throw error when the column schema has not the same type of the value ([#134](https://github.com/ForestAdmin/agent-nodejs/issues/134)) ([f6db66c](https://github.com/ForestAdmin/agent-nodejs/commit/f6db66cfc9ca45c638a1b2078bc8fb767b858048))
* warning at installation ([#94](https://github.com/ForestAdmin/agent-nodejs/issues/94)) ([2a79baf](https://github.com/ForestAdmin/agent-nodejs/commit/2a79baf8767ec7161478b2b3e2be42c7c969ed4b))
* wrong collection targeted in count-related ([#115](https://github.com/ForestAdmin/agent-nodejs/issues/115)) ([e1459f0](https://github.com/ForestAdmin/agent-nodejs/commit/e1459f0f884c2fcaff3e5b98c772de39b617734b))
* wrong http status in logs and add support for printing the request body ([#141](https://github.com/ForestAdmin/agent-nodejs/issues/141)) ([70fb7ee](https://github.com/ForestAdmin/agent-nodejs/commit/70fb7eecd3d1ce60a1620f653eb5453be8f73dad))


### Features

* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add chart route ([#120](https://github.com/ForestAdmin/agent-nodejs/issues/120)) ([2310510](https://github.com/ForestAdmin/agent-nodejs/commit/2310510d545672cf18ccbe956a1d5c716b17cff7))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add get one route ([#53](https://github.com/ForestAdmin/agent-nodejs/issues/53)) ([3115336](https://github.com/ForestAdmin/agent-nodejs/commit/311533674edf4e467f1da49f298fd7578b706730))
* add new shared utils ([#44](https://github.com/ForestAdmin/agent-nodejs/issues/44)) ([4c67f9e](https://github.com/ForestAdmin/agent-nodejs/commit/4c67f9ea8b72b5f76286ad15f31fb9b41d77b980))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* **agent:** handle leaderboard chart ([#142](https://github.com/ForestAdmin/agent-nodejs/issues/142)) ([e20744b](https://github.com/ForestAdmin/agent-nodejs/commit/e20744b22d00252636f04cfe70d9eb523b190b57))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **collections:** add list and count routes ([#42](https://github.com/ForestAdmin/agent-nodejs/issues/42)) ([5584f08](https://github.com/ForestAdmin/agent-nodejs/commit/5584f08e16d84447ba6fdeb960c9776d49424c55))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* handle pagination parameters in list and count routes ([#57](https://github.com/ForestAdmin/agent-nodejs/issues/57)) ([13bddb9](https://github.com/ForestAdmin/agent-nodejs/commit/13bddb948e6fadb6c963b4834a8d12a5d92882f6))
* handle sort parameters in list and count routes ([#58](https://github.com/ForestAdmin/agent-nodejs/issues/58)) ([c17744b](https://github.com/ForestAdmin/agent-nodejs/commit/c17744b52f98262014f025e26119167123684d3d))
* highlight search values ([#240](https://github.com/ForestAdmin/agent-nodejs/issues/240)) ([40d05a9](https://github.com/ForestAdmin/agent-nodejs/commit/40d05a9b556df27aed8b5a06f637545e775bb4aa))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* implement roles restrictions ([#135](https://github.com/ForestAdmin/agent-nodejs/issues/135)) ([62f4328](https://github.com/ForestAdmin/agent-nodejs/commit/62f4328e8bfbc01ff6bd908c2164ec69f9c2da5d))
* implement schema conversion ([#16](https://github.com/ForestAdmin/agent-nodejs/issues/16)) ([d641263](https://github.com/ForestAdmin/agent-nodejs/commit/d6412636950370a4189a746888dca0b02247df3a))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* implement scopes ([#114](https://github.com/ForestAdmin/agent-nodejs/issues/114)) ([39f7748](https://github.com/ForestAdmin/agent-nodejs/commit/39f77485c436b9c083984a73aa3330b698f33380))
* parse query params for list and count services ([#51](https://github.com/ForestAdmin/agent-nodejs/issues/51)) ([a72b8a3](https://github.com/ForestAdmin/agent-nodejs/commit/a72b8a3eb831f9ac21161000c3a40d744198d42d))
* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **route:** add count-related route ([#87](https://github.com/ForestAdmin/agent-nodejs/issues/87)) ([4dfedea](https://github.com/ForestAdmin/agent-nodejs/commit/4dfedeadf8e19fb10466d42bb6d270a3745717d5))
* **route:** add create route ([#56](https://github.com/ForestAdmin/agent-nodejs/issues/56)) ([23c6639](https://github.com/ForestAdmin/agent-nodejs/commit/23c66397016c61f8487ac17d95d3eaf2c235afa4))
* **route:** add csv list and related routes ([#152](https://github.com/ForestAdmin/agent-nodejs/issues/152)) ([7c30a3c](https://github.com/ForestAdmin/agent-nodejs/commit/7c30a3c534d25184a6f897aab51434d0b93bbccb))
* **route:** add delete and dissociate routes ([#138](https://github.com/ForestAdmin/agent-nodejs/issues/138)) ([f228aac](https://github.com/ForestAdmin/agent-nodejs/commit/f228aaca0db144abd1d4fc952b8f215b96e29b3b))
* **route:** add list-related route ([#116](https://github.com/ForestAdmin/agent-nodejs/issues/116)) ([758abcd](https://github.com/ForestAdmin/agent-nodejs/commit/758abcdb7c6446b007c641e0f0f908d747162115))
* **route:** implement all the delete routes ([#59](https://github.com/ForestAdmin/agent-nodejs/issues/59)) ([0a46f10](https://github.com/ForestAdmin/agent-nodejs/commit/0a46f10badc3e5c33b85242377afb7f54bdf8365))
* **route:** implement update route ([#65](https://github.com/ForestAdmin/agent-nodejs/issues/65)) ([2aac22a](https://github.com/ForestAdmin/agent-nodejs/commit/2aac22a0b0706cb364fc8e79b3e9451b9800e137))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* **route:** register the update related route ([#145](https://github.com/ForestAdmin/agent-nodejs/issues/145)) ([95ed908](https://github.com/ForestAdmin/agent-nodejs/commit/95ed908c47cf852cf891bd62eee5d72692e19005))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))
* **whitelist:** add the whitelist route ([#30](https://github.com/ForestAdmin/agent-nodejs/issues/30)) ([3436d29](https://github.com/ForestAdmin/agent-nodejs/commit/3436d293338222f4b7585983a7edf40440709f1b))

# @forestadmin/agent 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* actions & delete ignored filters, search and segment ([#172](https://github.com/ForestAdmin/agent-nodejs/issues/172)) ([c0877a2](https://github.com/ForestAdmin/agent-nodejs/commit/c0877a26ad8b63721184f5fbe33922d30637d59c))
* actions needs an id to serialize properly ([#136](https://github.com/ForestAdmin/agent-nodejs/issues/136)) ([6da7fb2](https://github.com/ForestAdmin/agent-nodejs/commit/6da7fb26fe3913a95237ec3c4b8bcaaab8796d9f))
* add error message inside logger ([#143](https://github.com/ForestAdmin/agent-nodejs/issues/143)) ([54492e8](https://github.com/ForestAdmin/agent-nodejs/commit/54492e8beb7d748e9689ac6746f26be45474b7f5))
* **agent:** ignore nulls when striping undefined values in serializer ([#68](https://github.com/ForestAdmin/agent-nodejs/issues/68)) ([8fc4828](https://github.com/ForestAdmin/agent-nodejs/commit/8fc4828f70d2739f080e8f2a1e8db10ec9ff7b3e))
* **agent:** properly handle missing pagination values ([#61](https://github.com/ForestAdmin/agent-nodejs/issues/61)) ([cd9b6ca](https://github.com/ForestAdmin/agent-nodejs/commit/cd9b6caa18ce2bf800194836b46eb0e8b647355e))
* bugs in count and delete ([#93](https://github.com/ForestAdmin/agent-nodejs/issues/93)) ([f806fa2](https://github.com/ForestAdmin/agent-nodejs/commit/f806fa270d26933ac45c90f6da07f4f9e7f85a90))
* chaining methods on the collection builder ([#199](https://github.com/ForestAdmin/agent-nodejs/issues/199)) ([d9042a1](https://github.com/ForestAdmin/agent-nodejs/commit/d9042a161bc67c2d43debe4a58369d1b1dbf7ba3))
* **charts:** permission issue when aggregating by a relation ([#150](https://github.com/ForestAdmin/agent-nodejs/issues/150)) ([9ffec08](https://github.com/ForestAdmin/agent-nodejs/commit/9ffec0838d60d47969566853d4d04b038ae91fbd))
* creation of record with relationship ([#148](https://github.com/ForestAdmin/agent-nodejs/issues/148)) ([fae54a9](https://github.com/ForestAdmin/agent-nodejs/commit/fae54a960267c04810f6a1eff72f9ee999cd26d4))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* decorator ordering in builder ([#216](https://github.com/ForestAdmin/agent-nodejs/issues/216)) ([31843f9](https://github.com/ForestAdmin/agent-nodejs/commit/31843f9ce3e50d3cff2a3e8a72adc1bbc3f810f8))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fail to update records from collection with relations ([#95](https://github.com/ForestAdmin/agent-nodejs/issues/95)) ([5643d2a](https://github.com/ForestAdmin/agent-nodejs/commit/5643d2a021e3ef6571a446ad27522741244d4d6e))
* fix one to one relation creation ([#231](https://github.com/ForestAdmin/agent-nodejs/issues/231)) ([2b21bb9](https://github.com/ForestAdmin/agent-nodejs/commit/2b21bb9cf9afd71b54a7645316edbac1a8af6ab3))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* isFilterable apimap generation ([#218](https://github.com/ForestAdmin/agent-nodejs/issues/218)) ([3e9e579](https://github.com/ForestAdmin/agent-nodejs/commit/3e9e579c3882cdcf68fa35402ba7dc09b740fa7c))
* mark relations as filterable when relevant ([#113](https://github.com/ForestAdmin/agent-nodejs/issues/113)) ([2d064b2](https://github.com/ForestAdmin/agent-nodejs/commit/2d064b2e8f67b2a293ccfb7dedc5e9d40f57909c))
* **pagination:** default page should be one ([#90](https://github.com/ForestAdmin/agent-nodejs/issues/90)) ([4284417](https://github.com/ForestAdmin/agent-nodejs/commit/428441793bd25db47108e992f1c192d5207263c7))
* **release:** set bump policy to override patch ([e70c03d](https://github.com/ForestAdmin/agent-nodejs/commit/e70c03df0daecbd87ebf3a120e4dcee7585a934c))
* renderingId is a number ([#112](https://github.com/ForestAdmin/agent-nodejs/issues/112)) ([8f0166a](https://github.com/ForestAdmin/agent-nodejs/commit/8f0166ae83d66f0999057c8938bbb0d51212bf4f))
* route update returns record ([#174](https://github.com/ForestAdmin/agent-nodejs/issues/174)) ([95d2349](https://github.com/ForestAdmin/agent-nodejs/commit/95d23491f31abce121b3c2e369017792ab50445d))
* **route-update:** build projection correctly when there are relations ([#190](https://github.com/ForestAdmin/agent-nodejs/issues/190)) ([f8b83d0](https://github.com/ForestAdmin/agent-nodejs/commit/f8b83d0ac62f8353bbafdba76ff5a4aae7556015))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))
* **serialization:** workaround lost reference while schemas are not cached ([#82](https://github.com/ForestAdmin/agent-nodejs/issues/82)) ([87f1bc6](https://github.com/ForestAdmin/agent-nodejs/commit/87f1bc6d19c93e3d55781d79311ef412c7efcaa0))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))
* **unpack:** throw error when the column schema has not the same type of the value ([#134](https://github.com/ForestAdmin/agent-nodejs/issues/134)) ([f6db66c](https://github.com/ForestAdmin/agent-nodejs/commit/f6db66cfc9ca45c638a1b2078bc8fb767b858048))
* warning at installation ([#94](https://github.com/ForestAdmin/agent-nodejs/issues/94)) ([2a79baf](https://github.com/ForestAdmin/agent-nodejs/commit/2a79baf8767ec7161478b2b3e2be42c7c969ed4b))
* wrong collection targeted in count-related ([#115](https://github.com/ForestAdmin/agent-nodejs/issues/115)) ([e1459f0](https://github.com/ForestAdmin/agent-nodejs/commit/e1459f0f884c2fcaff3e5b98c772de39b617734b))
* wrong http status in logs and add support for printing the request body ([#141](https://github.com/ForestAdmin/agent-nodejs/issues/141)) ([70fb7ee](https://github.com/ForestAdmin/agent-nodejs/commit/70fb7eecd3d1ce60a1620f653eb5453be8f73dad))


### Features

* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add chart route ([#120](https://github.com/ForestAdmin/agent-nodejs/issues/120)) ([2310510](https://github.com/ForestAdmin/agent-nodejs/commit/2310510d545672cf18ccbe956a1d5c716b17cff7))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add get one route ([#53](https://github.com/ForestAdmin/agent-nodejs/issues/53)) ([3115336](https://github.com/ForestAdmin/agent-nodejs/commit/311533674edf4e467f1da49f298fd7578b706730))
* add new shared utils ([#44](https://github.com/ForestAdmin/agent-nodejs/issues/44)) ([4c67f9e](https://github.com/ForestAdmin/agent-nodejs/commit/4c67f9ea8b72b5f76286ad15f31fb9b41d77b980))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* **agent:** handle leaderboard chart ([#142](https://github.com/ForestAdmin/agent-nodejs/issues/142)) ([e20744b](https://github.com/ForestAdmin/agent-nodejs/commit/e20744b22d00252636f04cfe70d9eb523b190b57))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **collections:** add list and count routes ([#42](https://github.com/ForestAdmin/agent-nodejs/issues/42)) ([5584f08](https://github.com/ForestAdmin/agent-nodejs/commit/5584f08e16d84447ba6fdeb960c9776d49424c55))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* handle pagination parameters in list and count routes ([#57](https://github.com/ForestAdmin/agent-nodejs/issues/57)) ([13bddb9](https://github.com/ForestAdmin/agent-nodejs/commit/13bddb948e6fadb6c963b4834a8d12a5d92882f6))
* handle sort parameters in list and count routes ([#58](https://github.com/ForestAdmin/agent-nodejs/issues/58)) ([c17744b](https://github.com/ForestAdmin/agent-nodejs/commit/c17744b52f98262014f025e26119167123684d3d))
* highlight search values ([#240](https://github.com/ForestAdmin/agent-nodejs/issues/240)) ([40d05a9](https://github.com/ForestAdmin/agent-nodejs/commit/40d05a9b556df27aed8b5a06f637545e775bb4aa))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* implement roles restrictions ([#135](https://github.com/ForestAdmin/agent-nodejs/issues/135)) ([62f4328](https://github.com/ForestAdmin/agent-nodejs/commit/62f4328e8bfbc01ff6bd908c2164ec69f9c2da5d))
* implement schema conversion ([#16](https://github.com/ForestAdmin/agent-nodejs/issues/16)) ([d641263](https://github.com/ForestAdmin/agent-nodejs/commit/d6412636950370a4189a746888dca0b02247df3a))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* implement scopes ([#114](https://github.com/ForestAdmin/agent-nodejs/issues/114)) ([39f7748](https://github.com/ForestAdmin/agent-nodejs/commit/39f77485c436b9c083984a73aa3330b698f33380))
* parse query params for list and count services ([#51](https://github.com/ForestAdmin/agent-nodejs/issues/51)) ([a72b8a3](https://github.com/ForestAdmin/agent-nodejs/commit/a72b8a3eb831f9ac21161000c3a40d744198d42d))
* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **route:** add count-related route ([#87](https://github.com/ForestAdmin/agent-nodejs/issues/87)) ([4dfedea](https://github.com/ForestAdmin/agent-nodejs/commit/4dfedeadf8e19fb10466d42bb6d270a3745717d5))
* **route:** add create route ([#56](https://github.com/ForestAdmin/agent-nodejs/issues/56)) ([23c6639](https://github.com/ForestAdmin/agent-nodejs/commit/23c66397016c61f8487ac17d95d3eaf2c235afa4))
* **route:** add csv list and related routes ([#152](https://github.com/ForestAdmin/agent-nodejs/issues/152)) ([7c30a3c](https://github.com/ForestAdmin/agent-nodejs/commit/7c30a3c534d25184a6f897aab51434d0b93bbccb))
* **route:** add delete and dissociate routes ([#138](https://github.com/ForestAdmin/agent-nodejs/issues/138)) ([f228aac](https://github.com/ForestAdmin/agent-nodejs/commit/f228aaca0db144abd1d4fc952b8f215b96e29b3b))
* **route:** add list-related route ([#116](https://github.com/ForestAdmin/agent-nodejs/issues/116)) ([758abcd](https://github.com/ForestAdmin/agent-nodejs/commit/758abcdb7c6446b007c641e0f0f908d747162115))
* **route:** implement all the delete routes ([#59](https://github.com/ForestAdmin/agent-nodejs/issues/59)) ([0a46f10](https://github.com/ForestAdmin/agent-nodejs/commit/0a46f10badc3e5c33b85242377afb7f54bdf8365))
* **route:** implement update route ([#65](https://github.com/ForestAdmin/agent-nodejs/issues/65)) ([2aac22a](https://github.com/ForestAdmin/agent-nodejs/commit/2aac22a0b0706cb364fc8e79b3e9451b9800e137))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* **route:** register the update related route ([#145](https://github.com/ForestAdmin/agent-nodejs/issues/145)) ([95ed908](https://github.com/ForestAdmin/agent-nodejs/commit/95ed908c47cf852cf891bd62eee5d72692e19005))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))
* **whitelist:** add the whitelist route ([#30](https://github.com/ForestAdmin/agent-nodejs/issues/30)) ([3436d29](https://github.com/ForestAdmin/agent-nodejs/commit/3436d293338222f4b7585983a7edf40440709f1b))

# @forestadmin/agent 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* actions & delete ignored filters, search and segment ([#172](https://github.com/ForestAdmin/agent-nodejs/issues/172)) ([c0877a2](https://github.com/ForestAdmin/agent-nodejs/commit/c0877a26ad8b63721184f5fbe33922d30637d59c))
* actions needs an id to serialize properly ([#136](https://github.com/ForestAdmin/agent-nodejs/issues/136)) ([6da7fb2](https://github.com/ForestAdmin/agent-nodejs/commit/6da7fb26fe3913a95237ec3c4b8bcaaab8796d9f))
* add error message inside logger ([#143](https://github.com/ForestAdmin/agent-nodejs/issues/143)) ([54492e8](https://github.com/ForestAdmin/agent-nodejs/commit/54492e8beb7d748e9689ac6746f26be45474b7f5))
* **agent:** ignore nulls when striping undefined values in serializer ([#68](https://github.com/ForestAdmin/agent-nodejs/issues/68)) ([8fc4828](https://github.com/ForestAdmin/agent-nodejs/commit/8fc4828f70d2739f080e8f2a1e8db10ec9ff7b3e))
* **agent:** properly handle missing pagination values ([#61](https://github.com/ForestAdmin/agent-nodejs/issues/61)) ([cd9b6ca](https://github.com/ForestAdmin/agent-nodejs/commit/cd9b6caa18ce2bf800194836b46eb0e8b647355e))
* bugs in count and delete ([#93](https://github.com/ForestAdmin/agent-nodejs/issues/93)) ([f806fa2](https://github.com/ForestAdmin/agent-nodejs/commit/f806fa270d26933ac45c90f6da07f4f9e7f85a90))
* chaining methods on the collection builder ([#199](https://github.com/ForestAdmin/agent-nodejs/issues/199)) ([d9042a1](https://github.com/ForestAdmin/agent-nodejs/commit/d9042a161bc67c2d43debe4a58369d1b1dbf7ba3))
* **charts:** permission issue when aggregating by a relation ([#150](https://github.com/ForestAdmin/agent-nodejs/issues/150)) ([9ffec08](https://github.com/ForestAdmin/agent-nodejs/commit/9ffec0838d60d47969566853d4d04b038ae91fbd))
* creation of record with relationship ([#148](https://github.com/ForestAdmin/agent-nodejs/issues/148)) ([fae54a9](https://github.com/ForestAdmin/agent-nodejs/commit/fae54a960267c04810f6a1eff72f9ee999cd26d4))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* decorator ordering in builder ([#216](https://github.com/ForestAdmin/agent-nodejs/issues/216)) ([31843f9](https://github.com/ForestAdmin/agent-nodejs/commit/31843f9ce3e50d3cff2a3e8a72adc1bbc3f810f8))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fail to update records from collection with relations ([#95](https://github.com/ForestAdmin/agent-nodejs/issues/95)) ([5643d2a](https://github.com/ForestAdmin/agent-nodejs/commit/5643d2a021e3ef6571a446ad27522741244d4d6e))
* fix one to one relation creation ([#231](https://github.com/ForestAdmin/agent-nodejs/issues/231)) ([2b21bb9](https://github.com/ForestAdmin/agent-nodejs/commit/2b21bb9cf9afd71b54a7645316edbac1a8af6ab3))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* isFilterable apimap generation ([#218](https://github.com/ForestAdmin/agent-nodejs/issues/218)) ([3e9e579](https://github.com/ForestAdmin/agent-nodejs/commit/3e9e579c3882cdcf68fa35402ba7dc09b740fa7c))
* mark relations as filterable when relevant ([#113](https://github.com/ForestAdmin/agent-nodejs/issues/113)) ([2d064b2](https://github.com/ForestAdmin/agent-nodejs/commit/2d064b2e8f67b2a293ccfb7dedc5e9d40f57909c))
* **pagination:** default page should be one ([#90](https://github.com/ForestAdmin/agent-nodejs/issues/90)) ([4284417](https://github.com/ForestAdmin/agent-nodejs/commit/428441793bd25db47108e992f1c192d5207263c7))
* **release:** set bump policy to override patch ([e70c03d](https://github.com/ForestAdmin/agent-nodejs/commit/e70c03df0daecbd87ebf3a120e4dcee7585a934c))
* renderingId is a number ([#112](https://github.com/ForestAdmin/agent-nodejs/issues/112)) ([8f0166a](https://github.com/ForestAdmin/agent-nodejs/commit/8f0166ae83d66f0999057c8938bbb0d51212bf4f))
* route update returns record ([#174](https://github.com/ForestAdmin/agent-nodejs/issues/174)) ([95d2349](https://github.com/ForestAdmin/agent-nodejs/commit/95d23491f31abce121b3c2e369017792ab50445d))
* **route-update:** build projection correctly when there are relations ([#190](https://github.com/ForestAdmin/agent-nodejs/issues/190)) ([f8b83d0](https://github.com/ForestAdmin/agent-nodejs/commit/f8b83d0ac62f8353bbafdba76ff5a4aae7556015))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))
* **serialization:** workaround lost reference while schemas are not cached ([#82](https://github.com/ForestAdmin/agent-nodejs/issues/82)) ([87f1bc6](https://github.com/ForestAdmin/agent-nodejs/commit/87f1bc6d19c93e3d55781d79311ef412c7efcaa0))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))
* **unpack:** throw error when the column schema has not the same type of the value ([#134](https://github.com/ForestAdmin/agent-nodejs/issues/134)) ([f6db66c](https://github.com/ForestAdmin/agent-nodejs/commit/f6db66cfc9ca45c638a1b2078bc8fb767b858048))
* warning at installation ([#94](https://github.com/ForestAdmin/agent-nodejs/issues/94)) ([2a79baf](https://github.com/ForestAdmin/agent-nodejs/commit/2a79baf8767ec7161478b2b3e2be42c7c969ed4b))
* wrong collection targeted in count-related ([#115](https://github.com/ForestAdmin/agent-nodejs/issues/115)) ([e1459f0](https://github.com/ForestAdmin/agent-nodejs/commit/e1459f0f884c2fcaff3e5b98c772de39b617734b))
* wrong http status in logs and add support for printing the request body ([#141](https://github.com/ForestAdmin/agent-nodejs/issues/141)) ([70fb7ee](https://github.com/ForestAdmin/agent-nodejs/commit/70fb7eecd3d1ce60a1620f653eb5453be8f73dad))


### Features

* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add chart route ([#120](https://github.com/ForestAdmin/agent-nodejs/issues/120)) ([2310510](https://github.com/ForestAdmin/agent-nodejs/commit/2310510d545672cf18ccbe956a1d5c716b17cff7))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add get one route ([#53](https://github.com/ForestAdmin/agent-nodejs/issues/53)) ([3115336](https://github.com/ForestAdmin/agent-nodejs/commit/311533674edf4e467f1da49f298fd7578b706730))
* add new shared utils ([#44](https://github.com/ForestAdmin/agent-nodejs/issues/44)) ([4c67f9e](https://github.com/ForestAdmin/agent-nodejs/commit/4c67f9ea8b72b5f76286ad15f31fb9b41d77b980))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* **agent:** handle leaderboard chart ([#142](https://github.com/ForestAdmin/agent-nodejs/issues/142)) ([e20744b](https://github.com/ForestAdmin/agent-nodejs/commit/e20744b22d00252636f04cfe70d9eb523b190b57))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **collections:** add list and count routes ([#42](https://github.com/ForestAdmin/agent-nodejs/issues/42)) ([5584f08](https://github.com/ForestAdmin/agent-nodejs/commit/5584f08e16d84447ba6fdeb960c9776d49424c55))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* handle pagination parameters in list and count routes ([#57](https://github.com/ForestAdmin/agent-nodejs/issues/57)) ([13bddb9](https://github.com/ForestAdmin/agent-nodejs/commit/13bddb948e6fadb6c963b4834a8d12a5d92882f6))
* handle sort parameters in list and count routes ([#58](https://github.com/ForestAdmin/agent-nodejs/issues/58)) ([c17744b](https://github.com/ForestAdmin/agent-nodejs/commit/c17744b52f98262014f025e26119167123684d3d))
* highlight search values ([#240](https://github.com/ForestAdmin/agent-nodejs/issues/240)) ([40d05a9](https://github.com/ForestAdmin/agent-nodejs/commit/40d05a9b556df27aed8b5a06f637545e775bb4aa))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* implement roles restrictions ([#135](https://github.com/ForestAdmin/agent-nodejs/issues/135)) ([62f4328](https://github.com/ForestAdmin/agent-nodejs/commit/62f4328e8bfbc01ff6bd908c2164ec69f9c2da5d))
* implement schema conversion ([#16](https://github.com/ForestAdmin/agent-nodejs/issues/16)) ([d641263](https://github.com/ForestAdmin/agent-nodejs/commit/d6412636950370a4189a746888dca0b02247df3a))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* implement scopes ([#114](https://github.com/ForestAdmin/agent-nodejs/issues/114)) ([39f7748](https://github.com/ForestAdmin/agent-nodejs/commit/39f77485c436b9c083984a73aa3330b698f33380))
* parse query params for list and count services ([#51](https://github.com/ForestAdmin/agent-nodejs/issues/51)) ([a72b8a3](https://github.com/ForestAdmin/agent-nodejs/commit/a72b8a3eb831f9ac21161000c3a40d744198d42d))
* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **route:** add count-related route ([#87](https://github.com/ForestAdmin/agent-nodejs/issues/87)) ([4dfedea](https://github.com/ForestAdmin/agent-nodejs/commit/4dfedeadf8e19fb10466d42bb6d270a3745717d5))
* **route:** add create route ([#56](https://github.com/ForestAdmin/agent-nodejs/issues/56)) ([23c6639](https://github.com/ForestAdmin/agent-nodejs/commit/23c66397016c61f8487ac17d95d3eaf2c235afa4))
* **route:** add csv list and related routes ([#152](https://github.com/ForestAdmin/agent-nodejs/issues/152)) ([7c30a3c](https://github.com/ForestAdmin/agent-nodejs/commit/7c30a3c534d25184a6f897aab51434d0b93bbccb))
* **route:** add delete and dissociate routes ([#138](https://github.com/ForestAdmin/agent-nodejs/issues/138)) ([f228aac](https://github.com/ForestAdmin/agent-nodejs/commit/f228aaca0db144abd1d4fc952b8f215b96e29b3b))
* **route:** add list-related route ([#116](https://github.com/ForestAdmin/agent-nodejs/issues/116)) ([758abcd](https://github.com/ForestAdmin/agent-nodejs/commit/758abcdb7c6446b007c641e0f0f908d747162115))
* **route:** implement all the delete routes ([#59](https://github.com/ForestAdmin/agent-nodejs/issues/59)) ([0a46f10](https://github.com/ForestAdmin/agent-nodejs/commit/0a46f10badc3e5c33b85242377afb7f54bdf8365))
* **route:** implement update route ([#65](https://github.com/ForestAdmin/agent-nodejs/issues/65)) ([2aac22a](https://github.com/ForestAdmin/agent-nodejs/commit/2aac22a0b0706cb364fc8e79b3e9451b9800e137))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* **route:** register the update related route ([#145](https://github.com/ForestAdmin/agent-nodejs/issues/145)) ([95ed908](https://github.com/ForestAdmin/agent-nodejs/commit/95ed908c47cf852cf891bd62eee5d72692e19005))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))
* **whitelist:** add the whitelist route ([#30](https://github.com/ForestAdmin/agent-nodejs/issues/30)) ([3436d29](https://github.com/ForestAdmin/agent-nodejs/commit/3436d293338222f4b7585983a7edf40440709f1b))

# @forestadmin/agent 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* actions & delete ignored filters, search and segment ([#172](https://github.com/ForestAdmin/agent-nodejs/issues/172)) ([c0877a2](https://github.com/ForestAdmin/agent-nodejs/commit/c0877a26ad8b63721184f5fbe33922d30637d59c))
* actions needs an id to serialize properly ([#136](https://github.com/ForestAdmin/agent-nodejs/issues/136)) ([6da7fb2](https://github.com/ForestAdmin/agent-nodejs/commit/6da7fb26fe3913a95237ec3c4b8bcaaab8796d9f))
* add error message inside logger ([#143](https://github.com/ForestAdmin/agent-nodejs/issues/143)) ([54492e8](https://github.com/ForestAdmin/agent-nodejs/commit/54492e8beb7d748e9689ac6746f26be45474b7f5))
* **agent:** ignore nulls when striping undefined values in serializer ([#68](https://github.com/ForestAdmin/agent-nodejs/issues/68)) ([8fc4828](https://github.com/ForestAdmin/agent-nodejs/commit/8fc4828f70d2739f080e8f2a1e8db10ec9ff7b3e))
* **agent:** properly handle missing pagination values ([#61](https://github.com/ForestAdmin/agent-nodejs/issues/61)) ([cd9b6ca](https://github.com/ForestAdmin/agent-nodejs/commit/cd9b6caa18ce2bf800194836b46eb0e8b647355e))
* bugs in count and delete ([#93](https://github.com/ForestAdmin/agent-nodejs/issues/93)) ([f806fa2](https://github.com/ForestAdmin/agent-nodejs/commit/f806fa270d26933ac45c90f6da07f4f9e7f85a90))
* chaining methods on the collection builder ([#199](https://github.com/ForestAdmin/agent-nodejs/issues/199)) ([d9042a1](https://github.com/ForestAdmin/agent-nodejs/commit/d9042a161bc67c2d43debe4a58369d1b1dbf7ba3))
* **charts:** permission issue when aggregating by a relation ([#150](https://github.com/ForestAdmin/agent-nodejs/issues/150)) ([9ffec08](https://github.com/ForestAdmin/agent-nodejs/commit/9ffec0838d60d47969566853d4d04b038ae91fbd))
* creation of record with relationship ([#148](https://github.com/ForestAdmin/agent-nodejs/issues/148)) ([fae54a9](https://github.com/ForestAdmin/agent-nodejs/commit/fae54a960267c04810f6a1eff72f9ee999cd26d4))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* decorator ordering in builder ([#216](https://github.com/ForestAdmin/agent-nodejs/issues/216)) ([31843f9](https://github.com/ForestAdmin/agent-nodejs/commit/31843f9ce3e50d3cff2a3e8a72adc1bbc3f810f8))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fail to update records from collection with relations ([#95](https://github.com/ForestAdmin/agent-nodejs/issues/95)) ([5643d2a](https://github.com/ForestAdmin/agent-nodejs/commit/5643d2a021e3ef6571a446ad27522741244d4d6e))
* fix one to one relation creation ([#231](https://github.com/ForestAdmin/agent-nodejs/issues/231)) ([2b21bb9](https://github.com/ForestAdmin/agent-nodejs/commit/2b21bb9cf9afd71b54a7645316edbac1a8af6ab3))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* isFilterable apimap generation ([#218](https://github.com/ForestAdmin/agent-nodejs/issues/218)) ([3e9e579](https://github.com/ForestAdmin/agent-nodejs/commit/3e9e579c3882cdcf68fa35402ba7dc09b740fa7c))
* mark relations as filterable when relevant ([#113](https://github.com/ForestAdmin/agent-nodejs/issues/113)) ([2d064b2](https://github.com/ForestAdmin/agent-nodejs/commit/2d064b2e8f67b2a293ccfb7dedc5e9d40f57909c))
* **pagination:** default page should be one ([#90](https://github.com/ForestAdmin/agent-nodejs/issues/90)) ([4284417](https://github.com/ForestAdmin/agent-nodejs/commit/428441793bd25db47108e992f1c192d5207263c7))
* renderingId is a number ([#112](https://github.com/ForestAdmin/agent-nodejs/issues/112)) ([8f0166a](https://github.com/ForestAdmin/agent-nodejs/commit/8f0166ae83d66f0999057c8938bbb0d51212bf4f))
* route update returns record ([#174](https://github.com/ForestAdmin/agent-nodejs/issues/174)) ([95d2349](https://github.com/ForestAdmin/agent-nodejs/commit/95d23491f31abce121b3c2e369017792ab50445d))
* **route-update:** build projection correctly when there are relations ([#190](https://github.com/ForestAdmin/agent-nodejs/issues/190)) ([f8b83d0](https://github.com/ForestAdmin/agent-nodejs/commit/f8b83d0ac62f8353bbafdba76ff5a4aae7556015))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))
* **serialization:** workaround lost reference while schemas are not cached ([#82](https://github.com/ForestAdmin/agent-nodejs/issues/82)) ([87f1bc6](https://github.com/ForestAdmin/agent-nodejs/commit/87f1bc6d19c93e3d55781d79311ef412c7efcaa0))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))
* **unpack:** throw error when the column schema has not the same type of the value ([#134](https://github.com/ForestAdmin/agent-nodejs/issues/134)) ([f6db66c](https://github.com/ForestAdmin/agent-nodejs/commit/f6db66cfc9ca45c638a1b2078bc8fb767b858048))
* warning at installation ([#94](https://github.com/ForestAdmin/agent-nodejs/issues/94)) ([2a79baf](https://github.com/ForestAdmin/agent-nodejs/commit/2a79baf8767ec7161478b2b3e2be42c7c969ed4b))
* wrong collection targeted in count-related ([#115](https://github.com/ForestAdmin/agent-nodejs/issues/115)) ([e1459f0](https://github.com/ForestAdmin/agent-nodejs/commit/e1459f0f884c2fcaff3e5b98c772de39b617734b))
* wrong http status in logs and add support for printing the request body ([#141](https://github.com/ForestAdmin/agent-nodejs/issues/141)) ([70fb7ee](https://github.com/ForestAdmin/agent-nodejs/commit/70fb7eecd3d1ce60a1620f653eb5453be8f73dad))


### Features

* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add chart route ([#120](https://github.com/ForestAdmin/agent-nodejs/issues/120)) ([2310510](https://github.com/ForestAdmin/agent-nodejs/commit/2310510d545672cf18ccbe956a1d5c716b17cff7))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add get one route ([#53](https://github.com/ForestAdmin/agent-nodejs/issues/53)) ([3115336](https://github.com/ForestAdmin/agent-nodejs/commit/311533674edf4e467f1da49f298fd7578b706730))
* add new shared utils ([#44](https://github.com/ForestAdmin/agent-nodejs/issues/44)) ([4c67f9e](https://github.com/ForestAdmin/agent-nodejs/commit/4c67f9ea8b72b5f76286ad15f31fb9b41d77b980))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* **agent:** handle leaderboard chart ([#142](https://github.com/ForestAdmin/agent-nodejs/issues/142)) ([e20744b](https://github.com/ForestAdmin/agent-nodejs/commit/e20744b22d00252636f04cfe70d9eb523b190b57))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **collections:** add list and count routes ([#42](https://github.com/ForestAdmin/agent-nodejs/issues/42)) ([5584f08](https://github.com/ForestAdmin/agent-nodejs/commit/5584f08e16d84447ba6fdeb960c9776d49424c55))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* handle pagination parameters in list and count routes ([#57](https://github.com/ForestAdmin/agent-nodejs/issues/57)) ([13bddb9](https://github.com/ForestAdmin/agent-nodejs/commit/13bddb948e6fadb6c963b4834a8d12a5d92882f6))
* handle sort parameters in list and count routes ([#58](https://github.com/ForestAdmin/agent-nodejs/issues/58)) ([c17744b](https://github.com/ForestAdmin/agent-nodejs/commit/c17744b52f98262014f025e26119167123684d3d))
* highlight search values ([#240](https://github.com/ForestAdmin/agent-nodejs/issues/240)) ([40d05a9](https://github.com/ForestAdmin/agent-nodejs/commit/40d05a9b556df27aed8b5a06f637545e775bb4aa))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* implement roles restrictions ([#135](https://github.com/ForestAdmin/agent-nodejs/issues/135)) ([62f4328](https://github.com/ForestAdmin/agent-nodejs/commit/62f4328e8bfbc01ff6bd908c2164ec69f9c2da5d))
* implement schema conversion ([#16](https://github.com/ForestAdmin/agent-nodejs/issues/16)) ([d641263](https://github.com/ForestAdmin/agent-nodejs/commit/d6412636950370a4189a746888dca0b02247df3a))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* implement scopes ([#114](https://github.com/ForestAdmin/agent-nodejs/issues/114)) ([39f7748](https://github.com/ForestAdmin/agent-nodejs/commit/39f77485c436b9c083984a73aa3330b698f33380))
* parse query params for list and count services ([#51](https://github.com/ForestAdmin/agent-nodejs/issues/51)) ([a72b8a3](https://github.com/ForestAdmin/agent-nodejs/commit/a72b8a3eb831f9ac21161000c3a40d744198d42d))
* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **route:** add count-related route ([#87](https://github.com/ForestAdmin/agent-nodejs/issues/87)) ([4dfedea](https://github.com/ForestAdmin/agent-nodejs/commit/4dfedeadf8e19fb10466d42bb6d270a3745717d5))
* **route:** add create route ([#56](https://github.com/ForestAdmin/agent-nodejs/issues/56)) ([23c6639](https://github.com/ForestAdmin/agent-nodejs/commit/23c66397016c61f8487ac17d95d3eaf2c235afa4))
* **route:** add csv list and related routes ([#152](https://github.com/ForestAdmin/agent-nodejs/issues/152)) ([7c30a3c](https://github.com/ForestAdmin/agent-nodejs/commit/7c30a3c534d25184a6f897aab51434d0b93bbccb))
* **route:** add delete and dissociate routes ([#138](https://github.com/ForestAdmin/agent-nodejs/issues/138)) ([f228aac](https://github.com/ForestAdmin/agent-nodejs/commit/f228aaca0db144abd1d4fc952b8f215b96e29b3b))
* **route:** add list-related route ([#116](https://github.com/ForestAdmin/agent-nodejs/issues/116)) ([758abcd](https://github.com/ForestAdmin/agent-nodejs/commit/758abcdb7c6446b007c641e0f0f908d747162115))
* **route:** implement all the delete routes ([#59](https://github.com/ForestAdmin/agent-nodejs/issues/59)) ([0a46f10](https://github.com/ForestAdmin/agent-nodejs/commit/0a46f10badc3e5c33b85242377afb7f54bdf8365))
* **route:** implement update route ([#65](https://github.com/ForestAdmin/agent-nodejs/issues/65)) ([2aac22a](https://github.com/ForestAdmin/agent-nodejs/commit/2aac22a0b0706cb364fc8e79b3e9451b9800e137))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* **route:** register the update related route ([#145](https://github.com/ForestAdmin/agent-nodejs/issues/145)) ([95ed908](https://github.com/ForestAdmin/agent-nodejs/commit/95ed908c47cf852cf891bd62eee5d72692e19005))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))
* **whitelist:** add the whitelist route ([#30](https://github.com/ForestAdmin/agent-nodejs/issues/30)) ([3436d29](https://github.com/ForestAdmin/agent-nodejs/commit/3436d293338222f4b7585983a7edf40440709f1b))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.2
