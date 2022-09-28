# @forestadmin/datasource-sequelize 1.0.0-alpha.1 (2022-09-28)


### Bug Fixes

* inverted keys in sequelize belongs to many ([#409](https://github.com/ForestAdmin/agent-nodejs/issues/409)) ([4adb3a2](https://github.com/ForestAdmin/agent-nodejs/commit/4adb3a244efb0842c475fcbdf4a5f38552a6b7df))
* update code and sequelize version to avoid crash ([#374](https://github.com/ForestAdmin/agent-nodejs/issues/374)) ([e003416](https://github.com/ForestAdmin/agent-nodejs/commit/e0034166b86e48781ea099086fd93aa7c68dba03))
* **datasource sequelize:** aggregation get correctly nested relation ([#349](https://github.com/ForestAdmin/agent-nodejs/issues/349)) ([f9f89cd](https://github.com/ForestAdmin/agent-nodejs/commit/f9f89cd9d21d2cc8195d3aa04c33a6c2b76986e4))
* **datasource-sequelize:** serialize record to transform date to iso string  ([#331](https://github.com/ForestAdmin/agent-nodejs/issues/331)) ([70216bb](https://github.com/ForestAdmin/agent-nodejs/commit/70216bb7fc5307e458ee5651e9f16c90b61ff49a))
* datasource naming consistency ([#292](https://github.com/ForestAdmin/agent-nodejs/issues/292)) ([ff50a1f](https://github.com/ForestAdmin/agent-nodejs/commit/ff50a1f02aa65b3d99824c2bc9fb19d729a4e465))
* **datasource sequelize:**  build a correct where clause when there is relation on delete and update ([#242](https://github.com/ForestAdmin/agent-nodejs/issues/242)) ([75061d4](https://github.com/ForestAdmin/agent-nodejs/commit/75061d447878cd8f32f1fd5bcc245a2791ba0b0a))
* **datasource sequelize:** all field are sortable ([#262](https://github.com/ForestAdmin/agent-nodejs/issues/262)) ([8d85346](https://github.com/ForestAdmin/agent-nodejs/commit/8d8534662bc058466901095a0c0d82e06d2f13b0))
* error when count or list does not match any records ([#223](https://github.com/ForestAdmin/agent-nodejs/issues/223)) ([e51dad6](https://github.com/ForestAdmin/agent-nodejs/commit/e51dad6f9fce502405fbd95300f27f7d25945de5))
* handle json type and default value ([#237](https://github.com/ForestAdmin/agent-nodejs/issues/237)) ([1e20364](https://github.com/ForestAdmin/agent-nodejs/commit/1e2036455ce9a5376bbe1102d9bbb05f034962f5))
* import packages from js ([#260](https://github.com/ForestAdmin/agent-nodejs/issues/260)) ([de00886](https://github.com/ForestAdmin/agent-nodejs/commit/de008862971ea5d3559e5a4c3136b0dd2161d760))
* **datasource sequelize:** add include from sort relation for list ([#243](https://github.com/ForestAdmin/agent-nodejs/issues/243)) ([5a81bc0](https://github.com/ForestAdmin/agent-nodejs/commit/5a81bc04e969442dd38d251be0a48c7bce2dc43e))
* **datasource sequelize:** type converter compute correctly type from sequelize DataTypes ([#246](https://github.com/ForestAdmin/agent-nodejs/issues/246)) ([92fc238](https://github.com/ForestAdmin/agent-nodejs/commit/92fc23841c25c502f44fd90c5e68f864ecc6727b))
* correct versions in package.json of all datasources ([540d395](https://github.com/ForestAdmin/agent-nodejs/commit/540d395bc5e42bdd7edb3dce5806ade8554f3d7a))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* **datasource sequelize:** compute where correctly ([#239](https://github.com/ForestAdmin/agent-nodejs/issues/239)) ([ee770ba](https://github.com/ForestAdmin/agent-nodejs/commit/ee770bafe8b6a8ebe542bac3e664a47b4d0c7151))
* select-all when delete-all action is triggered ([#220](https://github.com/ForestAdmin/agent-nodejs/issues/220)) ([23ef123](https://github.com/ForestAdmin/agent-nodejs/commit/23ef1232d56bc250a3a18257de8ed74bdbdf920b))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* **datasource sequelize:** enable date filter ([#166](https://github.com/ForestAdmin/agent-nodejs/issues/166)) ([5f0e349](https://github.com/ForestAdmin/agent-nodejs/commit/5f0e3494dbb254ef5351e0c85061ce196d8c2f9b))
* **datasource sequelize:** search like operators is now insensitive ([#175](https://github.com/ForestAdmin/agent-nodejs/issues/175)) ([4660c13](https://github.com/ForestAdmin/agent-nodejs/commit/4660c131e398a151fc2a98c8f7e4e817fd427e63))
* **datasource,sequelize:** only keep grouped field in order clause for aggregate ([#102](https://github.com/ForestAdmin/agent-nodejs/issues/102)) ([6f0d1dd](https://github.com/ForestAdmin/agent-nodejs/commit/6f0d1dd4df4dc94739c40271afb55aa6928eca1b))
* **datasource,sequelize:** properly handle array operators ([#100](https://github.com/ForestAdmin/agent-nodejs/issues/100)) ([dd061df](https://github.com/ForestAdmin/agent-nodejs/commit/dd061df90bb35b130cd6e98f8de8e321f1a53964))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))


### Features

* **sequelize:** improve constraints error handling ([#390](https://github.com/ForestAdmin/agent-nodejs/issues/390)) ([c03e342](https://github.com/ForestAdmin/agent-nodejs/commit/c03e342adb07eb502d5b061db48ef0d783d64cba))
* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))
* **search:** add support for case sensitive/insensitive search ([#315](https://github.com/ForestAdmin/agent-nodejs/issues/315)) ([b6fe544](https://github.com/ForestAdmin/agent-nodejs/commit/b6fe544cf546724f62386f4df661982e62cf714e))
* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* autocomplete on field names ([#263](https://github.com/ForestAdmin/agent-nodejs/issues/263)) ([e2025d5](https://github.com/ForestAdmin/agent-nodejs/commit/e2025d57d930edf6d326bd0c6d7fffcd4aad728d))
* give access to logged in user to customization context ([#253](https://github.com/ForestAdmin/agent-nodejs/issues/253)) ([be97812](https://github.com/ForestAdmin/agent-nodejs/commit/be978121e47ab06c7a50cc6dec0cdb9284ea9d96))
* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **datasource sequelize:** handle date aggregation ([#133](https://github.com/ForestAdmin/agent-nodejs/issues/133)) ([09158a5](https://github.com/ForestAdmin/agent-nodejs/commit/09158a54da2114276d2c7edc9957ea396f700fa0))
* **datasource sequelize:** handle enum field type ([#193](https://github.com/ForestAdmin/agent-nodejs/issues/193)) ([04cc0f5](https://github.com/ForestAdmin/agent-nodejs/commit/04cc0f528b10f298b08d78e89e8f553b5e1a08e1))
* **datasource sequelize:** handle isReadOnly property based on autoIncrement ([#194](https://github.com/ForestAdmin/agent-nodejs/issues/194)) ([28b8e69](https://github.com/ForestAdmin/agent-nodejs/commit/28b8e69b363c125bff5f58a199209bda6bf16557))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
* **datasource,live:** initial version for Live DataSource ([#67](https://github.com/ForestAdmin/agent-nodejs/issues/67)) ([e4ffa52](https://github.com/ForestAdmin/agent-nodejs/commit/e4ffa52c0f2146b73522ed705003018b3d4da758))
* **datasource,sequelize:** handle array types from Sequelize ([#104](https://github.com/ForestAdmin/agent-nodejs/issues/104)) ([58fc4dd](https://github.com/ForestAdmin/agent-nodejs/commit/58fc4dd661d112ce6462357374cc2380a3059292))
* **datasource,sequelize:** initial version for Sequelize DataSource ([#63](https://github.com/ForestAdmin/agent-nodejs/issues/63)) ([66ba46e](https://github.com/ForestAdmin/agent-nodejs/commit/66ba46e66b73a2611061125a7e14c88283c3489d))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.1

# @forestadmin/datasource-sequelize [1.0.0-beta.44](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.43...@forestadmin/datasource-sequelize@1.0.0-beta.44) (2022-09-22)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.34

# @forestadmin/datasource-sequelize [1.0.0-beta.43](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.42...@forestadmin/datasource-sequelize@1.0.0-beta.43) (2022-09-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.33

# @forestadmin/datasource-sequelize [1.0.0-beta.42](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.41...@forestadmin/datasource-sequelize@1.0.0-beta.42) (2022-09-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.32

# @forestadmin/datasource-sequelize [1.0.0-beta.41](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.40...@forestadmin/datasource-sequelize@1.0.0-beta.41) (2022-09-08)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.31

# @forestadmin/datasource-sequelize [1.0.0-beta.40](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.39...@forestadmin/datasource-sequelize@1.0.0-beta.40) (2022-09-07)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.30

# @forestadmin/datasource-sequelize [1.0.0-beta.39](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.38...@forestadmin/datasource-sequelize@1.0.0-beta.39) (2022-09-07)


### Bug Fixes

* inverted keys in sequelize belongs to many ([#409](https://github.com/ForestAdmin/agent-nodejs/issues/409)) ([4adb3a2](https://github.com/ForestAdmin/agent-nodejs/commit/4adb3a244efb0842c475fcbdf4a5f38552a6b7df))

# @forestadmin/datasource-sequelize [1.0.0-beta.38](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.37...@forestadmin/datasource-sequelize@1.0.0-beta.38) (2022-09-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.29

# @forestadmin/datasource-sequelize [1.0.0-beta.37](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.36...@forestadmin/datasource-sequelize@1.0.0-beta.37) (2022-09-05)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.28

# @forestadmin/datasource-sequelize [1.0.0-beta.36](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.35...@forestadmin/datasource-sequelize@1.0.0-beta.36) (2022-08-23)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.27

# @forestadmin/datasource-sequelize [1.0.0-beta.35](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.34...@forestadmin/datasource-sequelize@1.0.0-beta.35) (2022-08-23)


### Features

* **sequelize:** improve constraints error handling ([#390](https://github.com/ForestAdmin/agent-nodejs/issues/390)) ([c03e342](https://github.com/ForestAdmin/agent-nodejs/commit/c03e342adb07eb502d5b061db48ef0d783d64cba))

# @forestadmin/datasource-sequelize [1.0.0-beta.34](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.33...@forestadmin/datasource-sequelize@1.0.0-beta.34) (2022-07-25)


### Bug Fixes

* update code and sequelize version to avoid crash ([#374](https://github.com/ForestAdmin/agent-nodejs/issues/374)) ([e003416](https://github.com/ForestAdmin/agent-nodejs/commit/e0034166b86e48781ea099086fd93aa7c68dba03))

# @forestadmin/datasource-sequelize [1.0.0-beta.33](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.32...@forestadmin/datasource-sequelize@1.0.0-beta.33) (2022-06-27)


### Bug Fixes

* **datasource sequelize:** aggregation get correctly nested relation ([#349](https://github.com/ForestAdmin/agent-nodejs/issues/349)) ([f9f89cd](https://github.com/ForestAdmin/agent-nodejs/commit/f9f89cd9d21d2cc8195d3aa04c33a6c2b76986e4))

# @forestadmin/datasource-sequelize [1.0.0-beta.32](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.31...@forestadmin/datasource-sequelize@1.0.0-beta.32) (2022-06-16)


### Bug Fixes

* **datasource-sequelize:** serialize record to transform date to iso string  ([#331](https://github.com/ForestAdmin/agent-nodejs/issues/331)) ([70216bb](https://github.com/ForestAdmin/agent-nodejs/commit/70216bb7fc5307e458ee5651e9f16c90b61ff49a))

# @forestadmin/datasource-sequelize [1.0.0-beta.31](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.30...@forestadmin/datasource-sequelize@1.0.0-beta.31) (2022-06-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.26

# @forestadmin/datasource-sequelize [1.0.0-beta.30](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.29...@forestadmin/datasource-sequelize@1.0.0-beta.30) (2022-06-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.25

# @forestadmin/datasource-sequelize [1.0.0-beta.29](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.28...@forestadmin/datasource-sequelize@1.0.0-beta.29) (2022-06-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.24

# @forestadmin/datasource-sequelize [1.0.0-beta.28](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.27...@forestadmin/datasource-sequelize@1.0.0-beta.28) (2022-06-14)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.23

# @forestadmin/datasource-sequelize [1.0.0-beta.27](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.26...@forestadmin/datasource-sequelize@1.0.0-beta.27) (2022-06-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.22

# @forestadmin/datasource-sequelize [1.0.0-beta.26](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.25...@forestadmin/datasource-sequelize@1.0.0-beta.26) (2022-06-01)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.21

# @forestadmin/datasource-sequelize [1.0.0-beta.25](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.24...@forestadmin/datasource-sequelize@1.0.0-beta.25) (2022-05-31)


### Features

* make count an optional feature ([#327](https://github.com/ForestAdmin/agent-nodejs/issues/327)) ([b6f688c](https://github.com/ForestAdmin/agent-nodejs/commit/b6f688ca5f84aa29740761ff848c4beca5ee61d6))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.20

# @forestadmin/datasource-sequelize [1.0.0-beta.24](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.23...@forestadmin/datasource-sequelize@1.0.0-beta.24) (2022-05-25)


### Features

* **search:** add support for case sensitive/insensitive search ([#315](https://github.com/ForestAdmin/agent-nodejs/issues/315)) ([b6fe544](https://github.com/ForestAdmin/agent-nodejs/commit/b6fe544cf546724f62386f4df661982e62cf714e))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.19

# @forestadmin/datasource-sequelize [1.0.0-beta.23](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.22...@forestadmin/datasource-sequelize@1.0.0-beta.23) (2022-05-24)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.18

# @forestadmin/datasource-sequelize [1.0.0-beta.22](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.21...@forestadmin/datasource-sequelize@1.0.0-beta.22) (2022-05-24)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.17

# @forestadmin/datasource-sequelize [1.0.0-beta.21](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.20...@forestadmin/datasource-sequelize@1.0.0-beta.21) (2022-05-16)


### Features

* autocomplete on field names ([#263](https://github.com/ForestAdmin/agent-nodejs/issues/263)) ([e2025d5](https://github.com/ForestAdmin/agent-nodejs/commit/e2025d57d930edf6d326bd0c6d7fffcd4aad728d))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.16

# @forestadmin/datasource-sequelize [1.0.0-beta.20](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.19...@forestadmin/datasource-sequelize@1.0.0-beta.20) (2022-05-12)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.15

# @forestadmin/datasource-sequelize [1.0.0-beta.19](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.18...@forestadmin/datasource-sequelize@1.0.0-beta.19) (2022-05-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.14

# @forestadmin/datasource-sequelize [1.0.0-beta.18](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.17...@forestadmin/datasource-sequelize@1.0.0-beta.18) (2022-05-09)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.13

# @forestadmin/datasource-sequelize [1.0.0-beta.17](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.16...@forestadmin/datasource-sequelize@1.0.0-beta.17) (2022-05-09)


### Bug Fixes

* datasource naming consistency ([#292](https://github.com/ForestAdmin/agent-nodejs/issues/292)) ([ff50a1f](https://github.com/ForestAdmin/agent-nodejs/commit/ff50a1f02aa65b3d99824c2bc9fb19d729a4e465))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.12

# @forestadmin/datasource-sequelize [1.0.0-beta.16](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.15...@forestadmin/datasource-sequelize@1.0.0-beta.16) (2022-05-04)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.11

# @forestadmin/datasource-sequelize [1.0.0-beta.15](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.14...@forestadmin/datasource-sequelize@1.0.0-beta.15) (2022-04-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.10

# @forestadmin/datasource-sequelize [1.0.0-beta.14](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.13...@forestadmin/datasource-sequelize@1.0.0-beta.14) (2022-04-29)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.9

# @forestadmin/datasource-sequelize [1.0.0-beta.13](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.12...@forestadmin/datasource-sequelize@1.0.0-beta.13) (2022-04-28)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.8

# @forestadmin/datasource-sequelize [1.0.0-beta.12](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.11...@forestadmin/datasource-sequelize@1.0.0-beta.12) (2022-04-26)


### Bug Fixes

* **datasource sequelize:**  build a correct where clause when there is relation on delete and update ([#242](https://github.com/ForestAdmin/agent-nodejs/issues/242)) ([75061d4](https://github.com/ForestAdmin/agent-nodejs/commit/75061d447878cd8f32f1fd5bcc245a2791ba0b0a))

# @forestadmin/datasource-sequelize [1.0.0-beta.11](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.10...@forestadmin/datasource-sequelize@1.0.0-beta.11) (2022-04-26)


### Features

* give access to logged in user to customization context ([#253](https://github.com/ForestAdmin/agent-nodejs/issues/253)) ([be97812](https://github.com/ForestAdmin/agent-nodejs/commit/be978121e47ab06c7a50cc6dec0cdb9284ea9d96))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.7

# @forestadmin/datasource-sequelize [1.0.0-beta.10](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.9...@forestadmin/datasource-sequelize@1.0.0-beta.10) (2022-04-25)


### Bug Fixes

* **datasource sequelize:** all field are sortable ([#262](https://github.com/ForestAdmin/agent-nodejs/issues/262)) ([8d85346](https://github.com/ForestAdmin/agent-nodejs/commit/8d8534662bc058466901095a0c0d82e06d2f13b0))

# @forestadmin/datasource-sequelize [1.0.0-beta.9](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.8...@forestadmin/datasource-sequelize@1.0.0-beta.9) (2022-04-25)


### Bug Fixes

* import packages from js ([#260](https://github.com/ForestAdmin/agent-nodejs/issues/260)) ([de00886](https://github.com/ForestAdmin/agent-nodejs/commit/de008862971ea5d3559e5a4c3136b0dd2161d760))

# @forestadmin/datasource-sequelize [1.0.0-beta.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.7...@forestadmin/datasource-sequelize@1.0.0-beta.8) (2022-04-21)


### Features

* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.6

# @forestadmin/datasource-sequelize [1.0.0-beta.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.6...@forestadmin/datasource-sequelize@1.0.0-beta.7) (2022-04-20)


### Bug Fixes

* **datasource sequelize:** add include from sort relation for list ([#243](https://github.com/ForestAdmin/agent-nodejs/issues/243)) ([5a81bc0](https://github.com/ForestAdmin/agent-nodejs/commit/5a81bc04e969442dd38d251be0a48c7bce2dc43e))

# @forestadmin/datasource-sequelize [1.0.0-beta.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.5...@forestadmin/datasource-sequelize@1.0.0-beta.6) (2022-04-19)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.5

# @forestadmin/datasource-sequelize [1.0.0-beta.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.4...@forestadmin/datasource-sequelize@1.0.0-beta.5) (2022-04-19)


### Bug Fixes

* **datasource sequelize:** type converter compute correctly type from sequelize DataTypes ([#246](https://github.com/ForestAdmin/agent-nodejs/issues/246)) ([92fc238](https://github.com/ForestAdmin/agent-nodejs/commit/92fc23841c25c502f44fd90c5e68f864ecc6727b))

# @forestadmin/datasource-sequelize [1.0.0-beta.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.3...@forestadmin/datasource-sequelize@1.0.0-beta.4) (2022-04-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.4

# @forestadmin/datasource-sequelize [1.0.0-beta.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.2...@forestadmin/datasource-sequelize@1.0.0-beta.3) (2022-04-15)


### Bug Fixes

* correct versions in package.json of all datasources ([540d395](https://github.com/ForestAdmin/agent-nodejs/commit/540d395bc5e42bdd7edb3dce5806ade8554f3d7a))

# @forestadmin/datasource-sequelize [1.0.0-beta.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sequelize@1.0.0-beta.1...@forestadmin/datasource-sequelize@1.0.0-beta.2) (2022-04-15)





### Dependencies

* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.3

# @forestadmin/datasource-sequelize 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* **datasource sequelize:** compute where correctly ([#239](https://github.com/ForestAdmin/agent-nodejs/issues/239)) ([ee770ba](https://github.com/ForestAdmin/agent-nodejs/commit/ee770bafe8b6a8ebe542bac3e664a47b4d0c7151))
* **datasource sequelize:** enable date filter ([#166](https://github.com/ForestAdmin/agent-nodejs/issues/166)) ([5f0e349](https://github.com/ForestAdmin/agent-nodejs/commit/5f0e3494dbb254ef5351e0c85061ce196d8c2f9b))
* **datasource sequelize:** search like operators is now insensitive ([#175](https://github.com/ForestAdmin/agent-nodejs/issues/175)) ([4660c13](https://github.com/ForestAdmin/agent-nodejs/commit/4660c131e398a151fc2a98c8f7e4e817fd427e63))
* **datasource,sequelize:** only keep grouped field in order clause for aggregate ([#102](https://github.com/ForestAdmin/agent-nodejs/issues/102)) ([6f0d1dd](https://github.com/ForestAdmin/agent-nodejs/commit/6f0d1dd4df4dc94739c40271afb55aa6928eca1b))
* **datasource,sequelize:** properly handle array operators ([#100](https://github.com/ForestAdmin/agent-nodejs/issues/100)) ([dd061df](https://github.com/ForestAdmin/agent-nodejs/commit/dd061df90bb35b130cd6e98f8de8e321f1a53964))
* **datasource:** properly set column FilterOperator values ([#117](https://github.com/ForestAdmin/agent-nodejs/issues/117)) ([92174a5](https://github.com/ForestAdmin/agent-nodejs/commit/92174a5f9016e8e54bed854979b0d7c408f11cae))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* error when count or list does not match any records ([#223](https://github.com/ForestAdmin/agent-nodejs/issues/223)) ([e51dad6](https://github.com/ForestAdmin/agent-nodejs/commit/e51dad6f9fce502405fbd95300f27f7d25945de5))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* handle json type and default value ([#237](https://github.com/ForestAdmin/agent-nodejs/issues/237)) ([1e20364](https://github.com/ForestAdmin/agent-nodejs/commit/1e2036455ce9a5376bbe1102d9bbb05f034962f5))
* select-all when delete-all action is triggered ([#220](https://github.com/ForestAdmin/agent-nodejs/issues/220)) ([23ef123](https://github.com/ForestAdmin/agent-nodejs/commit/23ef1232d56bc250a3a18257de8ed74bdbdf920b))
* tests were not compiled ([#7](https://github.com/ForestAdmin/agent-nodejs/issues/7)) ([9f2525d](https://github.com/ForestAdmin/agent-nodejs/commit/9f2525dfe6753471b13296899038df27ca1f28be))


### Features

* add action routes and decorator ([#149](https://github.com/ForestAdmin/agent-nodejs/issues/149)) ([ebf27ff](https://github.com/ForestAdmin/agent-nodejs/commit/ebf27ffb439f5f2c983fe8873a515fe2802a9a17))
* bootstrap agent package ([#12](https://github.com/ForestAdmin/agent-nodejs/issues/12)) ([182c858](https://github.com/ForestAdmin/agent-nodejs/commit/182c858b6d912dba37fe821cc6baaad75b80c59d))
* **condition-tree:** implement user filters and better emulation ([#76](https://github.com/ForestAdmin/agent-nodejs/issues/76)) ([e425704](https://github.com/ForestAdmin/agent-nodejs/commit/e4257046853b2b165f4190daa0d953d7f79ed837))
* **datasource sequelize:** handle date aggregation ([#133](https://github.com/ForestAdmin/agent-nodejs/issues/133)) ([09158a5](https://github.com/ForestAdmin/agent-nodejs/commit/09158a54da2114276d2c7edc9957ea396f700fa0))
* **datasource sequelize:** handle enum field type ([#193](https://github.com/ForestAdmin/agent-nodejs/issues/193)) ([04cc0f5](https://github.com/ForestAdmin/agent-nodejs/commit/04cc0f528b10f298b08d78e89e8f553b5e1a08e1))
* **datasource sequelize:** handle isReadOnly property based on autoIncrement ([#194](https://github.com/ForestAdmin/agent-nodejs/issues/194)) ([28b8e69](https://github.com/ForestAdmin/agent-nodejs/commit/28b8e69b363c125bff5f58a199209bda6bf16557))
* **datasource,live:** initial version for Live DataSource ([#67](https://github.com/ForestAdmin/agent-nodejs/issues/67)) ([e4ffa52](https://github.com/ForestAdmin/agent-nodejs/commit/e4ffa52c0f2146b73522ed705003018b3d4da758))
* **datasource,sequelize:** handle array types from Sequelize ([#104](https://github.com/ForestAdmin/agent-nodejs/issues/104)) ([58fc4dd](https://github.com/ForestAdmin/agent-nodejs/commit/58fc4dd661d112ce6462357374cc2380a3059292))
* **datasource,sequelize:** initial version for Sequelize DataSource ([#63](https://github.com/ForestAdmin/agent-nodejs/issues/63)) ([66ba46e](https://github.com/ForestAdmin/agent-nodejs/commit/66ba46e66b73a2611061125a7e14c88283c3489d))
* **example,live:** update example package to use Live DataSource ([#69](https://github.com/ForestAdmin/agent-nodejs/issues/69)) ([340d2a0](https://github.com/ForestAdmin/agent-nodejs/commit/340d2a08ea945169dd8c7547a5995bb7dd531fc5))
* implement relations using any unique key ([#159](https://github.com/ForestAdmin/agent-nodejs/issues/159)) ([b6be495](https://github.com/ForestAdmin/agent-nodejs/commit/b6be495d93ae03a67c6dc9b4ffbb0ae9f4cbc0bc))
