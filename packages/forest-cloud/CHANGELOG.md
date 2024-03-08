## @forestadmin/forest-cloud [1.3.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.3.2...@forestadmin/forest-cloud@1.3.3) (2024-03-08)


### Bug Fixes

* vulnerability in axios ([#1051](https://github.com/ForestAdmin/agent-nodejs/issues/1051)) ([6a2e861](https://github.com/ForestAdmin/agent-nodejs/commit/6a2e861bb3dfb6806f23d353c1f6b579eeefadd9))

## @forestadmin/forest-cloud [1.3.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.3.1...@forestadmin/forest-cloud@1.3.2) (2024-03-08)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.38.4

## @forestadmin/forest-cloud [1.3.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.3.0...@forestadmin/forest-cloud@1.3.1) (2024-03-04)


### Bug Fixes

* **logs:** improve default message when nos logs are displayed ([#1049](https://github.com/ForestAdmin/agent-nodejs/issues/1049)) ([594014c](https://github.com/ForestAdmin/agent-nodejs/commit/594014c8f251a40cae30c287789a9be56396ba67))

# @forestadmin/forest-cloud [1.3.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.2.0...@forestadmin/forest-cloud@1.3.0) (2024-03-01)


### Features

* **logs:** add new command options --from and --to ([#1047](https://github.com/ForestAdmin/agent-nodejs/issues/1047)) ([eff3524](https://github.com/ForestAdmin/agent-nodejs/commit/eff3524c1e24182205d2f585e9fb90cc8b94d7ef))

# @forestadmin/forest-cloud [1.2.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.6...@forestadmin/forest-cloud@1.2.0) (2024-02-29)


### Features

* **forest-cloud:** add logs command to display logs ([#1034](https://github.com/ForestAdmin/agent-nodejs/issues/1034)) ([98a62ed](https://github.com/ForestAdmin/agent-nodejs/commit/98a62edf176559598c4bb8337da8d41e141d9cbc))

## @forestadmin/forest-cloud [1.1.6](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.5...@forestadmin/forest-cloud@1.1.6) (2024-02-28)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.38.3
* **@forestadmin/datasource-customizer:** upgraded to 1.43.3

## @forestadmin/forest-cloud [1.1.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.4...@forestadmin/forest-cloud@1.1.5) (2024-02-27)





### Dependencies

* **@forestadmin/agent:** upgraded to 1.38.2
* **@forestadmin/datasource-customizer:** upgraded to 1.43.2
* **@forestadmin/datasource-sql:** upgraded to 1.9.2

## @forestadmin/forest-cloud [1.1.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.3...@forestadmin/forest-cloud@1.1.4) (2024-02-26)


### Bug Fixes

* **forest-cloud:** when login fails it displays a success message ([#1045](https://github.com/ForestAdmin/agent-nodejs/issues/1045)) ([74980ef](https://github.com/ForestAdmin/agent-nodejs/commit/74980ef797b57e3377ca16f6e10746e30868dce8))

## @forestadmin/forest-cloud [1.1.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.2...@forestadmin/forest-cloud@1.1.3) (2024-02-23)


### Bug Fixes

* unable to bootstrap with npx when the user is not previously logged in with forest cli ([#1044](https://github.com/ForestAdmin/agent-nodejs/issues/1044)) ([06b686e](https://github.com/ForestAdmin/agent-nodejs/commit/06b686ef379b9273b9bc86efd6a629a572dc4a30))

## @forestadmin/forest-cloud [1.1.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.1...@forestadmin/forest-cloud@1.1.2) (2024-02-23)





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.9.1

## @forestadmin/forest-cloud [1.1.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.1.0...@forestadmin/forest-cloud@1.1.1) (2024-02-21)


### Bug Fixes

* name must be required for bootstrap command ([#1039](https://github.com/ForestAdmin/agent-nodejs/issues/1039)) ([7eb982b](https://github.com/ForestAdmin/agent-nodejs/commit/7eb982b393bc0853775d5943be3b661b2ad505a5))

# @forestadmin/forest-cloud [1.1.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.0.5...@forestadmin/forest-cloud@1.1.0) (2024-02-21)


### Features

* dump non default passed env variables to .env ([#1035](https://github.com/ForestAdmin/agent-nodejs/issues/1035)) ([1629d8b](https://github.com/ForestAdmin/agent-nodejs/commit/1629d8bc17fdabb363e1a3e71933d6a79059d0a2))
* **forest-cloud:** allow the user to give a name of his project ([#1036](https://github.com/ForestAdmin/agent-nodejs/issues/1036)) ([1b73b4a](https://github.com/ForestAdmin/agent-nodejs/commit/1b73b4a46f92c9292c7a67c2b7c9d2e071078257))

## @forestadmin/forest-cloud [1.0.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.0.4...@forestadmin/forest-cloud@1.0.5) (2024-02-20)


### Bug Fixes

* **forest-cloud:** bump forest-cli to remove warning during installation ([#1032](https://github.com/ForestAdmin/agent-nodejs/issues/1032)) ([e539a39](https://github.com/ForestAdmin/agent-nodejs/commit/e539a391d320dfac7177e90d20c0acccb353d295))

## @forestadmin/forest-cloud [1.0.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.0.3...@forestadmin/forest-cloud@1.0.4) (2024-02-20)


### Bug Fixes

* **update-types:** updateTypesOnFileSystem ends before writing the file ([#1031](https://github.com/ForestAdmin/agent-nodejs/issues/1031)) ([8a7386c](https://github.com/ForestAdmin/agent-nodejs/commit/8a7386c550e275c21f44cc0e2e54942f782dc10c))





### Dependencies

* **@forestadmin/agent:** upgraded to 1.38.1

## @forestadmin/forest-cloud [1.0.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.0.2...@forestadmin/forest-cloud@1.0.3) (2024-02-19)


### Bug Fixes

* **forest-cloud:** downgrade the subscriptions-transport-ws version to be able to use it with npm ([#1030](https://github.com/ForestAdmin/agent-nodejs/issues/1030)) ([02cc76e](https://github.com/ForestAdmin/agent-nodejs/commit/02cc76e1d48ca61d70a979818fe94cd7d559f8ef))

## @forestadmin/forest-cloud [1.0.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.0.1...@forestadmin/forest-cloud@1.0.2) (2024-02-19)


### Bug Fixes

* **forest-cloud:** fix checking version feature  ([#1028](https://github.com/ForestAdmin/agent-nodejs/issues/1028)) ([4ad679b](https://github.com/ForestAdmin/agent-nodejs/commit/4ad679b4beb88765d9d2bfa91ac5ffb9e988ca7b))

## @forestadmin/forest-cloud [1.0.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/forest-cloud@1.0.0...@forestadmin/forest-cloud@1.0.1) (2024-02-19)


### Bug Fixes

* **forest-cloud:** add json files in the project dependencies ([#1027](https://github.com/ForestAdmin/agent-nodejs/issues/1027)) ([ace9550](https://github.com/ForestAdmin/agent-nodejs/commit/ace9550f6a540e8ad16746e6693c5a785a15e80c))

# @forestadmin/forest-cloud 1.0.0 (2024-02-19)


### Features

* **forest-cloud:** add forest-cloud package to allow users to use cloud customization  ([#1026](https://github.com/ForestAdmin/agent-nodejs/issues/1026)) ([0ad83c6](https://github.com/ForestAdmin/agent-nodejs/commit/0ad83c69b3bd2e2f9149b9798042f0a1e21bee6a))





### Dependencies

* **@forestadmin/datasource-sql:** upgraded to 1.9.0
