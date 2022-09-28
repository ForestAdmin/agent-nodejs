# @forestadmin/datasource-sql [1.0.0-alpha.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-alpha.1...@forestadmin/datasource-sql@1.0.0-alpha.2) (2022-09-28)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-alpha.2
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.2

# @forestadmin/datasource-sql 1.0.0-alpha.1 (2022-09-28)


### Bug Fixes

* **datasource-sql:** skip models which do not have primary keys ([#393](https://github.com/ForestAdmin/agent-nodejs/issues/393)) ([820fbe9](https://github.com/ForestAdmin/agent-nodejs/commit/820fbe9087ec9977fc998363016ce1728438c8f2))
* update code and sequelize version to avoid crash ([#374](https://github.com/ForestAdmin/agent-nodejs/issues/374)) ([e003416](https://github.com/ForestAdmin/agent-nodejs/commit/e0034166b86e48781ea099086fd93aa7c68dba03))
* **datasource sql:** has one detection ([#254](https://github.com/ForestAdmin/agent-nodejs/issues/254)) ([68e68b3](https://github.com/ForestAdmin/agent-nodejs/commit/68e68b33063ba7bbfb9cfc747572f59953b64050))
* **datasource sql:** throw an user friendly error when the provided connection uri is invalid ([#297](https://github.com/ForestAdmin/agent-nodejs/issues/297)) ([db1ac83](https://github.com/ForestAdmin/agent-nodejs/commit/db1ac83d3ef023c7875e4affbaecdc52de1e5fc3))
* **patch-package:** remove feature change on sequelize patch ([#356](https://github.com/ForestAdmin/agent-nodejs/issues/356)) ([ac3d7d5](https://github.com/ForestAdmin/agent-nodejs/commit/ac3d7d583c65b392fe668225ebcd9b63729f9f23))
* correct versions in package.json of all datasources ([540d395](https://github.com/ForestAdmin/agent-nodejs/commit/540d395bc5e42bdd7edb3dce5806ade8554f3d7a))
* datasource naming consistency ([#292](https://github.com/ForestAdmin/agent-nodejs/issues/292)) ([ff50a1f](https://github.com/ForestAdmin/agent-nodejs/commit/ff50a1f02aa65b3d99824c2bc9fb19d729a4e465))
* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))
* import packages from js ([#260](https://github.com/ForestAdmin/agent-nodejs/issues/260)) ([de00886](https://github.com/ForestAdmin/agent-nodejs/commit/de008862971ea5d3559e5a4c3136b0dd2161d760))
* switched from qiwi to dhoulb version of msr ([020c3e0](https://github.com/ForestAdmin/agent-nodejs/commit/020c3e04c64164c3f26aae293989db7842f82e8c))


### Features

* **datasource-sql:** allow skipping database introspection ([#434](https://github.com/ForestAdmin/agent-nodejs/issues/434)) ([a5c70d1](https://github.com/ForestAdmin/agent-nodejs/commit/a5c70d113b6c2d28b56ce803be7c1851b99a2db9))
* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))
* **datasource sql:** handle primitive fields and default values ([#215](https://github.com/ForestAdmin/agent-nodejs/issues/215)) ([59a56da](https://github.com/ForestAdmin/agent-nodejs/commit/59a56da2721f39d0487b14d72b11d71b38b83a1f))
* **datasource sql:** handle relations ([#224](https://github.com/ForestAdmin/agent-nodejs/issues/224)) ([275cf7e](https://github.com/ForestAdmin/agent-nodejs/commit/275cf7ed6835933fce418f92a6a4e2521a9721fe))


### Performance Improvements

* **datasource-sql:** query structure, indexes and references in parallel ([#419](https://github.com/ForestAdmin/agent-nodejs/issues/419)) ([f08e48a](https://github.com/ForestAdmin/agent-nodejs/commit/f08e48a948c5f85b37ba85e165299ea44fda9fb6))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-alpha.1
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-alpha.1

# @forestadmin/datasource-sql [1.0.0-beta.53](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.52...@forestadmin/datasource-sql@1.0.0-beta.53) (2022-09-27)


### Features

* **datasource-sql:** allow skipping database introspection ([#434](https://github.com/ForestAdmin/agent-nodejs/issues/434)) ([a5c70d1](https://github.com/ForestAdmin/agent-nodejs/commit/a5c70d113b6c2d28b56ce803be7c1851b99a2db9))

# @forestadmin/datasource-sql [1.0.0-beta.52](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.51...@forestadmin/datasource-sql@1.0.0-beta.52) (2022-09-22)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.44
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.34

# @forestadmin/datasource-sql [1.0.0-beta.51](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.50...@forestadmin/datasource-sql@1.0.0-beta.51) (2022-09-15)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.43
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.33

# @forestadmin/datasource-sql [1.0.0-beta.50](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.49...@forestadmin/datasource-sql@1.0.0-beta.50) (2022-09-12)


### Performance Improvements

* **datasource-sql:** query structure, indexes and references in parallel ([#419](https://github.com/ForestAdmin/agent-nodejs/issues/419)) ([f08e48a](https://github.com/ForestAdmin/agent-nodejs/commit/f08e48a948c5f85b37ba85e165299ea44fda9fb6))

# @forestadmin/datasource-sql [1.0.0-beta.49](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.48...@forestadmin/datasource-sql@1.0.0-beta.49) (2022-09-12)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.42
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.32

# @forestadmin/datasource-sql [1.0.0-beta.48](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.47...@forestadmin/datasource-sql@1.0.0-beta.48) (2022-09-08)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.41
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.31

# @forestadmin/datasource-sql [1.0.0-beta.47](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.46...@forestadmin/datasource-sql@1.0.0-beta.47) (2022-09-07)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.40
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.30

# @forestadmin/datasource-sql [1.0.0-beta.46](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.45...@forestadmin/datasource-sql@1.0.0-beta.46) (2022-09-07)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.39

# @forestadmin/datasource-sql [1.0.0-beta.45](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.44...@forestadmin/datasource-sql@1.0.0-beta.45) (2022-09-05)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.38
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.29

# @forestadmin/datasource-sql [1.0.0-beta.44](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.43...@forestadmin/datasource-sql@1.0.0-beta.44) (2022-09-05)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.37
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.28

# @forestadmin/datasource-sql [1.0.0-beta.43](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.42...@forestadmin/datasource-sql@1.0.0-beta.43) (2022-09-02)


### Bug Fixes

* **datasource-sql:** skip models which do not have primary keys ([#393](https://github.com/ForestAdmin/agent-nodejs/issues/393)) ([820fbe9](https://github.com/ForestAdmin/agent-nodejs/commit/820fbe9087ec9977fc998363016ce1728438c8f2))

# @forestadmin/datasource-sql [1.0.0-beta.42](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.41...@forestadmin/datasource-sql@1.0.0-beta.42) (2022-08-23)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.36
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.27

# @forestadmin/datasource-sql [1.0.0-beta.41](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.40...@forestadmin/datasource-sql@1.0.0-beta.41) (2022-08-23)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.35

# @forestadmin/datasource-sql [1.0.0-beta.40](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.39...@forestadmin/datasource-sql@1.0.0-beta.40) (2022-07-25)


### Bug Fixes

* update code and sequelize version to avoid crash ([#374](https://github.com/ForestAdmin/agent-nodejs/issues/374)) ([e003416](https://github.com/ForestAdmin/agent-nodejs/commit/e0034166b86e48781ea099086fd93aa7c68dba03))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.34

# @forestadmin/datasource-sql [1.0.0-beta.39](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.38...@forestadmin/datasource-sql@1.0.0-beta.39) (2022-06-27)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.33

# @forestadmin/datasource-sql [1.0.0-beta.38](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.37...@forestadmin/datasource-sql@1.0.0-beta.38) (2022-06-16)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.32

# @forestadmin/datasource-sql [1.0.0-beta.37](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.36...@forestadmin/datasource-sql@1.0.0-beta.37) (2022-06-16)


### Bug Fixes

* **patch-package:** remove feature change on sequelize patch ([#356](https://github.com/ForestAdmin/agent-nodejs/issues/356)) ([ac3d7d5](https://github.com/ForestAdmin/agent-nodejs/commit/ac3d7d583c65b392fe668225ebcd9b63729f9f23))

# @forestadmin/datasource-sql [1.0.0-beta.36](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.35...@forestadmin/datasource-sql@1.0.0-beta.36) (2022-06-15)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.31
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.26

# @forestadmin/datasource-sql [1.0.0-beta.35](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.34...@forestadmin/datasource-sql@1.0.0-beta.35) (2022-06-15)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.30
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.25

# @forestadmin/datasource-sql [1.0.0-beta.34](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.33...@forestadmin/datasource-sql@1.0.0-beta.34) (2022-06-14)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.29
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.24

# @forestadmin/datasource-sql [1.0.0-beta.33](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.32...@forestadmin/datasource-sql@1.0.0-beta.33) (2022-06-14)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.28
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.23

# @forestadmin/datasource-sql [1.0.0-beta.32](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.31...@forestadmin/datasource-sql@1.0.0-beta.32) (2022-06-09)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.27
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.22

# @forestadmin/datasource-sql [1.0.0-beta.31](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.30...@forestadmin/datasource-sql@1.0.0-beta.31) (2022-06-01)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.26
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.21

# @forestadmin/datasource-sql [1.0.0-beta.30](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.29...@forestadmin/datasource-sql@1.0.0-beta.30) (2022-05-31)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.25
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.20

# @forestadmin/datasource-sql [1.0.0-beta.29](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.28...@forestadmin/datasource-sql@1.0.0-beta.29) (2022-05-25)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.24
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.19

# @forestadmin/datasource-sql [1.0.0-beta.28](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.27...@forestadmin/datasource-sql@1.0.0-beta.28) (2022-05-24)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.23
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.18

# @forestadmin/datasource-sql [1.0.0-beta.27](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.26...@forestadmin/datasource-sql@1.0.0-beta.27) (2022-05-24)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.22
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.17

# @forestadmin/datasource-sql [1.0.0-beta.26](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.25...@forestadmin/datasource-sql@1.0.0-beta.26) (2022-05-16)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.21
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.16

# @forestadmin/datasource-sql [1.0.0-beta.25](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.24...@forestadmin/datasource-sql@1.0.0-beta.25) (2022-05-12)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.20
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.15

# @forestadmin/datasource-sql [1.0.0-beta.24](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.23...@forestadmin/datasource-sql@1.0.0-beta.24) (2022-05-09)


### Bug Fixes

* **datasource sql:** throw an user friendly error when the provided connection uri is invalid ([#297](https://github.com/ForestAdmin/agent-nodejs/issues/297)) ([db1ac83](https://github.com/ForestAdmin/agent-nodejs/commit/db1ac83d3ef023c7875e4affbaecdc52de1e5fc3))

# @forestadmin/datasource-sql [1.0.0-beta.23](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.22...@forestadmin/datasource-sql@1.0.0-beta.23) (2022-05-09)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.19
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.14

# @forestadmin/datasource-sql [1.0.0-beta.22](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.21...@forestadmin/datasource-sql@1.0.0-beta.22) (2022-05-09)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.18
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.13

# @forestadmin/datasource-sql [1.0.0-beta.21](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.20...@forestadmin/datasource-sql@1.0.0-beta.21) (2022-05-09)


### Bug Fixes

* datasource naming consistency ([#292](https://github.com/ForestAdmin/agent-nodejs/issues/292)) ([ff50a1f](https://github.com/ForestAdmin/agent-nodejs/commit/ff50a1f02aa65b3d99824c2bc9fb19d729a4e465))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.17
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.12

# @forestadmin/datasource-sql [1.0.0-beta.20](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.19...@forestadmin/datasource-sql@1.0.0-beta.20) (2022-05-04)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.16
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.11

# @forestadmin/datasource-sql [1.0.0-beta.19](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.18...@forestadmin/datasource-sql@1.0.0-beta.19) (2022-04-29)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.15
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.10

# @forestadmin/datasource-sql [1.0.0-beta.18](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.17...@forestadmin/datasource-sql@1.0.0-beta.18) (2022-04-29)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.14
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.9

# @forestadmin/datasource-sql [1.0.0-beta.17](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.16...@forestadmin/datasource-sql@1.0.0-beta.17) (2022-04-28)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.13
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.8

# @forestadmin/datasource-sql [1.0.0-beta.16](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.15...@forestadmin/datasource-sql@1.0.0-beta.16) (2022-04-26)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.12

# @forestadmin/datasource-sql [1.0.0-beta.15](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.14...@forestadmin/datasource-sql@1.0.0-beta.15) (2022-04-26)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.11
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.7

# @forestadmin/datasource-sql [1.0.0-beta.14](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.13...@forestadmin/datasource-sql@1.0.0-beta.14) (2022-04-25)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.10

# @forestadmin/datasource-sql [1.0.0-beta.13](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.12...@forestadmin/datasource-sql@1.0.0-beta.13) (2022-04-25)


### Bug Fixes

* import packages from js ([#260](https://github.com/ForestAdmin/agent-nodejs/issues/260)) ([de00886](https://github.com/ForestAdmin/agent-nodejs/commit/de008862971ea5d3559e5a4c3136b0dd2161d760))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.9

# @forestadmin/datasource-sql [1.0.0-beta.12](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.11...@forestadmin/datasource-sql@1.0.0-beta.12) (2022-04-21)


### Features

* harmonize datasource creation and pass logger to it ([#257](https://github.com/ForestAdmin/agent-nodejs/issues/257)) ([82cb4ea](https://github.com/ForestAdmin/agent-nodejs/commit/82cb4ea37ac0a9fe83423d917226dfd8fad7d0a6))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.8
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.6

# @forestadmin/datasource-sql [1.0.0-beta.11](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.10...@forestadmin/datasource-sql@1.0.0-beta.11) (2022-04-21)


### Bug Fixes

* **datasource sql:** has one detection ([#254](https://github.com/ForestAdmin/agent-nodejs/issues/254)) ([68e68b3](https://github.com/ForestAdmin/agent-nodejs/commit/68e68b33063ba7bbfb9cfc747572f59953b64050))

# @forestadmin/datasource-sql [1.0.0-beta.10](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.9...@forestadmin/datasource-sql@1.0.0-beta.10) (2022-04-20)


### Features

* **datasource sql:** handle relations ([#224](https://github.com/ForestAdmin/agent-nodejs/issues/224)) ([275cf7e](https://github.com/ForestAdmin/agent-nodejs/commit/275cf7ed6835933fce418f92a6a4e2521a9721fe))

# @forestadmin/datasource-sql [1.0.0-beta.9](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.8...@forestadmin/datasource-sql@1.0.0-beta.9) (2022-04-20)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.7

# @forestadmin/datasource-sql [1.0.0-beta.8](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.7...@forestadmin/datasource-sql@1.0.0-beta.8) (2022-04-19)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.6
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.5

# @forestadmin/datasource-sql [1.0.0-beta.7](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.6...@forestadmin/datasource-sql@1.0.0-beta.7) (2022-04-19)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.5

# @forestadmin/datasource-sql [1.0.0-beta.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.5...@forestadmin/datasource-sql@1.0.0-beta.6) (2022-04-15)


### Features

* **datasource sql:** handle primitive fields and default values ([#215](https://github.com/ForestAdmin/agent-nodejs/issues/215)) ([59a56da](https://github.com/ForestAdmin/agent-nodejs/commit/59a56da2721f39d0487b14d72b11d71b38b83a1f))

# @forestadmin/datasource-sql [1.0.0-beta.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.4...@forestadmin/datasource-sql@1.0.0-beta.5) (2022-04-15)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.4
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.4

# @forestadmin/datasource-sql [1.0.0-beta.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.3...@forestadmin/datasource-sql@1.0.0-beta.4) (2022-04-15)


### Bug Fixes

* switched from qiwi to dhoulb version of msr ([020c3e0](https://github.com/ForestAdmin/agent-nodejs/commit/020c3e04c64164c3f26aae293989db7842f82e8c))

# @forestadmin/datasource-sql [1.0.0-beta.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.2...@forestadmin/datasource-sql@1.0.0-beta.3) (2022-04-15)


### Bug Fixes

* correct versions in package.json of all datasources ([540d395](https://github.com/ForestAdmin/agent-nodejs/commit/540d395bc5e42bdd7edb3dce5806ade8554f3d7a))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.3

# @forestadmin/datasource-sql [1.0.0-beta.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/datasource-sql@1.0.0-beta.1...@forestadmin/datasource-sql@1.0.0-beta.2) (2022-04-15)





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.2
* **@forestadmin/datasource-toolkit:** upgraded to 1.0.0-beta.3

# @forestadmin/datasource-sql 1.0.0-beta.1 (2022-04-15)


### Bug Fixes

* enable npm, git and github distribution ([bd91825](https://github.com/ForestAdmin/agent-nodejs/commit/bd91825f4d185874a259da28b0f7a6c7f557196d))
* fix semantic release ([3a2fa73](https://github.com/ForestAdmin/agent-nodejs/commit/3a2fa738af84a50b9563db6ac039c922b77f55cc))





### Dependencies

* **@forestadmin/datasource-sequelize:** upgraded to 1.0.0-beta.1
