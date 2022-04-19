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
