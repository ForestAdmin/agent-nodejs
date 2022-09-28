# example [1.0.0-alpha.3](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-alpha.2...example@1.0.0-alpha.3) (2022-09-28)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-alpha.3

# example [1.0.0-alpha.2](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-alpha.1...example@1.0.0-alpha.2) (2022-09-28)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-alpha.2
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-alpha.2
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-alpha.2
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-alpha.2
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.2
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-alpha.2

# example 1.0.0-alpha.1 (2022-09-28)


### Bug Fixes

* update code and sequelize version to avoid crash ([#374](https://github.com/ForestAdmin/agent-nodejs/issues/374)) ([e003416](https://github.com/ForestAdmin/agent-nodejs/commit/e0034166b86e48781ea099086fd93aa7c68dba03))
* **agent:** export a factory to create the agent ([#298](https://github.com/ForestAdmin/agent-nodejs/issues/298)) ([8370ab7](https://github.com/ForestAdmin/agent-nodejs/commit/8370ab7a7d58cbbbbae0991d48ab89033573fbb2))
* **datasource-sequelize:** serialize record to transform date to iso string  ([#331](https://github.com/ForestAdmin/agent-nodejs/issues/331)) ([70216bb](https://github.com/ForestAdmin/agent-nodejs/commit/70216bb7fc5307e458ee5651e9f16c90b61ff49a))
* **typing-generator:** add simple quote arround the collection and fiel name to be compatible with ts ([#336](https://github.com/ForestAdmin/agent-nodejs/issues/336)) ([138b593](https://github.com/ForestAdmin/agent-nodejs/commit/138b593bff7d6dadbb5779d503e30c722f7978cf))
* datasource naming consistency ([#292](https://github.com/ForestAdmin/agent-nodejs/issues/292)) ([ff50a1f](https://github.com/ForestAdmin/agent-nodejs/commit/ff50a1f02aa65b3d99824c2bc9fb19d729a4e465))
* **example:** the imports in the seed to prepare the dbs ([#273](https://github.com/ForestAdmin/agent-nodejs/issues/273)) ([95891b7](https://github.com/ForestAdmin/agent-nodejs/commit/95891b7a7c884bc6ef7403dcea82f3cb2c40890c))
* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* codelimate configuration to remove _example directory to the coverage ([#177](https://github.com/ForestAdmin/agent-nodejs/issues/177)) ([50862da](https://github.com/ForestAdmin/agent-nodejs/commit/50862da06cf8d3a9bb8bbc86c78499d8e35f4d77))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* example project write override uses an outdated handler prototype ([#267](https://github.com/ForestAdmin/agent-nodejs/issues/267)) ([c32e212](https://github.com/ForestAdmin/agent-nodejs/commit/c32e21245d1703b599f474dfddfc5888e1a6fc77))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* import packages from js ([#260](https://github.com/ForestAdmin/agent-nodejs/issues/260)) ([de00886](https://github.com/ForestAdmin/agent-nodejs/commit/de008862971ea5d3559e5a4c3136b0dd2161d760))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* leaderboard chart and aggregation emulation ([#241](https://github.com/ForestAdmin/agent-nodejs/issues/241)) ([d2015d7](https://github.com/ForestAdmin/agent-nodejs/commit/d2015d7f82fe6a42b36d797d6e5945b0b8f1c6ba))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* **datasource sequelize:** enable date filter ([#166](https://github.com/ForestAdmin/agent-nodejs/issues/166)) ([5f0e349](https://github.com/ForestAdmin/agent-nodejs/commit/5f0e3494dbb254ef5351e0c85061ce196d8c2f9b))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))


### Features

* **oidc:** users don't need to provide agentUrl anymore ([#387](https://github.com/ForestAdmin/agent-nodejs/issues/387)) ([39d6ac7](https://github.com/ForestAdmin/agent-nodejs/commit/39d6ac72409081a1fe5748a67f5c1f4e146d7b01))
* allow configuring field validators during agent customization ([#365](https://github.com/ForestAdmin/agent-nodejs/issues/365)) ([8bc6fb3](https://github.com/ForestAdmin/agent-nodejs/commit/8bc6fb379891eb81cbfaddf6bffd89bb02f478ed))
* **builder:** add helper method to create embedded relationships ([#311](https://github.com/ForestAdmin/agent-nodejs/issues/311)) ([662cf58](https://github.com/ForestAdmin/agent-nodejs/commit/662cf5885c8b7c4fa17fed59f20f54625d4e5660))
* **importField:** make it writable by default ([#362](https://github.com/ForestAdmin/agent-nodejs/issues/362)) ([aa4646e](https://github.com/ForestAdmin/agent-nodejs/commit/aa4646e6da49e06e0603a815dbae61fd8a4bfe30))
* add support for mongoose datasource ([#339](https://github.com/ForestAdmin/agent-nodejs/issues/339)) ([5515286](https://github.com/ForestAdmin/agent-nodejs/commit/55152862dceff4714bf9b36ed6c138acdf8cb9e3))
* **decorator:** allow to rename a collection ([#341](https://github.com/ForestAdmin/agent-nodejs/issues/341)) ([1eb279e](https://github.com/ForestAdmin/agent-nodejs/commit/1eb279edc4fbe0511618bfdcf42e3980e57164da))
* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add jointure decorator ([#158](https://github.com/ForestAdmin/agent-nodejs/issues/158)) ([e8d8e95](https://github.com/ForestAdmin/agent-nodejs/commit/e8d8e95d6d92e9378ca0de5d7efb12a8bd04a21e))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* add replaceSearch to collection customizer ([#310](https://github.com/ForestAdmin/agent-nodejs/issues/310)) ([09a45c7](https://github.com/ForestAdmin/agent-nodejs/commit/09a45c783c277dd5642aa9b289a43750f3d97ade))
* add support for standalone mode ([#304](https://github.com/ForestAdmin/agent-nodejs/issues/304)) ([c2bca75](https://github.com/ForestAdmin/agent-nodejs/commit/c2bca75a882c1591ad7560583ba0c56fb8020e12))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* autocomplete on field names ([#263](https://github.com/ForestAdmin/agent-nodejs/issues/263)) ([e2025d5](https://github.com/ForestAdmin/agent-nodejs/commit/e2025d57d930edf6d326bd0c6d7fffcd4aad728d))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* compatibility with Express.js, Koa, Fastify & NestJS ([#300](https://github.com/ForestAdmin/agent-nodejs/issues/300)) ([904639e](https://github.com/ForestAdmin/agent-nodejs/commit/904639ec66f4116b3c5557d83ec43656e55ccbbc))
* give access to logged in user to customization context ([#253](https://github.com/ForestAdmin/agent-nodejs/issues/253)) ([be97812](https://github.com/ForestAdmin/agent-nodejs/commit/be978121e47ab06c7a50cc6dec0cdb9284ea9d96))
* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))
* implement api-charts ([#284](https://github.com/ForestAdmin/agent-nodejs/issues/284)) ([5917b8c](https://github.com/ForestAdmin/agent-nodejs/commit/5917b8cf645998cd3c0d750310cd81920b250e71))
* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **builder:** create one method per relation type in the collection customizer ([#302](https://github.com/ForestAdmin/agent-nodejs/issues/302)) ([df5438d](https://github.com/ForestAdmin/agent-nodejs/commit/df5438d641bd8c4f8ad7c114120189d9dda26c44))
* **datasource sequelize:** handle enum field type ([#193](https://github.com/ForestAdmin/agent-nodejs/issues/193)) ([04cc0f5](https://github.com/ForestAdmin/agent-nodejs/commit/04cc0f528b10f298b08d78e89e8f553b5e1a08e1))
* **datasource sql:** handle primitive fields and default values ([#215](https://github.com/ForestAdmin/agent-nodejs/issues/215)) ([59a56da](https://github.com/ForestAdmin/agent-nodejs/commit/59a56da2721f39d0487b14d72b11d71b38b83a1f))
* **example:** add custom connector ([#261](https://github.com/ForestAdmin/agent-nodejs/issues/261)) ([69e04de](https://github.com/ForestAdmin/agent-nodejs/commit/69e04ded95a3b528acc07a4463eacd4b7c5a5a2b))
* **mongoose:** add schema generator ([#303](https://github.com/ForestAdmin/agent-nodejs/issues/303)) ([55fa26a](https://github.com/ForestAdmin/agent-nodejs/commit/55fa26a3d1c975c35bdab6a20655573ecaceb31e))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* implement condition tree equivalents ([#71](https://github.com/ForestAdmin/agent-nodejs/issues/71)) ([d434eb2](https://github.com/ForestAdmin/agent-nodejs/commit/d434eb294b159f91747e4d78e737f5bd32ffb147))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* load all decorators in the project example ([#89](https://github.com/ForestAdmin/agent-nodejs/issues/89)) ([dd73b05](https://github.com/ForestAdmin/agent-nodejs/commit/dd73b0548eb25dc5108bb0a55b42b922c0414264))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-alpha.1
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-alpha.1
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-alpha.1
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-alpha.1
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.1
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-alpha.1

# example [1.0.0-beta.79](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.78...example@1.0.0-beta.79) (2022-09-27)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.53

# example [1.0.0-beta.78](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.77...example@1.0.0-beta.78) (2022-09-23)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.60

# example [1.0.0-beta.77](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.76...example@1.0.0-beta.77) (2022-09-22)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.59
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.35
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.44
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.52
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.34
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.22

# example [1.0.0-beta.76](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.75...example@1.0.0-beta.76) (2022-09-15)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.58
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.34
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.43
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.51
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.33
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.21

# example [1.0.0-beta.75](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.74...example@1.0.0-beta.75) (2022-09-14)


### Features

* **oidc:** users don't need to provide agentUrl anymore ([#387](https://github.com/ForestAdmin/agent-nodejs/issues/387)) ([39d6ac7](https://github.com/ForestAdmin/agent-nodejs/commit/39d6ac72409081a1fe5748a67f5c1f4e146d7b01))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.57

# example [1.0.0-beta.74](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.73...example@1.0.0-beta.74) (2022-09-12)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.50

# example [1.0.0-beta.73](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.72...example@1.0.0-beta.73) (2022-09-12)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.56
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.33
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.42
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.49
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.32
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.20

# example [1.0.0-beta.72](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.71...example@1.0.0-beta.72) (2022-09-08)


### Features

* allow configuring field validators during agent customization ([#365](https://github.com/ForestAdmin/agent-nodejs/issues/365)) ([8bc6fb3](https://github.com/ForestAdmin/agent-nodejs/commit/8bc6fb379891eb81cbfaddf6bffd89bb02f478ed))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.55
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.32
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.41
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.48
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.19

# example [1.0.0-beta.71](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.70...example@1.0.0-beta.71) (2022-09-08)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.54

# example [1.0.0-beta.70](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.69...example@1.0.0-beta.70) (2022-09-08)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.53

# example [1.0.0-beta.69](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.68...example@1.0.0-beta.69) (2022-09-07)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.52
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.41
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.40
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.47
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.30
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.18

# example [1.0.0-beta.68](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.67...example@1.0.0-beta.68) (2022-09-07)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.40
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.39
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.46

# example [1.0.0-beta.67](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.66...example@1.0.0-beta.67) (2022-09-05)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.51
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.30
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.39
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.38
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.45
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.29
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.17

# example [1.0.0-beta.66](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.65...example@1.0.0-beta.66) (2022-09-05)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.50
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.29
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.38
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.37
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.44
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.28
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.16

# example [1.0.0-beta.65](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.64...example@1.0.0-beta.65) (2022-09-02)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.49

# example [1.0.0-beta.64](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.63...example@1.0.0-beta.64) (2022-09-02)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.43

# example [1.0.0-beta.63](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.62...example@1.0.0-beta.63) (2022-08-31)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.48

# example [1.0.0-beta.62](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.61...example@1.0.0-beta.62) (2022-08-26)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.47

# example [1.0.0-beta.61](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.60...example@1.0.0-beta.61) (2022-08-24)





### Dependencies

* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.15

# example [1.0.0-beta.60](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.59...example@1.0.0-beta.60) (2022-08-23)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.46
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.28
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.37
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.36
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.42
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.14

# example [1.0.0-beta.59](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.58...example@1.0.0-beta.59) (2022-08-23)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.36
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.35
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.41

# example [1.0.0-beta.58](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.57...example@1.0.0-beta.58) (2022-08-23)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.45

# example [1.0.0-beta.57](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.56...example@1.0.0-beta.57) (2022-08-23)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.44

# example [1.0.0-beta.56](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.55...example@1.0.0-beta.56) (2022-07-26)


### Features

* **importField:** make it writable by default ([#362](https://github.com/ForestAdmin/agent-nodejs/issues/362)) ([aa4646e](https://github.com/ForestAdmin/agent-nodejs/commit/aa4646e6da49e06e0603a815dbae61fd8a4bfe30))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.43

# example [1.0.0-beta.55](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.54...example@1.0.0-beta.55) (2022-07-25)


### Bug Fixes

* update code and sequelize version to avoid crash ([#374](https://github.com/ForestAdmin/agent-nodejs/issues/374)) ([e003416](https://github.com/ForestAdmin/agent-nodejs/commit/e0034166b86e48781ea099086fd93aa7c68dba03))





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.35
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.34
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.40

# example [1.0.0-beta.54](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.53...example@1.0.0-beta.54) (2022-07-12)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.42

# example [1.0.0-beta.53](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.52...example@1.0.0-beta.53) (2022-06-27)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.34
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.33
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.39

# example [1.0.0-beta.52](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.51...example@1.0.0-beta.52) (2022-06-16)


### Bug Fixes

* **datasource-sequelize:** serialize record to transform date to iso string  ([#331](https://github.com/ForestAdmin/agent-nodejs/issues/331)) ([70216bb](https://github.com/ForestAdmin/agent-nodejs/commit/70216bb7fc5307e458ee5651e9f16c90b61ff49a))


### Features

* add support for mongoose datasource ([#339](https://github.com/ForestAdmin/agent-nodejs/issues/339)) ([5515286](https://github.com/ForestAdmin/agent-nodejs/commit/55152862dceff4714bf9b36ed6c138acdf8cb9e3))





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.33
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.32
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.38
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.13

# example [1.0.0-beta.51](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.50...example@1.0.0-beta.51) (2022-06-16)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.37

# example [1.0.0-beta.50](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.49...example@1.0.0-beta.50) (2022-06-15)


### Features

* **decorator:** allow to rename a collection ([#341](https://github.com/ForestAdmin/agent-nodejs/issues/341)) ([1eb279e](https://github.com/ForestAdmin/agent-nodejs/commit/1eb279edc4fbe0511618bfdcf42e3980e57164da))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.41
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.32
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.36
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.12

# example [1.0.0-beta.49](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.48...example@1.0.0-beta.49) (2022-06-15)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.40
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.30
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.35
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.25
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.11

# example [1.0.0-beta.48](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.47...example@1.0.0-beta.48) (2022-06-14)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.39
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.25
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.30
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.29
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.34
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.24
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.10

# example [1.0.0-beta.47](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.46...example@1.0.0-beta.47) (2022-06-14)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.38
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.24
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.29
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.28
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.33
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.9

# example [1.0.0-beta.46](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.45...example@1.0.0-beta.46) (2022-06-09)


### Bug Fixes

* **typing-generator:** add simple quote arround the collection and fiel name to be compatible with ts ([#336](https://github.com/ForestAdmin/agent-nodejs/issues/336)) ([138b593](https://github.com/ForestAdmin/agent-nodejs/commit/138b593bff7d6dadbb5779d503e30c722f7978cf))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.37

# example [1.0.0-beta.45](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.44...example@1.0.0-beta.45) (2022-06-09)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.36
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.28
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.32
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.8

# example [1.0.0-beta.44](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.43...example@1.0.0-beta.44) (2022-06-01)


### Features

* **builder:** add helper method to create embedded relationships ([#311](https://github.com/ForestAdmin/agent-nodejs/issues/311)) ([662cf58](https://github.com/ForestAdmin/agent-nodejs/commit/662cf5885c8b7c4fa17fed59f20f54625d4e5660))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.35
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.7

# example [1.0.0-beta.43](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.42...example@1.0.0-beta.43) (2022-05-31)


### Features

* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.34
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.25
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.30
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.6

# example [1.0.0-beta.42](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.41...example@1.0.0-beta.42) (2022-05-25)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.33
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.25
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.24
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.29
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.5

# example [1.0.0-beta.41](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.40...example@1.0.0-beta.41) (2022-05-24)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.32
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.24
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.28
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.4

# example [1.0.0-beta.40](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.39...example@1.0.0-beta.40) (2022-05-24)


### Features

* add replaceSearch to collection customizer ([#310](https://github.com/ForestAdmin/agent-nodejs/issues/310)) ([09a45c7](https://github.com/ForestAdmin/agent-nodejs/commit/09a45c783c277dd5642aa9b289a43750f3d97ade))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.17

# example [1.0.0-beta.40](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.39...example@1.0.0-beta.40) (2022-05-23)


### Features

* add replaceSearch to collection customizer ([#310](https://github.com/ForestAdmin/agent-nodejs/issues/310)) ([09a45c7](https://github.com/ForestAdmin/agent-nodejs/commit/09a45c783c277dd5642aa9b289a43750f3d97ade))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.2

# example [1.0.0-beta.39](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.38...example@1.0.0-beta.39) (2022-05-19)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.30

# example [1.0.0-beta.38](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.37...example@1.0.0-beta.38) (2022-05-18)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.29

# example [1.0.0-beta.37](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.36...example@1.0.0-beta.37) (2022-05-18)


### Features

* compatibility with Express.js, Koa, Fastify & NestJS ([#300](https://github.com/ForestAdmin/agent-nodejs/issues/300)) ([904639e](https://github.com/ForestAdmin/agent-nodejs/commit/904639ec66f4116b3c5557d83ec43656e55ccbbc))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.28

# example [1.0.0-beta.36](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.35...example@1.0.0-beta.36) (2022-05-17)


### Features

* add support for standalone mode ([#304](https://github.com/ForestAdmin/agent-nodejs/issues/304)) ([c2bca75](https://github.com/ForestAdmin/agent-nodejs/commit/c2bca75a882c1591ad7560583ba0c56fb8020e12))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.27

# example [1.0.0-beta.35](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.34...example@1.0.0-beta.35) (2022-05-17)


### Features

* **mongoose:** add schema generator ([#303](https://github.com/ForestAdmin/agent-nodejs/issues/303)) ([55fa26a](https://github.com/ForestAdmin/agent-nodejs/commit/55fa26a3d1c975c35bdab6a20655573ecaceb31e))





### Dependencies

* **@forestadmin/datasource-mongoose:** upgraded to 1.0.0-beta.1

# example [1.0.0-beta.34](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.33...example@1.0.0-beta.34) (2022-05-16)


### Features

* autocomplete on field names ([#263](https://github.com/ForestAdmin/agent-nodejs/issues/263)) ([e2025d5](https://github.com/ForestAdmin/agent-nodejs/commit/e2025d57d930edf6d326bd0c6d7fffcd4aad728d))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.16

# example [1.0.0-beta.33](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.32...example@1.0.0-beta.33) (2022-05-16)


### Features

* **builder:** create one method per relation type in the collection customizer ([#302](https://github.com/ForestAdmin/agent-nodejs/issues/302)) ([df5438d](https://github.com/ForestAdmin/agent-nodejs/commit/df5438d641bd8c4f8ad7c114120189d9dda26c44))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.25

# example [1.0.0-beta.32](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.31...example@1.0.0-beta.32) (2022-05-16)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.24

# example [1.0.0-beta.31](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.30...example@1.0.0-beta.31) (2022-05-12)


### Features

* implement api-charts ([#284](https://github.com/ForestAdmin/agent-nodejs/issues/284)) ([5917b8c](https://github.com/ForestAdmin/agent-nodejs/commit/5917b8cf645998cd3c0d750310cd81920b250e71))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.16
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.25
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.15

# example [1.0.0-beta.30](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.29...example@1.0.0-beta.30) (2022-05-09)


### Bug Fixes

* **agent:** export a factory to create the agent ([#298](https://github.com/ForestAdmin/agent-nodejs/issues/298)) ([8370ab7](https://github.com/ForestAdmin/agent-nodejs/commit/8370ab7a7d58cbbbbae0991d48ab89033573fbb2))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.22

# example [1.0.0-beta.29](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.28...example@1.0.0-beta.29) (2022-05-09)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.24

# example [1.0.0-beta.28](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.27...example@1.0.0-beta.28) (2022-05-09)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.15
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.14

# example [1.0.0-beta.27](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.26...example@1.0.0-beta.27) (2022-05-09)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.14
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.13

# example [1.0.0-beta.26](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.25...example@1.0.0-beta.26) (2022-05-09)


### Bug Fixes

* datasource naming consistency ([#292](https://github.com/ForestAdmin/agent-nodejs/issues/292)) ([ff50a1f](https://github.com/ForestAdmin/agent-nodejs/commit/ff50a1f02aa65b3d99824c2bc9fb19d729a4e465))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.13
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.12

# example [1.0.0-beta.25](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.24...example@1.0.0-beta.25) (2022-05-04)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.12
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.16
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.11

# example [1.0.0-beta.24](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.23...example@1.0.0-beta.24) (2022-05-03)


### Features

* **example:** add custom connector ([#261](https://github.com/ForestAdmin/agent-nodejs/issues/261)) ([69e04de](https://github.com/ForestAdmin/agent-nodejs/commit/69e04ded95a3b528acc07a4463eacd4b7c5a5a2b))

# example [1.0.0-beta.23](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.22...example@1.0.0-beta.23) (2022-04-29)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.11
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.16
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.15
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.10

# example [1.0.0-beta.22](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.21...example@1.0.0-beta.22) (2022-04-29)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.16
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.10
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.15
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.14
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.9

# example [1.0.0-beta.21](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.20...example@1.0.0-beta.21) (2022-04-28)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.15

# example [1.0.0-beta.20](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.19...example@1.0.0-beta.20) (2022-04-28)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.14
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.9
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.14
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.13
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.8

# example [1.0.0-beta.19](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.18...example@1.0.0-beta.19) (2022-04-28)


### Bug Fixes

* **example:** the imports in the seed to prepare the dbs ([#273](https://github.com/ForestAdmin/agent-nodejs/issues/273)) ([95891b7](https://github.com/ForestAdmin/agent-nodejs/commit/95891b7a7c884bc6ef7403dcea82f3cb2c40890c))

# example [1.0.0-beta.18](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.17...example@1.0.0-beta.18) (2022-04-27)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.13

# example [1.0.0-beta.17](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.16...example@1.0.0-beta.17) (2022-04-27)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.12

# example [1.0.0-beta.16](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.15...example@1.0.0-beta.16) (2022-04-26)


### Bug Fixes

* example project write override uses an outdated handler prototype ([#267](https://github.com/ForestAdmin/agent-nodejs/issues/267)) ([c32e212](https://github.com/ForestAdmin/agent-nodejs/commit/c32e21245d1703b599f474dfddfc5888e1a6fc77))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.11

# example [1.0.0-beta.15](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.14...example@1.0.0-beta.15) (2022-04-26)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.13
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.12
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.16

# example [1.0.0-beta.14](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.13...example@1.0.0-beta.14) (2022-04-26)


### Features

* give access to logged in user to customization context ([#253](https://github.com/ForestAdmin/agent-nodejs/issues/253)) ([be97812](https://github.com/ForestAdmin/agent-nodejs/commit/be978121e47ab06c7a50cc6dec0cdb9284ea9d96))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.10
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.8
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.12
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.11
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.15
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.7

# example [1.0.0-beta.13](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.12...example@1.0.0-beta.13) (2022-04-25)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.11
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.10
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.14

# example [1.0.0-beta.12](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.11...example@1.0.0-beta.12) (2022-04-25)


### Bug Fixes

* import packages from js ([#260](https://github.com/ForestAdmin/agent-nodejs/issues/260)) ([de00886](https://github.com/ForestAdmin/agent-nodejs/commit/de008862971ea5d3559e5a4c3136b0dd2161d760))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.9
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.7
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.10
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.9
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.13

# example [1.0.0-beta.11](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.10...example@1.0.0-beta.11) (2022-04-21)


### Features

* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.8
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.6
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.9
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.8
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.12
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.6

# example [1.0.0-beta.10](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.9...example@1.0.0-beta.10) (2022-04-21)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.7

# example [1.0.0-beta.9](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.8...example@1.0.0-beta.9) (2022-04-21)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.11

# example [1.0.0-beta.8](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.7...example@1.0.0-beta.8) (2022-04-20)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.10

# example [1.0.0-beta.7](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.6...example@1.0.0-beta.7) (2022-04-20)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.8
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.7
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.9

# example [1.0.0-beta.6](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.5...example@1.0.0-beta.6) (2022-04-19)


### Bug Fixes

* leaderboard chart and aggregation emulation ([#241](https://github.com/ForestAdmin/agent-nodejs/issues/241)) ([d2015d7](https://github.com/ForestAdmin/agent-nodejs/commit/d2015d7f82fe6a42b36d797d6e5945b0b8f1c6ba))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.6
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.5
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.7
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.6
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.8
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.5

# example [1.0.0-beta.5](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.4...example@1.0.0-beta.5) (2022-04-19)





### Dependencies

* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.6
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.5
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.7

# example [1.0.0-beta.4](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.3...example@1.0.0-beta.4) (2022-04-19)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.5

# example [1.0.0-beta.3](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.2...example@1.0.0-beta.3) (2022-04-15)


### Features

* **datasource sql:** handle primitive fields and default values ([#215](https://github.com/ForestAdmin/agent-nodejs/issues/215)) ([59a56da](https://github.com/ForestAdmin/agent-nodejs/commit/59a56da2721f39d0487b14d72b11d71b38b83a1f))





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.6

# example [1.0.0-beta.2](https://github.com/ForestAdmin/agent-nodejs/compare/example@1.0.0-beta.1...example@1.0.0-beta.2) (2022-04-15)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.0.0-beta.4
* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.5
* **@forestadmin/datasource-dummy:** upgraded to 1.0.0-beta.4
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.5
* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.4
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.4

# example 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* action "select all + apply" are applied only on the related data ([#209](https://github.com/ForestAdmin/agent-nodejs/issues/209)) ([974054c](https://github.com/ForestAdmin/agent-nodejs/commit/974054c431700c98a73177dfe5cbd0d1bf564e9c))
* codelimate configuration to remove _example directory to the coverage ([#177](https://github.com/ForestAdmin/agent-nodejs/issues/177)) ([50862da](https://github.com/ForestAdmin/agent-nodejs/commit/50862da06cf8d3a9bb8bbc86c78499d8e35f4d77))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* improve relation schema creation ([#238](https://github.com/ForestAdmin/agent-nodejs/issues/238)) ([cf9bfbf](https://github.com/ForestAdmin/agent-nodejs/commit/cf9bfbf83ea27c56eadbeb87a2d16cb1b66b355e))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* **datasource sequelize:** enable date filter ([#166](https://github.com/ForestAdmin/agent-nodejs/issues/166)) ([5f0e349](https://github.com/ForestAdmin/agent-nodejs/commit/5f0e3494dbb254ef5351e0c85061ce196d8c2f9b))
* **search:** stop generating invalid condition trees ([#109](https://github.com/ForestAdmin/agent-nodejs/issues/109)) ([9a2bf38](https://github.com/ForestAdmin/agent-nodejs/commit/9a2bf3858b8f9309947f68ce7717c288a8072edc))


### Features

* remove toolkit from customer code ([#229](https://github.com/ForestAdmin/agent-nodejs/issues/229)) ([1421c6d](https://github.com/ForestAdmin/agent-nodejs/commit/1421c6d8798ff92aada3fbfdfa2c95ee2429714b))
* **builder:** add emulateFieldFiltering method and simplify addField ([#227](https://github.com/ForestAdmin/agent-nodejs/issues/227)) ([bbb7603](https://github.com/ForestAdmin/agent-nodejs/commit/bbb7603b3e9847e8f4e9788dca67e0a3cf2d1e83))
* **datasource sequelize:** handle enum field type ([#193](https://github.com/ForestAdmin/agent-nodejs/issues/193)) ([04cc0f5](https://github.com/ForestAdmin/agent-nodejs/commit/04cc0f528b10f298b08d78e89e8f553b5e1a08e1))
* **decorator:** write emulate ([#157](https://github.com/ForestAdmin/agent-nodejs/issues/157)) ([6c7f5f6](https://github.com/ForestAdmin/agent-nodejs/commit/6c7f5f6daed7e9f51b3068ebca5ac49a9a6e01d8))
* **route:** link record from 'toMany' association ([#230](https://github.com/ForestAdmin/agent-nodejs/issues/230)) ([8900cbd](https://github.com/ForestAdmin/agent-nodejs/commit/8900cbda88afdd73b19a8e136cd964af671650bb))
* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* add default and validation to agent options ([#98](https://github.com/ForestAdmin/agent-nodejs/issues/98)) ([50f7b22](https://github.com/ForestAdmin/agent-nodejs/commit/50f7b2262f3ed1d1236326f20cacf8c36fee9a56))
* add jointure decorator ([#158](https://github.com/ForestAdmin/agent-nodejs/issues/158)) ([e8d8e95](https://github.com/ForestAdmin/agent-nodejs/commit/e8d8e95d6d92e9378ca0de5d7efb12a8bd04a21e))
* agent builder ([#146](https://github.com/ForestAdmin/agent-nodejs/issues/146)) ([678a8f7](https://github.com/ForestAdmin/agent-nodejs/commit/678a8f7b9b3204c811a5c1f2ee46287efdc84dd6))
* implement condition tree equivalents ([#71](https://github.com/ForestAdmin/agent-nodejs/issues/71)) ([d434eb2](https://github.com/ForestAdmin/agent-nodejs/commit/d434eb294b159f91747e4d78e737f5bd32ffb147))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* add record serializer ([#14](https://github.com/ForestAdmin/agent-nodejs/issues/14)) ([5ddeb30](https://github.com/ForestAdmin/agent-nodejs/commit/5ddeb306c8758d5533f406f8134b53ccd3a380b8))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* implement schema sender ([#36](https://github.com/ForestAdmin/agent-nodejs/issues/36)) ([89a7203](https://github.com/ForestAdmin/agent-nodejs/commit/89a72032a11c74cd41566862ac6d971003db0fd0))
* load all decorators in the project example ([#89](https://github.com/ForestAdmin/agent-nodejs/issues/89)) ([dd73b05](https://github.com/ForestAdmin/agent-nodejs/commit/dd73b0548eb25dc5108bb0a55b42b922c0414264))
* **security:** handle oidc authentication ([#23](https://github.com/ForestAdmin/agent-nodejs/issues/23)) ([17cd48e](https://github.com/ForestAdmin/agent-nodejs/commit/17cd48eb583763975a99835ef74438f7908923ca))





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.0.0-beta.4
* **@forestadmin/datasource-live:** upgraded to 1.0.0-beta.4
