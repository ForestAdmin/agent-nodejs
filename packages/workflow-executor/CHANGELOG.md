## @forestadmin/workflow-executor [1.17.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.17.0...@forestadmin/workflow-executor@1.17.1) (2026-07-16)


### Bug Fixes

* **workflow-executor:** accept null title/prompt/aiConfigName in step definitions ([#1753](https://github.com/ForestAdmin/agent-nodejs/issues/1753)) ([7988452](https://github.com/ForestAdmin/agent-nodejs/commit/798845273ad64671f58650c38bc5196e7fbe3f84))

# @forestadmin/workflow-executor [1.17.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.16.0...@forestadmin/workflow-executor@1.17.0) (2026-07-15)


### Features

* **workflow-executor:** propagate run triggerType for observability ([#1705](https://github.com/ForestAdmin/agent-nodejs/issues/1705)) ([8365a2e](https://github.com/ForestAdmin/agent-nodejs/commit/8365a2e96ea7241db411dd0709f281b59e7a05a4))

# @forestadmin/workflow-executor [1.16.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.15.0...@forestadmin/workflow-executor@1.16.0) (2026-07-15)


### Features

* **workflow-executor:** add AI-assisted and Full AI execution to the guidance step (PRD-148 pattern, PRD-18) ([#1741](https://github.com/ForestAdmin/agent-nodejs/issues/1741)) ([7a5dc1c](https://github.com/ForestAdmin/agent-nodejs/commit/7a5dc1c0c8c838f86b1632aa509420849c812e06))

# @forestadmin/workflow-executor [1.15.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.14.0...@forestadmin/workflow-executor@1.15.0) (2026-07-07)


### Features

* **workflow-executor:** add 3-way execution mode to the load related record step (PRD-148) ([#1728](https://github.com/ForestAdmin/agent-nodejs/issues/1728)) ([43a15c7](https://github.com/ForestAdmin/agent-nodejs/commit/43a15c7e8efa0b3c3a3ef30fbbbbac87f602f870))

# @forestadmin/workflow-executor [1.14.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.13.0...@forestadmin/workflow-executor@1.14.0) (2026-07-07)


### Features

* **workflow-executor:** add OAuth credential store + deposit endpoint (PRD-367 PR1) ([#1619](https://github.com/ForestAdmin/agent-nodejs/issues/1619)) ([17d786f](https://github.com/ForestAdmin/agent-nodejs/commit/17d786f083fd11d0298b42d8072036f76c7164c2))





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.10.1
* **@forestadmin/ai-proxy:** upgraded to 1.12.0
* **@forestadmin/forestadmin-client:** upgraded to 1.40.4

# @forestadmin/workflow-executor [1.13.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.12.0...@forestadmin/workflow-executor@1.13.0) (2026-07-03)


### Features

* attach AI reasoning as a comment on approval requests ([#1733](https://github.com/ForestAdmin/agent-nodejs/issues/1733)) ([bb6ee3f](https://github.com/ForestAdmin/agent-nodejs/commit/bb6ee3fc2a58c061dee5930281597f4563b3c159))





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.10.0

# @forestadmin/workflow-executor [1.12.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.11.0...@forestadmin/workflow-executor@1.12.0) (2026-07-02)


### Features

* **agent:** embed workflow executor in-process via addWorkflowExecutor() ([#1717](https://github.com/ForestAdmin/agent-nodejs/issues/1717)) ([3931aeb](https://github.com/ForestAdmin/agent-nodejs/commit/3931aebcf39a284f2e43b682dcc8b6514933d2b2))

# @forestadmin/workflow-executor [1.11.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.10.0...@forestadmin/workflow-executor@1.11.0) (2026-07-01)


### Features

* **workflow-executor:** approval requests on Full AI / Automatic trigger actions [PRD-688] ([#1720](https://github.com/ForestAdmin/agent-nodejs/issues/1720)) ([aa3ef58](https://github.com/ForestAdmin/agent-nodejs/commit/aa3ef58da383d92e96390e8931d41fa87fd72353))





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.9.0

# @forestadmin/workflow-executor [1.10.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.9.2...@forestadmin/workflow-executor@1.10.0) (2026-07-01)


### Features

* **workflow-executor:** build database connection from split env vars ([#1727](https://github.com/ForestAdmin/agent-nodejs/issues/1727)) ([1a13e71](https://github.com/ForestAdmin/agent-nodejs/commit/1a13e71d17c5d2473346efc9cbff89cd14f98bfb))

## @forestadmin/workflow-executor [1.9.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.9.1...@forestadmin/workflow-executor@1.9.2) (2026-06-29)





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.8.0

## @forestadmin/workflow-executor [1.9.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.9.0...@forestadmin/workflow-executor@1.9.1) (2026-06-26)





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.7.1

# @forestadmin/workflow-executor [1.9.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.8.0...@forestadmin/workflow-executor@1.9.0) (2026-06-26)


### Features

* **workflow-executor:** add production Docker image and GHCR CI publish ([#1706](https://github.com/ForestAdmin/agent-nodejs/issues/1706)) ([a9c26ab](https://github.com/ForestAdmin/agent-nodejs/commit/a9c26ab533b2c366281136061d072cb880152bc8))

# @forestadmin/workflow-executor [1.8.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.7.0...@forestadmin/workflow-executor@1.8.0) (2026-06-25)


### Features

* **workflow:** deterministic + Full AI workflow steps ([#1696](https://github.com/ForestAdmin/agent-nodejs/issues/1696)) ([08383a0](https://github.com/ForestAdmin/agent-nodejs/commit/08383a09b1f8c9e71ee5538d13a8701bde35bae7))





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.7.0

# @forestadmin/workflow-executor [1.7.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.6.1...@forestadmin/workflow-executor@1.7.0) (2026-06-24)


### Features

* **workflow-executor:** attribute AI usage to the triggering user [PRD-619] ([#1701](https://github.com/ForestAdmin/agent-nodejs/issues/1701)) ([5e647ae](https://github.com/ForestAdmin/agent-nodejs/commit/5e647ae0f00bc15f7779c4194fb298ade48aadef))

## @forestadmin/workflow-executor [1.6.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.6.0...@forestadmin/workflow-executor@1.6.1) (2026-06-23)


### Bug Fixes

* **workflow-executor:** expose executor version on every HTTP response ([#1699](https://github.com/ForestAdmin/agent-nodejs/issues/1699)) ([c06420e](https://github.com/ForestAdmin/agent-nodejs/commit/c06420effb277682d6c23fd20ea7a150d7638613))
* **workflow-executor:** serialize cold-start migrations behind a pg advisory lock ([#1698](https://github.com/ForestAdmin/agent-nodejs/issues/1698)) ([b655fde](https://github.com/ForestAdmin/agent-nodejs/commit/b655fdeaae7e4e8f798e39529569168fca784436))

# @forestadmin/workflow-executor [1.6.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.5.1...@forestadmin/workflow-executor@1.6.0) (2026-06-19)


### Features

* **workflow-executor:** optional database TLS via DATABASE_SSL ([#1685](https://github.com/ForestAdmin/agent-nodejs/issues/1685)) ([91870c7](https://github.com/ForestAdmin/agent-nodejs/commit/91870c7a4fbe1399ec6cdf611ba172f851be8f1d))

## @forestadmin/workflow-executor [1.5.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.5.0...@forestadmin/workflow-executor@1.5.1) (2026-06-19)


### Bug Fixes

* **workflow-executor:** accept LOG_LEVEL case-insensitively ([#1684](https://github.com/ForestAdmin/agent-nodejs/issues/1684)) ([dcb8769](https://github.com/ForestAdmin/agent-nodejs/commit/dcb87696990fb7e14148693a3192e3a8797a61b1))

# @forestadmin/workflow-executor [1.5.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.4.1...@forestadmin/workflow-executor@1.5.0) (2026-06-18)


### Features

* **workflow-executor:** namespace DB store under a dedicated "forest" schema ([#1667](https://github.com/ForestAdmin/agent-nodejs/issues/1667)) ([b0e0da7](https://github.com/ForestAdmin/agent-nodejs/commit/b0e0da7b28466e192e3eed51a644ce8eeabd8808))

## @forestadmin/workflow-executor [1.4.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.4.0...@forestadmin/workflow-executor@1.4.1) (2026-06-18)


### Reverts

* Revert "fix(workflow): save ai reasoning in loadRelatedRecord steps ([#1668](https://github.com/ForestAdmin/agent-nodejs/issues/1668))" ([#1672](https://github.com/ForestAdmin/agent-nodejs/issues/1672)) ([4128bd2](https://github.com/ForestAdmin/agent-nodejs/commit/4128bd2b1fa89ab2e637911d198035f43d24c071))

# @forestadmin/workflow-executor [1.4.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.3.0...@forestadmin/workflow-executor@1.4.0) (2026-06-17)


### Bug Fixes

* **workflow-executor:** coerce numeric-string bearer id to number ([#1669](https://github.com/ForestAdmin/agent-nodejs/issues/1669)) ([a44136d](https://github.com/ForestAdmin/agent-nodejs/commit/a44136dba91b8a0886fb148e3afdfae51031611b))
* **workflow:** save ai reasoning in loadRelatedRecord steps ([#1668](https://github.com/ForestAdmin/agent-nodejs/issues/1668)) ([48a7e47](https://github.com/ForestAdmin/agent-nodejs/commit/48a7e4763c37c8d4ddcbe7f4af7a0f5197714cbe))


### Features

* **workflow-executor:** report executor version to orchestrator at startup ([#1662](https://github.com/ForestAdmin/agent-nodejs/issues/1662)) ([acf71df](https://github.com/ForestAdmin/agent-nodejs/commit/acf71dfdd8b0f8fa9583bbe95e5842e60c28765b))

# @forestadmin/workflow-executor [1.3.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.2.0...@forestadmin/workflow-executor@1.3.0) (2026-06-15)


### Features

* **workflow-executor:** configurable log level via LOG_LEVEL env (PRD-407) ([#1624](https://github.com/ForestAdmin/agent-nodejs/issues/1624)) ([30b0ea7](https://github.com/ForestAdmin/agent-nodejs/commit/30b0ea729c98c59a45aad11727b270c3e0f2f075))

# @forestadmin/workflow-executor [1.2.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.1.5...@forestadmin/workflow-executor@1.2.0) (2026-06-12)


### Features

* **workflow-executor:** validate bearer claims via a zod middleware [PRD-508] ([#1659](https://github.com/ForestAdmin/agent-nodejs/issues/1659)) ([5a0a63c](https://github.com/ForestAdmin/agent-nodejs/commit/5a0a63c8dc490218bd2e46175b016f55e5ff9b80))

## @forestadmin/workflow-executor [1.1.5](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.1.4...@forestadmin/workflow-executor@1.1.5) (2026-06-12)


### Bug Fixes

* **workflow-executor:** scope collection schema cache by rendering [PRD-440] ([#1660](https://github.com/ForestAdmin/agent-nodejs/issues/1660)) ([1284c9b](https://github.com/ForestAdmin/agent-nodejs/commit/1284c9b3a92b85334be2e6df5f258693b2f59d1a))

## @forestadmin/workflow-executor [1.1.4](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.1.3...@forestadmin/workflow-executor@1.1.4) (2026-06-11)


### Bug Fixes

* **workflow:** set durations to seconds ([#1646](https://github.com/ForestAdmin/agent-nodejs/issues/1646)) ([7766363](https://github.com/ForestAdmin/agent-nodejs/commit/7766363e0753beca99a0d27a0e65220549ea8f8c))

## @forestadmin/workflow-executor [1.1.3](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.1.2...@forestadmin/workflow-executor@1.1.3) (2026-06-11)





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.6.3
* **@forestadmin/ai-proxy:** upgraded to 1.11.3
* **@forestadmin/forestadmin-client:** upgraded to 1.40.3

## @forestadmin/workflow-executor [1.1.2](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.1.1...@forestadmin/workflow-executor@1.1.2) (2026-06-10)


### Bug Fixes

* align internal dependency versions to published releases ([#1653](https://github.com/ForestAdmin/agent-nodejs/issues/1653)) ([317fea9](https://github.com/ForestAdmin/agent-nodejs/commit/317fea90390df38a384d1d17d04ec9a05566ed49))





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.6.2

## @forestadmin/workflow-executor [1.1.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.1.0...@forestadmin/workflow-executor@1.1.1) (2026-06-10)


### Bug Fixes

* **workflow-executor:** fix warnings during installation ([#1649](https://github.com/ForestAdmin/agent-nodejs/issues/1649)) ([69175b6](https://github.com/ForestAdmin/agent-nodejs/commit/69175b6909608f24ac5fa3fd0873b3aa306f2c2b))

# @forestadmin/workflow-executor [1.1.0](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.0.1...@forestadmin/workflow-executor@1.1.0) (2026-06-10)


### Features

* **workflow-executor:** handle polymorphic relations in load-related (skip + follow) [PRD-493] ([#1647](https://github.com/ForestAdmin/agent-nodejs/issues/1647)) ([f7eef97](https://github.com/ForestAdmin/agent-nodejs/commit/f7eef97a2ae17860a2ba1e0a3d682af5042aa663))

## @forestadmin/workflow-executor [1.0.1](https://github.com/ForestAdmin/agent-nodejs/compare/@forestadmin/workflow-executor@1.0.0...@forestadmin/workflow-executor@1.0.1) (2026-06-10)


### Bug Fixes

* **workflow-executor:** enforce a minimum Node.js version ([#1641](https://github.com/ForestAdmin/agent-nodejs/issues/1641)) ([23c594a](https://github.com/ForestAdmin/agent-nodejs/commit/23c594ad7838602d54b1cd5b4139a18a5d9410ba))

# @forestadmin/workflow-executor 1.0.0 (2026-06-10)


### Bug Fixes

* **workflow-executor:** align @forestadmin/* deps with the workspace ([#1643](https://github.com/ForestAdmin/agent-nodejs/issues/1643)) ([a901753](https://github.com/ForestAdmin/agent-nodejs/commit/a901753c8007f51fa7492296222b6ae28c585ea5))


### Features

* **executor:** introduce workflow executor ([#1564](https://github.com/ForestAdmin/agent-nodejs/issues/1564)) ([1545069](https://github.com/ForestAdmin/agent-nodejs/commit/15450694043f0394f3d3ec00330df9ccc71cc8d9))





### Dependencies

* **@forestadmin/agent-client:** upgraded to 1.6.1
* **@forestadmin/ai-proxy:** upgraded to 1.11.1
* **@forestadmin/forestadmin-client:** upgraded to 1.40.1

# @forestadmin/workflow-executor
