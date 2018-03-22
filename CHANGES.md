2018-03-22, Version 3.16.0
==========================

 * Pass options argument to custom validators (bmatson)

 * chore: update CODEOWNERS (#1566) (Diana Lau)


2018-03-16, Version 3.15.5
==========================

 * Exclude .nyc_output from being published (Raymond Feng)

 * CODEOWNERS: add nitro404 (Miroslav Bajtoš)


2018-02-13, Version 3.15.4
==========================

 * fix: allow `new DataSource(connector, settings)` (Raymond Feng)


2018-02-09, Version 3.15.3
==========================

 * fix: add more tests to verify new DataSource() (Raymond Feng)


2018-02-07, Version 3.15.2
==========================

 * feat(datasource): seperate name and connector  name (Nguyen Truong Minh)

 * Fix datasource not correctly retaining name value (Kevin Scroggins)


2018-02-06, Version 3.15.1
==========================

 * Added error handling for persist operation hook (#1531) (Kevin Scroggins)

 * Add warning for datasources with mismatched names (Kevin Scroggins)


2018-01-19, Version 3.15.0
==========================

 * fix unauthorized fk change (#1538) (Taranveer Virk)

 * Set model constructor name to model name (Miroslav Bajtoš)


2017-12-14, Version 3.14.0
==========================

 * Allow new transaction method in postgresql (#1493) (zbarbuto)

 * Fix bug in utils uniq function (#1526) (Peter Bouda)

 * Fix query for related models (#1522) (Joost de Bruijn)

 * chore:update license (#1521) (Diana Lau)

 * Allow customizing embedded relation property (#1513) (zbarbuto)

 * :book: Typo on README.md (#1517) (JP Ventura)

 * CODEOWNERS: move @lehni to Alumni section (Miroslav Bajtoš)


2017-10-17, Version 3.13.0
==========================

 * update strong-globalize to 3.1.0 (#1505) (Kyusung Shim)

 * Fix basic-querying (#1509) (Janny)

 * translation return for Q4 drop1 (tangyinb)

 * Allow passing null to base model ctor (Zak Barbuto)

 * CODEOWNERS: add zbarbuto (Miroslav Bajtoš)

 * update globalize string (Diana Lau)


2017-09-07, Version 3.12.0
==========================

 * Add a better way to handle transactions (Jürg Lehni)

 * validations: use new regex per evaluation (#1479) (Joost de Bruijn)

 * Transaction: Bind timeout to tx instance (#1484) (Jürg Lehni)

 * CODEOWNERS: add lehni (#1483) (Miroslav Bajtoš)

 * Add node8 support for travis (loay)

 * Add nyc coverage, report data to coveralls.io (Miroslav Bajtoš)

 * Update translations from TVT (Allen Boone)

 * Add test coverage for hasAndBelongsToMany (loay)

 * package: use qs@6.5.0 (#1471) (Kevin Delisle)


2017-08-22, Version 3.11.0
==========================

 * Flag id as updateOnly when forceId is in effect (#1453) (Rashmi Hunt)

 * Add stalebot configuration (Kevin Delisle)


2017-08-21, Version 3.10.0
==========================

 * Catch err using Callback (loay)

 * Update Issue and PR Templates (#1462) (Sakib Hasan)

 * Update translated strings Q3 2017 (Allen Boone)

 * test: call true/false in isValid checks (Tom Kirkpatrick)

 * fix: support numbers in validatesFormatOf (Tom Kirkpatrick)

 * Fix undefined properties in where (Raymond Feng)

 * Honor backwards compatability with validate update (ssh24)

 * Fix update validation callback (ssh24)

 * Validate updateAll (ssh24)

 * Sort arrays before testing (ssh24)

 * update translation file (Diana Lau)

 * Missing the option argument (#1426) (dmellonch)

 * Add CODEOWNER file (Diana Lau)

 * use connector flag throughout tests (biniam)


2017-07-26, Version 3.9.3
=========================

 * Catch errors using cb (loay)

 * Rename getAsync() methods to find() and get() (Jürg Lehni)

 * #1386 Allow empty values when allowBlank is true (Simo Moujami)

 * Skip imcompatible tests (#1420) (Janny)

 * Run juggler tests for Cloudant (#1414) (Janny)


2017-06-22, Version 3.9.2
=========================

 * Fix the case where qWhere[idKey] is null (Tetsuo Seto)

 * test/helpers: annotate skipped tests (Kevin Delisle)

 * Fix mixins/validatable docs (ssh24)


2017-06-01, Version 3.9.1
=========================

 * Update translated strings Q2 2017 (Allen Boone)

 * Fix updateAttributes cb (ssh24)

 * Apply iteration on the model object (ssh24)

 * Remove spurious extra options arg (#1390) (Rand McKinney)

 * include: remove JSDoc refs to recursive calls (Kevin Delisle)

 * Fix count of properties (ssh24)

 * hooks: add JSDoc for .trigger (Kevin Delisle)

 * model-builder: JSDoc tidy-up (Kevin Delisle)


2017-05-19, Version 3.9.0
=========================

 * Return promise for batch create (Raymond Feng)

 * Use correct data on replace callback (ssh24)


2017-05-15, Version 3.8.0
=========================

 * fix assert, make the test case more clear (rashmihunt)

 * code review, better asserts (rashmihunt)

 * test case to exclude base props (rashmihunt)

 * handle excludeBaseProperties (rashmihunt)


2017-05-15, Version 3.7.0
=========================

 * Remove unnecessary tests for adhocSort !== false (Tetsuo Seto)

 * Fix the test case to avoid duplicate userId (Tetsuo Seto)

 * Support include rework for C* connector (Tetsuo Seto)

 * Overall review of polymorphic relations (ebarault)

 * configurable model merge (ebarault)

 * Fix assertion errors (Loay)

 * Update modelbaseclass api docs (Loay)

 * Add caseInsensitive opt to validatesUniquenessOf (Bram Borggreve)


2017-05-02, Version 3.6.1
=========================

 * docs: add DateString definition (Kevin Delisle)


2017-05-02, Version 3.6.0
=========================

 * create sequence for nosql id (#1354) (Janny)

 * Fix order of query results (Loay)

 * Add DateString type (Kevin Delisle)

 * datatype.test: use predefined date (Kevin Delisle)

 * Update api documents (Loay)

 * Datasource documentation tune-up (Kevin Delisle)

 * Added unit tests specific to DateType where null (#1349) (Andrew McDonnell)

 * Fix/geo null (#1334) (paulussup)

 * replace exception thrown for invalid dates (Diana Lau)

 * Revert PR #1326 (#1336) (Sakib Hasan)

 * Make lib peerDepend on loopback-connector (#1326) (Russ Tyndall)

 * Add test case using updateAttributes (Loay)

 * Fix forceId bug for updateOrCreate (Loay)

 * Fix typo in description (jannyHou)

 * Fix relations test case (loay)


2017-04-17, Version 3.5.0
=========================

 * Add instructions for running the tests (#1330) (Andrew McDonnell)

 * handle deep geo-near queries (#1314) (Eric Barault)

 * Unskip test case (Loay)

 * Make tests work for other connectors as well as C* (Tetsuo Seto)

 * Remove debugger statement (Tetsuo Seto)

 * Fixup test support for Cassandra connector (Tetsuo Seto)

 * Add test support for Cassandra connector (Tetsuo Seto)

 * package: use loopback-connector@^4.0.0 (Kevin Delisle)

 * Revert "handle deep geo-near queries (#1216)" (Sakib Hasan)

 * Revert "Allow `after save` hook to see count of records changed (#1231)" (Sakib Hasan)

 * Allow `after save` hook to see count of records changed (#1231) (Joshua Chaitin-Pollak)

 * handle deep geo-near queries (#1216) (Corentin H)

 * Fix model def column name method (#1224) (destillat)

 * Added notify flag for create and upsert (#1277) (Jonathan Sheely)

 * Custom Table Names on rels (#1303) (Waldemar Zahn)

 * Support multiple fk relations (#1308) (Sakib Hasan)

 * #1261 Property name "constructor" is not allowed in 'Model' data (#1284) (Thaer Abbas)


2017-04-04, Version 3.4.1
=========================

 * Use dataSource.connect to avoid duplicate connects (Raymond Feng)

 * remove equality value for user defined id (#1293) (Matteo Padovano)


2017-04-04, Version 3.4.0
=========================

 * Fix in-mem connector file operation racing condition (Raymond Feng)


2017-03-31, Version 3.3.0
=========================

 * make geo nearFilter support minDistance (#987) (Vincent Wen)

 * Disallow regexp string in arrays for coerce (#1279) (Mikhail)

 * Fix - `_targetClass` on scope function (#1280) (Clark Wang)

 * Fixes #1275. `Include` filter transforms fields property into array. (#1276) (Nick Oikonomou)

 * Included models from include operations do not change defined `strict` model option (#1259) (Dimitris)

 * Using a filter with exclusion of a non existent property, removes an existing one (#1257) (Dimitris)

 * Clean version of PR 1272 (#1273) (Sakib Hasan)

 * Replicate new issue_template from loopback (Siddhi Pai)

 * Replicate issue_template from loopback repo (Siddhi Pai)

 * Update README.md (Rand McKinney)

 * FindOrCreate missing error callback (Diana Lau)

 * Fixes #1230 coerceArray converts empty Objects (#1269) (Dimitris)

 * override collection name for arangodb (#1243) (Matteo Padovano)

 * Add test coverage for `validatesInclusionOf` (#1249) (Rémi Bèges)

 * dao: catch errors on Model creation in find (Kevin Delisle)

 * dao: catch sync errors on setAttributes (Kevin Delisle)

 * Update error message (Loay)

 * Fix Order query test case (Loay)

 * Doc:Add option for discoverModelDefinitions (jannyHou)

 * Add tests for validatesExclusionOf (#1248) (Rémi Bèges)

 * Fix id update error message formatting (Rémi Bèges)

 * Add test case for all connectors (jannyHou)

 * Add proper statusCode for duplicate (Loay)

 * Fix datasource to report connector-loading errors (Miroslav Bajtoš)

 * Ensure replaceById returns 404 when id not found (Loay)

 * Upgrade eslint-config, fix new violations (Miroslav Bajtoš)

 * Fix option propagation in relation methods (Miroslav Bajtoš)

 * Refactor logic of options.allowExtendedOperators (Matteo Padovano)

 * Fix forceId validation error (Loay)

 * Add two basic tests for "inq" operator (Miroslav Bajtoš)


2017-01-19, Version 3.2.0
=========================

 * Fix should dep (Raymond Feng)

 * Upgrade dependencies to remove npm install warnings (Raymond Feng)

 * Add missing return for KVAO delete all (Simon Ho)

 * Add missing return in KVAO keys test suite (Simon Ho)

 * Detect deleteAll support in KVAO tests (Simon Ho)

 * Coerce array-like objects into arrays (Heath Morrison)

 * Refactor flush to deleteAll (Simon Ho)

 * Upgrade eslint-config to 7.x (Miroslav Bajtoš)

 * Throw error when model relation name is trigger (Brian Schemp)

 * Add flush operation to KVAO (Simon Ho)

 * Fix block padding (Siddhi Pai)


2016-12-21, Version 3.1.1
=========================

 * Update package.json for LB3 release (Simon Ho)

 * Fix eslint errors reported by the latest eslint (Miroslav Bajtoš)

 * Fix HasOne.update to propagate options arg (Miroslav Bajtoš)

 * Fix linter errors for CI (Simon Ho)

 * Replicate .github from loopback repo (Siddhi Pai)

 * Update ko translation file (Candy)

 * Honour allowExtendedOperators in "DAO.find" (Miroslav Bajtoš)

 * Fix MySql CI server Failure (Loay)

 * Upgrade eslint & config to latest (Miroslav Bajtoš)


2016-12-05, Version 3.1.0
=========================

 * Apply hasManyThrough filter on target model (jannyHou)

 * Remove valid connectors from downstream ignores (Simon Ho)

 * Add some connectors to ignoreList (jannyHou)

 * Tests cleanup (Amir Jafarian)

 * Fixed example for creating ValidationError (Boštjan Pišler)

 * Correct tests for DAO.Create (Amir Jafarian)

 * Add downstream ignore list config (Simon Ho)

 * Remove duplicate "engines" from package.json (Miroslav Bajtoš)

 * Drop support for Node v0.10 and v0.12 (Miroslav Bajtoš)

 * Fix a test (Amir Jafarian)

 * Add more robust OH tests for find method (Amir Jafarian)

 * Add support for `loaded` hook (Amir Jafarian)

 * Use imperative mood for tests (Amir Jafarian)

 * Continue _coerce after logical operators (Heath Morrison)

 * Make variable names more clear (Amir Jafarian)

 * test/kvao: add connectorCapabilities options (Miroslav Bajtoš)

 * Fix validateNumericality, nullCheck & add tests (CerealGuy)

 * Add test for operation hooks (Amir Jafarian)

 * Add ilike and nilike operators (Nick Duffy)

 * Fix JSDoc issue (Amir Jafarian)

 * Update ja translation file (Candy)

 * Remove 3.0 RELEASE-NOTES (Miroslav Bajtoš)

 * Fix linting errors (Simon Ho)

 * Update validations.js (Rand McKinney)

 * Update translation files - round#2 (Candy)

 * Fix CI Failures in MySQL (Loay)

 * Add code review fixups (Simon Ho)

 * More descriptive name for model with shortid (Tim De Pauw)

 * Polish PR (Tim De Pauw)

 * Support {defaultFn: 'shortid'} (Tim De Pauw)


2016-09-22, Version 3.0.0
=========================

 * Describe the change of forceId (jannyHou)

 * Add translation files (Amir Jafarian)

 * Add 'isNewInstance' for updateAttributes (Amir Jafarian)

 * Strict mode now always return validationError (David Cheung)

 * Add docs for KVAO (Simon Ho)

 * Skip test temporarily (Loay)

 * Fix BSON Object ID errors for CI (Simon Ho)


2016-09-08, Version 3.0.0-alpha.8
=================================

 * Add missing "done" arg in test/kvao/ttl.suite (Miroslav Bajtoš)

 * Support nested queries for arrays (pponugo)

 * Refactor TTL tests for KV memory connector (Simon Ho)

 * Fix test case for expire (Simon Ho)

 * Fix failures of upsertWithWhere (Amir Jafarian)

 * Remove expired item before executing expire (Simon Ho)

 * Disable `strict` for a few files (Amir Jafarian)


2016-08-26, Version 3.0.0-alpha.7
=================================

 * test/memory: remove dummy findOrCreate impl (Miroslav Bajtoš)

 * Fix CI introduced by `use strict` (Amir Jafarian)

 * Fix manually (Amir Jafarian)

 * Auto-update by eslint --fix (Amir Jafarian)

 * Update eslint (Amir Jafarian)

 * kvao: implement key filter (Miroslav Bajtoš)

 * kvao: add iterateKeys() and keys() (Miroslav Bajtoš)

 * Globalize KeyValue Memory connector (Simon Ho)

 * upsertWithWhere feature support in juggler DAO (Sonali Samantaray)

 * Fix typo (Amir Jafarian)

 * Rename get test suite to match other test suites (Simon Ho)

 * Add TTL for KeyValue related features (Simon Ho)


2016-08-11, Version 3.0.0-alpha.6
=================================

 * Return error if the connector does not implement (Amir Jafarian)

 * kv-memory: fix crash in regular cleanup (Miroslav Bajtoš)

 * test/relation: add missing error handlers (Miroslav Bajtoš)

 * forceId=true with auto-increment db (jannyHou)

 * Fixup globalization (Amir Jafarian)

 * kvao: return 404 when expiring unknown key (Miroslav Bajtoš)

 * Implement KeyValue API and memory connector (Miroslav Bajtoš)

 * Disallow bulk updateOrCreate. (Richard Pringle)

 * Update globalization (Amir Jafarian)

 * Use g.f instead of utils.format (Amir Jafarian)

 * Optimize related model queries (Horia Radu)

 * Support for globalization (Amir Jafarian)

 * Update include.js (Rand McKinney)

 * Fix test case typo (Supasate Choochaisri)

 * Remove unused variables in model.js (Amir Jafarian)

 * Declare `definition` (Amir Jafarian)

 * Add test to catch invalid date property (Supasate Choochaisri)

 * Update URLs in CONTRIBUTING.md (#1002) (Ryan Graham)

 * Ensure stable order of items in DAO.find() (Miroslav Bajtoš)

 * Add test for updateOrCreate (Amir Jafarian)

 * Update validations.js (Rand McKinney)

 * Remove DataSource.registerType() (gunjpan)

 * give options to validators #984 (RobinBiondi)

 * Throw Error for property names with dots (gunjpan)

 * Update datasource.js (Ritchie Martori)


2016-06-13, Version 3.0.0-alpha.5
=================================

 * Give warning if PK is changed in hooks (Amir Jafarian)

 * Remove model events (Candy)

 * Persist changes on parent for embedsOne (Dimitris Halatsis)

 * Fix (Amir Jafarian)

 * Fix error message (Amir Jafarian)

 * ModelBuilder: add new setting strictEmbeddedModels (Dimitris Halatsis)

 * Retun err for UPSERT if the connector returns err (Amir Jafarian)

 * fix error handling when applying undefined mixins (Alex Pitigoi)

 * Add test's description (Amir Jafarian)

 * Fix incompatibility between different connectors (Amir Jafarian)

 * travis: add v4, v6, drop io.js (Miroslav Bajtoš)

 * fix avoid duplicate record on scope with promise (Alex Pitigoi)

 * Document promise support for DAO::find (Sequoia McDowell)

 * Set ESLint as devdep (Simon Ho)

 * Use mocha instead of Makefile for testing (Simon Ho)

 * DAO.create: don't return the instance (Miroslav Bajtoš)

 * RELEASE-NOTES: describe 30283291 (Miroslav Bajtoš)

 * Implement operation hooks for EmbedsMany methods (Miroslav Bajtoš)

 * Implement operation hooks for EmbedsOne methods (Miroslav Bajtoš)

 * eslint config 2.0 + remove extra empty lines (Miroslav Bajtoš)

 * Test coverages for hashed password (Amir Jafarian)

 * Fix `forceId` check for `replaceById` (Amir Jafarian)

 * Fix `notify` bugs for `find` (Amir Jafarian)

 * test: extract hook-monitor helper (Miroslav Bajtoš)

 * test: extract uid-generator helper (Miroslav Bajtoš)

 * test: extract context-test-helpers (Miroslav Bajtoš)

 * Define `patch` aliases (Amir Jafarian)


2016-04-07, Version 3.0.0-alpha.4
=================================

 * Partition by foreign key for pagination (Raymond Feng)

 * Fix style errors (Raymond Feng)

 * fix remaining eslint issues (Miroslav Bajtoš)

 * eslint --fix (Miroslav Bajtoš)

 * Add eslint as "npm run lint" and "posttest" hook (Miroslav Bajtoš)

 * Remove unused support/ files (Miroslav Bajtoš)

 * Insert copyright headers (Ryan Graham)

 * Relicense as MIT only (Ryan Graham)

 * Fix Mongo compatibility issue (Amir Jafarian)

 * Add automigrate to setup tables for replace test cases (Amir Jafarian)

 * Allow test folder to be published (Amir Jafarian)

 * support custom field settings under the connector's namespace (bitmage)

 * Update error message for missing connector (gunjpan)

 * Fix tests for mysql (Amir Jafarian)

 * Add forgotten unit test (Miroslav Bajtoš)

 * fix nin support for in memory datasource (Horia Radu)

 * Improve error message on connector init error (Miroslav Bajtoš)

 * discoverSchemas returns an error when modelName is not found, discoverSchema forwards that error and does not hang when no columns, no errors are returned (bitmage)


2016-02-22, Version 3.0.0-alpha.3
=================================

 * Fix missing connector error msg for db2, cloudant (Candy)

 * Update describe-operation-hooks (Miroslav Bajtoš)


2016-02-05, Version 3.0.0-alpha.2
=================================

 * Implementtaion of replace (Amir Jafarian)

 * Fix conversion for `updateAttributes` (Amir Jafarian)

 * Prevent constructor to be property name (Jue Hou)

 * Revert "Change "npm test" to call mocha directly" (Miroslav Bajtoš)

 * Change "npm test" to call mocha directly (Hans(Zhenghan) Zhang)

 * Refactor `updateAttributes` (Amir Jafarian)

 * Update README.md (Simon Ho)

 * Add unit test to verify fix for #754 (Tom Kirkpatrick)

 * Update package.json (Janny)

 * Try mocha test (Janny)

 * Implement `findOrCreate` for memory connector (Amir Jafarian)

 * Fix a bug when validation is off for findOrCreate (Amir Jafarian)

 * Use bluebird in utils.js Replace `global.Promise` with `bluebird` (Jue Hou)

 * Fix broken code fencings in the docs (Farid Nouri Neshat)

 * Revert "Correct syntax for should and more" (Simon Ho)

 * Fix test for shouldjs 8.0.2 upgrade (Simon Ho)

 * Upgrade shouldjs to 8.0.2 (Simon Ho)

 * Enhance "persist" hook in DAO.updateOrCreate (Miroslav Bajtoš)

 * Enhance "persisted" hook in DAO.updateAttributes (Miroslav Bajtoš)

 * "loaded" hook in DAO.find: ctx.data, not instance (Miroslav Bajtoš)

 * describe-operation-hooks: add "loaded" hook (Miroslav Bajtoš)


2015-12-22, Version 3.0.0-alpha.1
=================================

 * Start development of 3.0 (Miroslav Bajtoš)

 * Correct syntax for should and more (Amir Jafarian)


2015-12-13, Version 2.44.0
==========================

 * Fix failing test for MongoDB connector (Simon Ho)

 * Make automatic validation optional (Bert Casier)

 * Add refresh script (Simon Ho)

 * Add clean scripts (Simon Ho)

 * Refactor Makefile (Simon Ho)


2015-11-27, Version 2.43.0
==========================

 * Explicitly initialize column of partition by clause and pass it in find()'s options argument (eugene-frb)

 * Fix for issue #774 (Pradeep Kumar Tippa)

 * silence a warning that introduced in bluebird 3.0 (Clark Wang)

 * fixed a bug where an error was sent to the updateAttributesCallback and then ignored (Abe BW)

 * Capture includeHasMany() as a find()'s caller by findCaller option (eugene-frb)

 * UpdateAttributes: Raises an error if database fails (Wilson Júnior)

 * fixes #753 (Joseph M. Persie)

 * typo fix (nennad)

 * Fix foreignKey length issue (nennad)


2015-11-23, Version 2.42.0
==========================

 * Correction of a regression introduced by commit 632898b: when querying an empty array ([]) with a 'neq' filter, there were no matching. (Michael Diguet)

 * dropped unused functions and tests fixed (Wert_Lex)

 * One more comment (Wert_Lex)

 * Looks better now (Wert_Lex)

 * home-written map extended with proper .set() method (Wert_Lex)

 * on the halfway to keeping original keys (Wert_Lex)

 * with updated map which stores original key and tests for them (Wert_Lex)

 * Moved inst initialization to place where it used (Wert_Lex)

 * All tests passed (Wert_Lex)

 * Dirty merge. Tests are broken (Wert_Lex)

 * include utils add. Tests ported to should.js (Wert_Lex)


2015-11-17, Version 2.41.2
==========================

 * Fix the typo (Raymond Feng)

 * fix typo (Clark Wang)

 * fix global leak that mocha complains (Clark Wang)

 * Refer to licenses with a link (Sam Roberts)


2015-10-28, Version 2.41.1
==========================

 * Added missing callback when a model is not found (Federico Rampazzo)

 * Rewrite of variable (mdartic)

 * Filtering relations of a model with an order specified (mdartic)


2015-10-07, Version 2.41.0
==========================

 * Ability to define normalization of undefined query (Ryan Schumacher)

 * findByIds would fail when an array of 0 length was passed as its first argument (James Cooke)

 * Use strongloop conventions for licensing (Sam Roberts)


2015-09-11, Version 2.40.1
==========================

 * Fix the test so that it works across DBs (Raymond Feng)


2015-09-10, Version 2.40.0
==========================

 * Fix id comparision in tests so that they work with mongodb object id (Raymond Feng)

 * Update validations.js (Rand McKinney)

 * Add support for using UUID V4 as defaultFn (Bram Borggreve)

 * primaryKey for hasMany and belongsTo relations (sklyukin)

 * primaryKey to hasOne relation (sklyukin)

 * Add direct copmarison value for array matching (Laurent Villeneuve)

 * Add support for matching array values à la mongo. (Laurent Villeneuve)

 * Fixed ReferencesMany .findById to check the given id in the ids array of the model instance (Satyadeep)


2015-08-27, Version 2.39.0
==========================

 * Optimze automigrate() to cut the test time signicantly (Raymond Feng)

 * Fix primary key checks (Simon Ho)

 * travis: drop 0.6 and 0.8, add iojs (Miroslav Bajtoš)

 * Upgrade Travis to container-based infrastructure (Miroslav Bajtoš)

 * Relax id requirement for basic query operations (Simon Ho)


2015-08-18, Version 2.38.0
==========================

 * Support embedded query in memory connector. Fix memory connector bug (Laurent Villeneuve)

 * Use idEquals when comparing ids in relation definitions (Laurent Villeneuve)

 * Handle possible undefined id (Laurent Villeneuve)

 * Fix id copmarison by using strings (Laurent Villeneuve)

 * Refactor idEquals to utils (Raymond Feng)


2015-08-14, Version 2.37.0
==========================

 * Do not coerce RegExp objects to strings (Simon Ho)

 * Indicate result of destroyById/protototype.destroy (Fabien Franzen)

 * Removed extra ")" (Chris Finn)

 * Fixed typo & added the filter units (Chris Finn)


2015-08-05, Version 2.36.0
==========================

 * Report deferred exceptions via callback (Raymond Feng)

 * fixes issue 673: Include hasMany of relation does not return empty array (Kenta Fried)


2015-07-30, Version 2.35.3
==========================

 * Fix the test case with automigrate (Raymond Feng)


2015-07-30, Version 2.35.2
==========================

 * Fix regexp error for the memory connector (Simon Ho)


2015-07-29, Version 2.35.1
==========================

 * Fix error handling (Raymond Feng)


2015-07-29, Version 2.35.0
==========================

 * Remove test for unused utility function (Simon Ho)

 * Remove try/catch from find function (Simon Ho)

 * Add support for regex operator (Simon Ho)

 * Async 'loaded' hook for find (Pradnya Baviskar)

 * Promisify all 'discover' methods (Pradnya Baviskar)

 * Fix 'persist' hook for updateAttributes() (Pradnya Baviskar)


2015-07-22, Version 2.34.0
==========================

 * Don't enforce strictness if allowExtendedOperators: true (MongoDB) (Fabien Franzen)

 * Take strict: validate and throw settings into account (Fabien Franzen)

 * Filter attributes when strict: true (Fabien Franzen)


2015-07-21, Version 2.33.3
==========================

 * Make sure done() is called within the callback (Raymond Feng)


2015-07-18, Version 2.33.2
==========================

 * Add NOTICE (Raymond Feng)

 * prevent upsert overwriting default values with applyDefaultValues option (Bryan Clark)

 * use fromDb to deserialize data after save in Memory connector (Bryan Clark)

 * Correctly handle validatesUniquenessOf(idName) (Fabien Franzen)


2015-07-10, Version 2.33.1
==========================

 * Fix object merge (Raymond Feng)


2015-07-10, Version 2.33.0
==========================

 * Make sure base property definitions are cloned (Raymond Feng)


2015-07-03, Version 2.32.0
==========================

 * Fix the regression for date conversion (Raymond Feng)

 * Don't cache static scope method results #575 (Fabien Franzen)


2015-07-02, Version 2.31.1
==========================

 * Fix the regexp value for like/nlike (Raymond Feng)


2015-07-02, Version 2.31.0
==========================

 * Assert the existence of instance (Raymond Feng)

 * Make sure operator/options are honored (Raymond Feng)

 * Fix coercion from ObjectID to String (Raymond Feng)

 * Fix #623 - use actual id order (Fabien Franzen)

 * test: fix persistence-hooks failures in MySQL (Miroslav Bajtoš)

 * Includes with transaction support (Rus1)

 * Fix updateOrCreate transaction propagation (Rus1)

 * Fix promise chaining in case of error (Rus1)

 * Promisify 'autoupdate' (Pradnya Baviskar)

 * Add new hook 'loaded' (Pradnya Baviskar)


2015-06-16, Version 2.30.1
==========================

 * Ping async to 1.0.0 to work around context propagation (Raymond Feng)

 * Fix the test case (Raymond Feng)


2015-06-16, Version 2.30.0
==========================

 * Promisify 'automigrate' (Pradnya Baviskar)

 * check object exists before setting __cachedRelations (ningsuhen)

 * Fix the test case as updateAll takes `where` directly (Raymond Feng)

 * Fix for issues #622 & #623 (ningsuhen)

 * Add new hook 'persist' (Pradnya Baviskar)

 * Create a script to describe operation hooks (Miroslav Bajtoš)

 * Allow 0 as the FK (Raymond Feng)

 * fix typo (Clark Wang)

 * Dedupe ids args of inq for include (Raymond Feng)


2015-05-29, Version 2.29.2
==========================

 * Fix the test case (Raymond Feng)


2015-05-28, Version 2.29.1
==========================

 * Update deps (Raymond Feng)

 * Don't silently swallow db errors on validation. (Samuel Reed)

 * adapt coding style @bajtos (mamboer)

 * addressing #603 (Patrick Perini)

 * enhancement on #588 (mamboer)

 * fix issue #587 (mamboer)

 * add test suit for scope - dynamic function (Nemo)


2015-05-27, Version 2.29.0
==========================

 * Enhance the apis and add more tests (Raymond Feng)

 * Fix for https://github.com/strongloop/loopback/issues/1401 (Raymond Feng)

 * Fix ReferenceError: definition is not defined (Dmitry Manannikov)

 * Mix in observer apis to the connector (Raymond Feng)

 * Enhance fieldsToArray to consider strict mode (Raymond Feng)


2015-05-20, Version 2.28.1
==========================

 * Remove dep on sinon (Raymond Feng)

 * Update deps (Raymond Feng)


2015-05-18, Version 2.28.0
==========================

 * Make sure promise is returned (Raymond Feng)

 * Update deps to loopback-connector (Raymond Feng)

 * Fix comments (Raymond Feng)

 * Enable docs (Raymond Feng)

 * Add an optional `options` argument to relation methods (Raymond Feng)

 * Add transaction apis (Raymond Feng)

 * Refactor the observer functions into a plugin (Raymond Feng)

 * Add transaction (Raymond Feng)


2015-05-16, Version 2.27.1
==========================

 * Make sure relation scope is applied during include (Raymond Feng)

 * Updated JSdoc for Datasource constructor (crandmck)


2015-05-13, Version 2.27.0
==========================

 * Fix the target id resolution (Raymond Feng)

 * DB Call Optimization in relation includes - Fixes #408 & #166 (ningsuhen)

 * Conditionally pass options to connector CRUD methods (Raymond Feng)

 * Pass-through options from save to create (Fabien Franzen)


2015-05-05, Version 2.26.4
==========================

 * dao: support validateUpsert:false (Miroslav Bajtoš)

 * Changes to API docs per Dennis (Rand McKinney)

 * Add unit-test for "array" type (Miroslav Bajtoš)


2015-04-24, Version 2.26.3
==========================

 * Fix the test cases (Raymond Feng)

 * Add support for merging include filters (ningsuhen)

 * add test case for hasmanythrough bi-drectional relations (ningsuhen)

 * Fix for bug - https://github.com/strongloop/loopback-datasource-juggler/issues/571 (ningsuhen)


2015-04-24, Version 2.26.2
==========================

 * Allow leading slash for `path` in model settings (Raymond Feng)


2015-04-22, Version 2.26.1
==========================

 * validations: treat `NaN` as a blank value (Miroslav Bajtoš)


2015-04-22, Version 2.26.0
==========================

 * Allow custom name mapping for discovered models (Raymond Feng)


2015-04-17, Version 2.25.1
==========================

 * Validate model on updateOrCreate (upsert). (Miroslav Bajtoš)


2015-04-16, Version 2.25.0
==========================

 * Extend findById to accept an optional filter object (Raymond Feng)


2015-04-14, Version 2.24.0
==========================

 * Add new strict mode "validate" (Miroslav Bajtoš)

 * Promisify model relation methods (Partap Davis)

 * Deprecate property names containing a dot (Miroslav Bajtoš)

 * Allow nesting properties to be queried for memory connector (Raymond Feng)


2015-04-01, Version 2.23.0
==========================

 * Fix test for "after save" called on save/CREATE (Miroslav Bajtoš)

 * Code cleanup in lib/dao.js (Miroslav Bajtoš)

 * Save parent model of embedded relations (Fabien Franzen)

 * Pass options in operation hooks context. (Fabien Franzen)

 * check if id does not exist a bit more explicitly (Pulkit Singhal)

 * Fix persistUndefinedAsNull tests w/ SQL connectors (Miroslav Bajtoš)

 * Implement scope.updateAll (Fabien Franzen)

 * Fix the test cases so that they be run with the mssql connector (Raymond Feng)

 * Add model setting "persistUndefinedAsNull" (Miroslav Bajtoš)

 * Add abilities to remove and clear observers - Operation Hooks. (0angelic0)


2015-03-27, Version 2.22.0
==========================

 * Code cleanup in updateAll/deleteAll (Miroslav Bajtoš)

 * Return scope object from DAO.scope (Fabien Franzen)

 * Remove all usages of lodash. (Miroslav Bajtoš)

 * Clean up delete and update tests (Simon Ho)

 * Clean up wording in update/delete tests (Simon Ho)

 * Fix wording in update test (Simon Ho)

 * Properly support embedsMany destroyAll (Fabien Franzen)

 * Clean up update/delete manipulation tests (Simon Ho)

 * test: fix test failure in MySQL connector (Miroslav Bajtoš)

 * Improve test failure messages (Miroslav Bajtoš)

 * Fix regression in prototype.save (Miroslav Bajtoš)

 * Enable more CRUD remoting methods for embedsOne (Fabien Franzen)

 * Implement scope.findOne (Fabien Franzen)

 * use findOrCreate for HasManyThrough#create (Clark Wang)

 * Enhance id comparision for updateAttributes (Raymond Feng)

 * Enable custom methods on singular relations (Fabien Franzen)

 * Implement scope.findById (Fabien Franzen)

 * Fix updateAll callback in "transient" connector (Miroslav Bajtoš)

 * Memory connector returns updated records count (Simon Ho)

 * Add ctx.isNewInstance for "save" hooks (Miroslav Bajtoš)

 * deleteAll returns number of deleted records (Miroslav Bajtoš)

 * Use the correct way to iterate over an array (Raymond Feng)

 * DAO: Fix updateOrCreate to set persisted:true (Miroslav Bajtoš)

 * Reject CREATE with a duplicate id (Miroslav Bajtoš)

 * add tests for between in memory connector (Daniel B. Vasquez)

 * enable between filter for memory db connector (Daniel B. Vasquez)

 * fix #429 Multiple Models can't mixin same class (Clark Wang)


2015-03-16, Version 2.21.0
==========================

 * Fix the test case so that at least one property is to be changed (Raymond Feng)

 * Make sure id properties cannot be changed (Raymond Feng)


2015-03-12, Version 2.20.0
==========================

 * Remove trailing spaces. (Miroslav Bajtoš)

 * Improve instance-level operation hooks (Fabien Franzen)

 * Fix the test case (Raymond Feng)

 * fix foreign key dataType bug (didikeke)

 * Reformat notifyObserversOf context argument (Fabien Franzen)

 * Implement operation hooks' context (Fabien Franzen)

 * Allow submodel to hide base properties (Raymond Feng)


2015-03-04, Version 2.19.2
==========================

 * Improved and corrected API docs (crandmck)

 * Fix problems in annotations that prvented validateAsync and validate functions from appearing in API docs. (crandmck)


2015-03-03, Version 2.19.1
==========================

 * Make sure inclusion filter is applied to the target model (Raymond Feng)


2015-03-02, Version 2.19.0
==========================

 * Deprecate DAO events (Miroslav Bajtoš)

 * Deprecate Model hooks (Miroslav Bajtoš)

 * Add Promises to DAO (Partap Davis)

 * test for updateAll (rudzon)

 * enhance the coercion for boolean/date types (rudzon)

 * enhance updateAll to coerce the data per property definitions (rudzon)

 * relation-definition: remove trailing whitespace (Miroslav Bajtoš)


2015-02-20, Version 2.18.1
==========================

 * Make sure models are migrated to avoid conflicts (Raymond Feng)

 * Add err checks (Raymond Feng)

 * Fix findByIds test cases (Raymond Feng)


2015-02-20, Version 2.18.0
==========================

 * Fix the idType so that it works with both MongoDB and RDBs (Raymond Feng)

 * Tidy up tests so that they will work with RDBs (Raymond Feng)

 * Fix JS style issues (Raymond Feng)

 * Add a new property option `defaultFn` (Miroslav Bajtoš)

 * Fix the null/undefined check (Raymond Feng)

 * Fix createdAt type so that it won't overflow SQL server int (Raymond Feng)

 * ModelBaseClass: promise mode for notifyObserversOf (Miroslav Bajtoš)

 * ModelBaseClass: support promise-based observers (Miroslav Bajtoš)

 * use lodash to update the findBelongsTo which now returns an array of matches (Bryan Clark)

 * Add $now as shortcut default value for date property (Pradnya Baviskar)

 * Fix `deleteById(id)` and other test failures (Miroslav Bajtoš)


2015-02-11, Version 2.17.0
==========================

 * Add an optional `options` argument to all CRUD methods (Raymond Feng)

 * Upgrade deps (Raymond Feng)

 * Remove workaround for perfomance degradation (Denis Bardadym)

 * Change equal to eql to support mongodb ObjectID (Raymond Feng)

 * Enhance the coercion for boolean/date types (Raymond Feng)

 * Make sure base properties/settings are merged into the submodel (Raymond Feng)

 * support optimized findOrCreate (Clark Wang)

 * Fix the perf around should.not.equal for complex objects (Raymond Feng)

 * testcase for #420 (Andrey Loukhnov)

 * use findOrCreate in hasOne#create (Clark Wang)

 * Create model foreign key matching type of opposite part of relation (even if it has a custom field type) (Andrey Loukhnov)

 * minor formatting issues (trailing spaces and such) and .editorconfig (Andrey Loukhnov)


2015-02-05, Version 2.16.0
==========================

 * Return 400 when client provides an incorrect value (Pradnya Baviskar)

 * Relax "id" checks in test/manipulation.test.js (Miroslav Bajtoš)

 * Fix typo (Raymond Feng)

 * test: undefined property values are preserved (Miroslav Bajtoš)

 * Remove undefined properties for create (Raymond Feng)

 * Update to `should` to the latest version 4.6.3 (Miroslav Bajtoš)

 * Relax the id equality test for mongodb object ids (Raymond Feng)


2015-02-02, Version 2.15.0
==========================

 * Fix id type issue for update (Raymond Feng)

 * Rename hook "query" to "access" (Miroslav Bajtoš)

 * Implement intent hook `before delete` (Miroslav Bajtoš)

 * Remove redundant `.toObject()` call from `upsert` (Miroslav Bajtoš)

 * Fix regression in `.save()` from 1fd6eff1 (Miroslav Bajtoš)

 * Fix hasOne remoting (Raymond Feng)

 * Make sure batch create calls back with correct data (Raymond Feng)

 * Intent-based hooks for persistence (Miroslav Bajtoš)

 * ModelBaseClass: implement async observe/notify (Miroslav Bajtoš)

 * Upgrade `should` to the latest 1.x version (Miroslav Bajtoš)

 * Fixed nullCheck in validations to correct behavior when dealing with undefined attributes (James Billingham)

 * Supply target to applyProperties function (Fabien Franzen)

 * fix id property for composite ids (Clark Wang)

 * fix id properties should sort by its index (Clark Wang)

 * Fixed typos and logic for protected properties (Christian Enevoldsen)

 * adds support for protected properties. (Christian Enevoldsen)

 * support embeds data for belongsTo relation Signed-off-by: Clark Wang <clark.wangs@gmail.com> (Clark Wang)


2015-01-15, Version 2.14.1
==========================

 * Fix detection of `util.inspect` version (Miroslav Bajtoš)

 * fix recursive calls if create belongsTo model in beforeCreate hook (Clark Wang)


2015-01-14, Version 2.14.0
==========================

 * Remove console.log (Raymond Feng)

 * Fix for #369 (Dallon Feldner)

 * Fix virtual id get function. (Berkeley Martinez)

 * Fix Model.prototype.inspect (Miroslav Bajtoš)

 * Include property value in the error message (Miroslav Bajtoš)

 * Update datasource.js (Rand McKinney)

 * Change Model to BaseModel for clarity (Fabien Franzen)

 * Don't coerce nested objects into Model instances (Fabien Franzen)


2015-01-07, Version 2.13.0
==========================

 * added test for sorting undefined values (Christian Vette)

 * Fix the floating number comparison (Raymond Feng)

 * Fix bad CLA URL in CONTRIBUTING.md (Ryan Graham)

 * replace deprecated function __defineGetter__ (bitmage)

 * add a flag to callback of findOrCreate to indicate find or create (Clark Wang)

 * fix sorting of undefined values with multiple columns (Christian Vette)

 * code style (cvette)

 * fix sorting with undefined in memory connector (cvette)

 * Added support for inline parameters like: new GeoPoint(-34, 150) (Simo Moujami)

 * fix default include in default scope fails findById (Clark Wang)

 * Added test for toString() (Simo Moujami)

 * Additional formatting (Simo Moujami)

 * Fixed constructor parameters and added bdd tests for constructor validation (Simo Moujami)

 * Fixed indentation (Simo Moujami)

 * Added mocha tests for GeoPoint (Simo Moujami)

 * renamed intermediary variable (Simo Moujami)

 * Fixed the haversine formula to calculate distance between 2 points properly (Simo Moujami)


2014-12-08, Version 2.12.0
==========================

 * Relax the id comparison (Raymond Feng)

 * Allow more flavors of nullable values from DB discovery (Raymond Feng)

 * Fix a typo (Raymond Feng)

 * docs.json: add lib/model.js (Miroslav Bajtoš)

 * Update README.md (Rand McKinney)

 * fix embedsOne error when embed instance is undefined or null (Clark Wang)

 * Be explicit: set RelationDefinition multiple flag (Fabien Franzen)

 * Allow hasOne relation to have a scope option (Clark Wang)

 * fix skipping async validator will always fail if condition is un-fulfilled (Clark Wang)


2014-11-13, Version 2.11.0
==========================

 * Bump version (Raymond Feng)

 * handle relationship create with [array] (bitmage)

 * #350: Creating a batch via hasMany relation is failing. Added handling of array argument. (Alex Voitau)

 * #350: Creating a batch via hasMany relation is failing. Added context 'with scope' to allow individual execution of tests. (Alex Voitau)


2014-11-04, Version 2.10.3
==========================

 * Bump version (Raymond Feng)

 * Add support for multiple includes that use relation syntax (Raymond Feng)

 * Tests for non standard id - hasOne and polymorphic (Pandaiolo)

 * Fix HasOne PK on modelFrom instead of modelTo (Pandaiolo)

 * Remove "Suite" (Rand McKinney)

 * Tiny fix: default __persisted to false (Fabien Franzen)

 * Don't apply defaults when fields are specified (Fabien Franzen)


2014-10-21, Version 2.10.2
==========================

 * Bump version (Raymond Feng)

 * Fix the automigrate issue (Raymond Feng)


2014-10-15, Version 2.10.1
==========================

 * Bump version (Raymond Feng)

 * Enable include scope for belongsTo (Fabien Franzen)

 * Call relation methods in the right context (Fabien Franzen)


2014-10-13, Version 2.10.0
==========================

 * Bump version (Raymond Feng)

 * Don't inherit settings.base when extending a model (Miroslav Bajtoš)

 * Allow include syntax without scope param (Fabien Franzen)

 * Allow 'rel' and 'relation' (Fabien Franzen)

 * Refactored inclusion (Fabien Franzen)

 * Implement include scopes (Fabien Franzen)

 * Fix failing test (Fabien Franzen)

 * Allow `attributes` as an alias for `properties` (for LDL) (Fabien Franzen)

 * Cleanup, consistency: allow properties to be a function (Fabien Franzen)

 * applyProperties => properties (object/false) (Fabien Franzen)

 * Test default scope with relations (Fabien Franzen)

 * Allow default scope to be a function (Fabien Franzen)

 * Full test CRUD suite for default scope (Fabien Franzen)

 * Properly reset Memory connector cache on automigrate (Fabien Franzen)

 * Implemented collection setting for Memory connector (Fabien Franzen)

 * Extract mergeQuery and setScopeValuesFromWhere (Fabien Franzen)

 * Add contribution guidelines (Ryan Graham)

 * Fix camel-case issue where relation is 'hasAndBelongsToMany' #304 (Khashayar Hajian)

 * Test improvement, shows _targetClass camelCase bug (Khashayar Hajian)

 * Tidy up model building from data sources (Raymond Feng)


2014-09-12, Version 2.9.0
=========================

 * Bump version (Raymond Feng)

 * Fix to handle new isNewRecord implementation (Fabien Franzen)

 * Add test case for Numeric ids (with optional forceId) (Fabien Franzen)

 * Allow embedsOne to use auto-generated id (from connector) (Fabien Franzen)

 * Implemented persistent: true option for embedsOne (Fabien Franzen)

 * Introduce embedsMany persistent: true option (Fabien Franzen)

 * More tests for embedsMany with persistent model (Fabien Franzen)

 * Only check id as part of embedsMany relation (Fabien Franzen)

 * Fix multi-property validation definitions (Fabien Franzen)

 * Tiny fixes (Fabien Franzen)

 * DAO save() now uses isNewRecord() (Fabien Franzen)

 * More fixes/tests (Fabien Franzen)

 * Enforce id (prevent user-set value), fix isNewRecord (Fabien Franzen)

 * Test .value() method - as used by scope getter (Fabien Franzen)

 * embedsMany - implement sync scope getter (Fabien Franzen)

 * hasAndBelongsToMany - test sync scope getter (Fabien Franzen)

 * polymorphic hasMany - test sync scope getter (Fabien Franzen)

 * hasOne - test sync scope getter (Fabien Franzen)

 * hasMany through - sync scope getter (Fabien Franzen)

 * Scope method should return cached relation value (sync) (Fabien Franzen)

 * Export RelationClasses (Fabien Franzen)


2014-09-04, Version 2.8.0
=========================

 * Bump version (Raymond Feng)

 * Simplify the id lookup (Raymond Feng)

 * Remove legacy Schema references (Fabien Franzen)

 * getTransientSchema => getTransientDataSource (Fabien Franzen)

 * Re-use modelBuilder - correctly fixes lookup (Fabien Franzen)

 * Polymorphic lookup from all registered dataSources (Fabien Franzen)

 * Fix #283 (Fabien Franzen)

 * Isolate transient schema helper (Fabien Franzen)

 * tidy codes (Clark Wang)

 * Refector tests and codes (Clark Wang)

 * Refactor tests and codes (Clark Wang)

 * Refactor codes into same if condition (Clark Wang)

 * Remove only (Clark Wang)

 * Add tests for hasMany through between same model (Clark Wang)

 * Fix hasMany through can't custom relation name (Clark Wang)

 * Added a test case for neq (Raymond Feng)

 * Fix typo of keyThrough and get from params (Clark Wang)

 * Remove unnecessary console.log (Clark Wang)

 * Fix options for hasManyThrough doesn't apply (Clark Wang)

 * revert eof (Clark Wang)

 * Revert leading spaces (Clark Wang)

 * revert change to ReferencesMany.prototype.add (Clark Wang)

 * add jsdoc and fix add data to referencesMany.add (Clark Wang)

 * Allow to add connection with through data for HasManyThrough relation (Clark Wang)

 * fix polymorphicName var scope (Clark Wang)

 * Reset json when building model definition (Fabien Franzen)

 * Add hint, minor cleanup (Fabien Franzen)

 * Enable dynamic modelTo for scopes (Fabien Franzen)

 * Updated embedded relations to use transient connector (Fabien Franzen)

 * Implemented Transient connector (Fabien Franzen)

 * Fix error messages, should be lowercase (Fabien Franzen)

 * Add neq operator support for memory connector (Raymond Feng)

 * Remove iteration of config args (Fabien Franzen)

 * Validations configuration as object (Fabien Franzen)

 * Applied Coobaha's PR fix - prevents undefined values (Fabien Franzen)

 * Expose validation metadata (Fabien Franzen)


2014-08-27, Version 2.7.0
=========================

 * Bump version (Raymond Feng)

 * Make sure timeout handle is cleared (Raymond Feng)

 * Make sure error events are emitted by data source (Raymond Feng)

 * Implement where arg on scoped count and destroyAll (Fabien Franzen)


2014-08-25, Version 2.6.1
=========================

 * Bump version (Raymond Feng)

 * Tweak the model names used by tests to avoid mssql conflicts (Raymond Feng)

 * Use the correct dataSource for modelFrom/modelTo (Fabien Franzen)


2014-08-22, Version 2.6.0
=========================

 * Bump version (Raymond Feng)

 * Emit deleted event on delete for embedsMany relations (Jaka Hudoklin)

 * Add ping() to test connections (Raymond Feng)


2014-08-21, Version 2.5.2
=========================

 * Bump version (Raymond Feng)

 * Make sure falsy value is kept for properties not predefined (Raymond Feng)


2014-08-21, Version 2.5.1
=========================

 * Bump version (Raymond Feng)

 * Fix side-effects of PR #237 - see #242 (Fabien Franzen)


2014-08-20, Version 2.5.0
=========================

 * Bump version (Raymond Feng)

 * Save the instance even the callback is not present (Raymond Feng)

 * Fix the embedsOne test cases (Raymond Feng)

 * Fix test cases (Raymond Feng)

 * Validate embedded models by default (Fabien Franzen)

 * Implemented embedsOne (Fabien Franzen)

 * Coerce embedded model types (Fabien Franzen)

 * Implement DAO unsetAttribute (Fabien Franzen)

 * Implemented belongsTo update/destroy on scope (Fabien Franzen)

 * Implemented hasOne destroy() (Fabien Franzen)

 * Implemented hasOne update() (Fabien Franzen)

 * Implement update() on embedsOne scope (Fabien Franzen)

 * Fix relations for RDBMS connectors (mysql, postgresql) (Fabien Franzen)


2014-08-18, Version 2.4.2
=========================

 * Bump version (Raymond Feng)

 * Prevent failure with null in List toObject (Fabien Franzen)

 * Fix ModelDefinition toJSON bug (Fabien Franzen)

 * Add ability to apply a plugin multiple times from LDL (Fabien Franzen)

 * HasMany exists should use internal findById (Fabien Franzen)

 * Tiny fix: obsolete i8n require (Fabien Franzen)

 * Properly handle LDL for polymorphic relations (Fabien Franzen)


2014-08-15, Version 2.4.1
=========================

 * Bump version (Raymond Feng)

 * Check null (Raymond Feng)


2014-08-15, Version 2.4.0
=========================

 * Bump version (Raymond Feng)

 * Fix the test cases to avoid hard-coded ids (Raymond Feng)

 * Add strict flag to sortObjectsByIds (Fabien Franzen)

 * Fix conflicts (Fabien Franzen)

 * Moved DataAccessObject.sortByIds to utils.js (Fabien Franzen)

 * Remove redundant test (Fabien Franzen)

 * Allow partial list of ids for sortByIds (Fabien Franzen)

 * Fixed duplicate code (Fabien Franzen)

 * Implement embedded.destroy() integration (Fabien Franzen)

 * Refactor embedsMany - auto-save parent (Fabien Franzen)

 * Refactor polymorphic relations, fix inverse #215 (Fabien Franzen)

 * Clarified tests, fixed BelongsTo.prototype.create (Fabien Franzen)

 * Handle toObject in updateAttributes (Fabien Franzen)

 * Fix formatting (Fabien Franzen)

 * Fix scopeMethods closure issue (Fabien Franzen)

 * Refactored embedsMany (relationName vs. propertyName) (Fabien Franzen)

 * Enable DL definition of embedsMany + referencesMany (Fabien Franzen)

 * Refactor modelTo logic into lookupModelTo (Fabien Franzen)

 * Allow runtime override of scope/relation order query param (Fabien Franzen)

 * Implement scope.defineMethod/relation.defineMethod (Fabien Franzen)

 * add count to relations (Jaka Hudoklin)

 * Fix links to confluence docs (Rand McKinney)

 * Tiny fix: use setAttributes (Fabien Franzen)

 * Cleanup mixin tests (Fabien Franzen)


2014-08-08, Version 2.3.1
=========================

 * Fix a name conflict in scope metadata (Raymond Feng)


2014-08-08, Version 2.3.0
=========================

 * Fix the test case so that it works with other DBs (Raymond Feng)

 * Bump version (Raymond Feng)

 * Pass options into scope (Raymond Feng)

 * Add scope definitions to the model class (Raymond Feng)

 * Clean up the mixin processing (Raymond Feng)

 * Fix bug when using multiple include keys (Laurent)

 * Unified plugins into mixins (Fabien Franzen)

 * Fix typo: loadPlugin(s) (Fabien Franzen)

 * Minor touch-ups (Fabien Franzen)

 * Basic plugin architecture (Fabien Franzen)


2014-08-07, Version 2.2.2
=========================

 * Bump version (Raymond Feng)

 * Upgrade qs (Raymond Feng)

 * Upgrade qs version (Raymond Feng)


2014-08-04, Version 2.2.1
=========================

 * Bump version (Raymond Feng)

 * Changed options.path to option.http.path (Fabien Franzen)

 * Removed normalization (see strong-remoting) (Fabien Franzen)

 * Emit dataAccessConfigured events during attach (Raymond Feng)

 * Changed normalization api - enabled hasOne remoting (Fabien Franzen)

 * Customize/Normalize class-level remoting http path (Fabien Franzen)

 * Add test to protect the use of include in related method (Laurent Chenay)

 * Do not overwrite inclusion but scope them. Needed in relation hasManyThrought (Laurent Chenay)


2014-07-30, Version 2.2.0
=========================

 * fix datasources to support new model parameters (Jaka Hudoklin)

 * Bump version (Raymond Feng)

 * Correctly handle remoting of scope methods (Fabien Franzen)

 * Handle remoting of custom scope methods (Fabien Franzen)

 * ReferencesMany fixes after LB integration tests (Fabien Franzen)

 * Fixed embedsMany after LB integration (Fabien Franzen)

 * Fix the test failure for mongodb (Raymond Feng)

 * Allow custom scopeMethods option (obj/fn) for relation scopes (Fabien Franzen)

 * Renamed EmbedsMany 'reference' option to 'belongsTo' (Fabien Franzen)

 * Implemented referencesMany (Fabien Franzen)

 * Added option: reference to enable embedsMany add/remove (Fabien Franzen)

 * Implemented findByIds (Fabien Franzen)

 * Minor touchups (Fabien Franzen)

 * Tests for polymorphic embedsMany (Fabien Franzen)

 * Implemented more complex scenaro: embedsMany + relations (Fabien Franzen)

 * Convenience embedsMany accessors: at(idx), get(id), set(id, data) (Fabien Franzen)

 * Fix test cases (Raymond Feng)

 * Increase the max number of model listeners (Raymond Feng)

 * Remove unused data (Raymond Feng)

 * Export GeoPoint class (Raymond Feng)

 * Fix HEAD on relation hasMany (Laurent Chenay)

 * Updated remaining relations to use polymorphicParams (Fabien Franzen)

 * polymorphics can now be declared using object (Fabien Franzen)

 * typeTo => discriminator (Fabien Franzen)

 * Require unique ids for embedded items (Fabien Franzen)

 * Test build of embedsMany (Fabien Franzen)

 * Minor fix (Fabien Franzen)

 * Added validation for embedded items (optional) (Fabien Franzen)

 * Implemented embedsMany relation (Fabien Franzen)

 * Minor tweaks; pass-through properties/scope for hasAndBelongsToMany (Fabien Franzen)

 * Implemented polymorphic hasMany through inverse (Fabien Franzen)

 * More hasAndBelongsToMany tests (Fabien Franzen)

 * Minor cleanup (Fabien Franzen)

 * Implemented polymorphic hasOne (Fabien Franzen)

 * Implemented polymorphic hasAndBelongsToMany (Fabien Franzen)

 * Implemented polymorphic hasMany (Fabien Franzen)


2014-07-27, Version 2.1.1
=========================

 * Bump version (Raymond Feng)

 * Fix a regression where undefined id should not match any record (Raymond Feng)


2014-07-27, Version 2.1.0
=========================

 * Bump version (Raymond Feng)

 * datasource: support connectors without `getTypes` (Miroslav Bajtoš)

 * relation: add `scope._target` for `hasOne` (Miroslav Bajtoš)

 * Fix scoped destroyAll: only use 'where', not full 'filter' args (Fabien Franzen)

 * Added test for belongsTo scope/properties (Fabien Franzen)

 * Implement scope/properties for BelongsTo (+ fix foreign key matching) (Fabien Franzen)


2014-07-22, Version 2.0.0
=========================

 * add support for disabling relationship includes (Jaka Hudoklin)

 * add support for relationship options (Jaka Hudoklin)

 * Move relation remoting to loopback (Raymond Feng)


2014-07-21, Version 2.0.0-beta5
===============================

 * Bump version (Raymond Feng)

 * Expose base model class as `base` property (Raymond Feng)


2014-07-16, Version 2.0.0-beta4
===============================

 * Add missing inflection dep back (Raymond Feng)


2014-07-15, Version 2.0.0-beta3
===============================

 * Bump version (Raymond Feng)

 * 2.0.0-beta2 (Miroslav Bajtoš)

 * validations: support non-V8 browsers (Miroslav Bajtoš)

 * Remove remoting metadata (Raymond Feng)

 * Fix the forEach closure (Raymond Feng)

 * ModelBuilder: add `prototype.defineValueType` (Miroslav Bajtoš)

 * Replace connector base with loopback-connector (Miroslav Bajtoš)

 * Remove unsupported connectors (Miroslav Bajtoš)

 * 2.0.0-beta1 (Ritchie Martori)

 * Keep undefined/null values for the array type (Raymond Feng)

 * Remove JSDocs for scopeMethods.add(acInst) and scopeMethods.remove(acInst) (crandmck)

 * Copy info from api-model.md to JSDoc (crandmck)

 * !fixup Remove additional remoting (Ritchie Martori)

 * !fixup Require ._delegate for fn override (Ritchie Martori)

 * Remove relation remoting (Ritchie Martori)

 * Remove remoting metadata (Ritchie Martori)


2014-07-15, Version 1.7.0
=========================

 * Make sure related properties are defined for RDBMS (Raymond Feng)

 * Test instance or id by the model type (Raymond Feng)

 * Bump version (Raymond Feng)

 * Allow before hooks to pass arguments to next() (Raymond Feng)

 * Remoting methods for hasMany through (Raymond Feng)

 * Fix the error message (Raymond Feng)

 * Sign-off (Fabien Franzen)

 * Renamed mapping to properties (Fabien Franzen)

 * Fix validateUniqueness/nextTick (Fabien Franzen)

 * Handle custom error codes (Fabien Franzen)

 * More validations and tests (Fabien Franzen)

 * Don't check uniqueness of blank values (Fabien Franzen)

 * RelationDefinition applyScope/applyMapping (Fabien Franzen)

 * Allows default model class to be configured (Raymond Feng)

 * DAO.prototype.exists should return 'boolean' type. (Samuel Reed)


2014-07-03, Version 1.6.3
=========================

 * Make sure 'deleteById' is used as the remote operation name (Miroslav Bajtoš)

 * Make sure 'upsert' is used as the remote operation name (Raymond Feng)


2014-06-27, Version 1.6.2
=========================

 * Bump version and update deps (Raymond Feng)

 * Normalize filter.order and enforce more checks (Raymond Feng)

 * Make sure type of the foreign key match the primary key (Raymond Feng)

 * Add "hasOne" to relationTypes (Ritchie Martori)

 * Update link to doc (Rand McKinney)


2014-06-24, Version 2.0.0-beta2
===============================

 * validations: support non-V8 browsers (Miroslav Bajtoš)

 * Work around for Date default (Raymond Feng)

 * Synchronize with cachedRelations (Raymond Feng)

 * Remove remoting metadata (Raymond Feng)

 * Fix the forEach closure (Raymond Feng)

 * ModelBuilder: add `prototype.defineValueType` (Miroslav Bajtoš)

 * Replace connector base with loopback-connector (Miroslav Bajtoš)

 * Remove unsupported connectors (Miroslav Bajtoš)

 * 2.0.0-beta1 (Ritchie Martori)

 * Keep undefined/null values for the array type (Raymond Feng)

 * Remove JSDocs for scopeMethods.add(acInst) and scopeMethods.remove(acInst) (crandmck)

 * Copy info from api-model.md to JSDoc (crandmck)

 * !fixup Remove additional remoting (Ritchie Martori)

 * !fixup Require ._delegate for fn override (Ritchie Martori)

 * Remove relation remoting (Ritchie Martori)

 * Remove remoting metadata (Ritchie Martori)


2014-06-20, Version 1.6.1
=========================

 * Bump version (Raymond Feng)

 * Fix the test case (Raymond Feng)

 * Use async for flow control (Raymond Feng)

 * Clean up comments (Raymond Feng)

 * Fix the error msg (Raymond Feng)

 * More clean up for the scope processing (Raymond Feng)

 * Add more jsdocs (Raymond Feng)

 * Optimize model instantiation and conversion (Raymond Feng)

 * Add hooks remove dao (Rand McKinney)

 * Add hooks and include mixins (crandmck)

 * Enhance the wildcard to regexp conversion (Raymond Feng)

 * Add like/nlike support for memory connector (Raymond Feng)

 * Add support for updating multiple instances with query (Raymond Feng)

 * Minor JSDoc cleanup (crandmck)

 * Initial JSDoc cleanup (crandmck)

 * Add ModelBuilder class (crandmck)

 * Allows skip or offset (Raymond Feng)

 * Adding back the remoting metadata (Raymond Feng)

 * Clean up scope implementation (Raymond Feng)

 * Add support for hasOne (Raymond Feng)

 * Fix the hasMany through connection (Raymond Feng)

 * Refactor relation into classes (Raymond Feng)

 * Add properties and other doc cleanup (crandmck)

 * Convert null to NotFoundError for remoting call to DataAccessObject.findOne. (Alberto Leal)

 * Fix the comparison for null/boolean values (Raymond Feng)

 * More JSDoc cleanup (crandmck)

 * Add boolean tests (Raymond Feng)

 * Fix the typo (Raymond Feng)

 * Make sure the records are sorted by seq (Raymond Feng)

 * Add more tests (Raymond Feng)

 * Enhance comparators for memory connector (Raymond Feng)

 * Update datasource.js (Rand McKinney)

 * Update docs.json (Rand McKinney)


2014-06-04, Version 1.5.5
=========================

 * Bump version (Raymond Feng)

 * Fix the logical operator check (Raymond Feng)

 * Fix JS doc for private methods (Raymond Feng)

 * Normalize/validate the query filter object (Raymond Feng)

 * Use connector's buildWhere to implement count (Raymond Feng)

 * JSDoc improvements (Rand McKinney)

 * validations: include more details in `err.message` (Miroslav Bajtoš)


2014-05-27, Version 1.5.4
=========================

 * Bump version (Raymond Feng)

 * Keep undefined/null values for the array type (Raymond Feng)

 * Remove JSDocs for scopeMethods.add(acInst) and scopeMethods.remove(acInst) (crandmck)

 * Copy info from api-model.md to JSDoc (crandmck)

 * validations: include more details in `err.message` (Miroslav Bajtoš)

 * Add a path to show customer.orders(query, cb) (Raymond Feng)

 * Add support for logical operator (AND/OR) (Raymond Feng)


2014-05-20, Version 1.5.2
=========================

 * validations: include more details in `err.message` (Miroslav Bajtoš)


2014-05-16, Version 1.5.1
=========================

 * Bump version (Raymond Feng)

 * Add a path to show customer.orders(query, cb) (Raymond Feng)

 * Fix typo "Unkown" => "Unknown" (Adam Schwartz)

 * Updated JSDoc comments with content from .md file (crandmck)

 * Add support for logical operator (AND/OR) (Raymond Feng)


2014-05-15, Version 1.5.0
=========================

 * validations: support multi-key unique constraint (Miroslav Bajtoš)

 * Update JSDoc comments with content from api-model.md (crandmck)

 * Add JSDoc for lat and lng properties. (Rand McKinney)

 * Add missing changed event (Ritchie Martori)

 * Local Storage (Ritchie Martori)

 * Do not .toObject if already Object (Ritchie Martori)

 * Fix bug where invalid relations in include filters would hang the server (Zack Bloom)

 * Update deps (Raymond Feng)


2014-05-13, Version 1.3.13
==========================

 * Bump version (Raymond Feng)

 * Add test cases for updateOrCreate/save and fix related issues (Raymond Feng)

 * Remove undefined for the data to be saved (Raymond Feng)

 * Remove the undefined property to avoid mongodb upsert overwrite (Raymond Feng)

 * Make sure ObjectID type is not parsed as object (Raymond Feng)

 * Fix JSDoc - remove newlines from function alias declarations, etc. (crandmck)

 * Correct JSDoc for discoverModelDefinitions (Rand McKinney)

 * Fix remoting for IDs in URLs (Ritchie Martori)

 * Add hidden property support (Ritchie Martori)

 * scope-like remotable metadata for belongsTo (Miroslav Bajtoš)


2014-04-04, Version 1.3.10
==========================

 * Bump version (Raymond Feng)

 * Fix the method for belongsTo with correct receiver (Raymond Feng)


2014-04-04, Version 1.3.9
=========================

 * scope: improve description of shared methods (Miroslav Bajtoš)

 * Re-enable skipped test. (Miroslav Bajtoš)

 * scope: add _targetClass to scope property (Miroslav Bajtoš)


2014-03-27, Version 1.3.8
=========================

 * Bump version (Raymond Feng)

 * Remove the disconnect to avoid race condition (Raymond Feng)

 * Fix the base sql connector to correct escape id values (Raymond Feng)

 * Set the relation property correctly (Raymond Feng)


2014-03-19, Version 1.3.7
=========================

 * Bump version (Raymond Feng)

 * Simplify the inclusion processing (Raymond Feng)

 * Create scoped methods for belongsTo and improve docs (Raymond Feng)

 * Fix the connector resolver to make sure known connectors are used (Raymond Feng)

 * Refactor the serialize/deserialize into two functions (Raymond Feng)

 * Fix some small errors (crandmck)

 * Updates for JSDoc changes for API doc. (Rand McKinney)

 * Updates to JSDoc comments for API doc (crandmck)


2014-03-04, Version 1.3.6
=========================

 * Bump version (Raymond Feng)

 * Use debug module for logging (Raymond Feng)

 * Fix the parameter name (Raymond Feng)

 * Allows scopes to be defined in LDL (Raymond Feng)

 * Check the Array type (Raymond Feng)

 * Make the belongsTo relation remotable (Raymond Feng)

 * Fix the example for scope (Raymond Feng)


2014-02-27, Version 1.3.5
=========================

 * Bump version (Raymond Feng)

 * Fix, model builder setter will not try to cast value if already the proper type (Aurelien Chivot)


2014-02-25, Version 1.3.4
=========================

 * Bump version (Raymond Feng)

 * Allows unknown properties to be saved for non-strict models (Raymond Feng)


2014-02-21, Version 1.3.3
=========================

 * Bump version and update deps (Raymond Feng)

 * Refactor mixin and always redefine proxy/delegate methods (Ritchie Martori)

 * Override existing methods when mixing in DAO methods (Ritchie Martori)

 * Update license to dual MIT/StrongLoop (Raymond Feng)

 * Leave the item type introspection for List (Raymond Feng)

 * Rewrite the List class for typed array (Raymond Feng)

 * Fix the include with array value (Raymond Feng)


2014-02-13, Version 1.3.2
=========================

 * Bump version (Raymond Feng)

 * Simplify the test case (Raymond Feng)

 * Add unit test for datatype handling in updateAttributes. (arlaneenalra)

 * Move new var into thunk. (arlaneenalra)

 * Use type converted data when writing back to database. (arlaneenalra)


2014-02-11, Version 1.3.1
=========================

 * Bump version (Raymond Feng)

 * Revert the inflection version due to regression in camelize (Raymond Feng)


2014-02-11, Version 1.3.0
=========================

 * Bump version and update deps (Raymond Feng)

 * Add a test case (Raymond Feng)

 * Clean up the options for model constructor (Raymond Feng)

 * Enhance the assertions (Raymond Feng)

 * Make sure own properties are copied by toObject for non-strict mode (Raymond Feng)

 * Use String[] for types and add test for supported types (Raymond Feng)

 * Add getType/getDefaultIdType from connectors (Raymond Feng)

 * Fix the write closure to use the correct task info (Raymond Feng)

 * Add a file option for the memeory connector to persist data (Raymond Feng)

 * Add tests for change / delete events (Ritchie Martori)

 * Add more comments (Raymond Feng)

 * Clean up lookupModel (Raymond Feng)

 * Handle hasMany.though (Raymond Feng)

 * Add change / delete events (Ritchie Martori)

 * Make sure __cachedRelations is not enumerable (Raymond Feng)

 * Add tests (Raymond Feng)

 * Promote the included relations as properties (Raymond Feng)


2014-01-27, Version 1.2.13
==========================

 * Reformat the code (Raymond Feng)

 * Improve links to docs (Rand McKinney)

 * Use the primary key type for the generated foreign key (Raymond Feng)

 * Fill ModelClass.http.path (Miroslav Bajtoš)

 * Fix jsdoc code examples formatting (Giustino Borzacchiello)


2014-01-13, Version 1.2.12
==========================

 * Bump version (Raymond Feng)

 * Make the code testable following the review comments (Raymond Feng)

 * Allows the full module name for connectors (Raymond Feng)


2013-12-20, Version 1.2.11
==========================

 * Bump version (Raymond Feng)

 * Add more comments (Raymond Feng)

 * Fix the remote delegation (Raymond Feng)

 * Fix the remoting method with the current receiver (this) (Raymond Feng)

 * Add a EOL (Raymond Feng)

 * Add models to LDL options (Raymond Feng)

 * Fix a bug in merging ACLs (Raymond Feng)


2013-12-16, Version 1.2.10
==========================

 * Bump version (Raymond Feng)

 * Make the identation consistent for now (Raymond Feng)

 * Split the tests (Raymond Feng)

 * Fix a regression in mongodb connector (Raymond Feng)

 * Add more comments (Raymond Feng)

 * Check for null & undefined values (Raymond Feng)

 * Fix the coercion issue related to GeoPoint near (Raymond Feng)


2013-12-14, Version 1.2.9
=========================

 * Bump version (Raymond Feng)

 * Dedupe the alias methods during mixin (Raymond Feng)


2013-12-13, Version 1.2.8
=========================

 * Always call inherits to ensure prototypes are setup (Ritchie Martori)


2013-12-10, Version 1.2.7
=========================

 * Bump version (Raymond Feng)

 * Add more tests to address the PR comments (Raymond Feng)

 * Add a test case (Raymond Feng)

 * Coerce types for values of where clause (Raymond Feng)


2013-12-06, Version 1.2.6
=========================

 * Enhance the test case with more assertions (Raymond Feng)

 * Fix belongsTo relation (Raymond Feng)

 * Attach models to the data source (Raymond Feng)

 * Make all methods proxied for DAO (Raymond Feng)

 * Clone shared methods so that they can be customized per model (Raymond Feng)


2013-12-04, Version 1.2.5
=========================

 * Bump version (Ritchie Martori)

 * Improve properties of ValidationError (Miroslav Bajtos)

 * Removed most text that's in docs.strongloop.com (Rand McKinney)

 * REST call of DataAccessObject.findById returns 404 (Miroslav Bajtos)

 * Add .jshintignore (Miroslav Bajtos)


2013-11-20, Version 1.2.4
=========================

 * Bump version (Raymond Feng)

 * Add properties/methods to DataSource from ModelBuilder (Raymond Feng)

 * Update docs.json (Rand McKinney)


2013-11-19, Version 1.2.3
=========================

 * Bump the version (Raymond Feng)

 * Fix the model attachment to data source (Raymond Feng)

 * Replace all with find to make it consistent (Raymond Feng)


2013-11-18, Version 1.2.2
=========================

 * Rename association to relation (Raymond Feng)

 * Bump version and remove blanket (Raymond Feng)

 * Fix the reference to modelBuilder/dataSource (Raymond Feng)

 * Separate the modelBuilder ref from dataSource (Raymond Feng)

 * Wrap README.md at 78 characters where possible (Ryan Graham)

 * Bump version (Raymond Feng)

 * Fix the relation lazy setup (Raymond Feng)

 * Stop overwriting the static methods (Raymond Feng)

 * Ensure the model is attached to DataSource for relations (Raymond Feng)

 * Remove inheritence from DataSource to ModelBuilder (Raymond Feng)

 * Update to 1.2.0 (Raymond Feng)

 * Add travis (Ritchie Martori)

 * Add more assertions (Raymond Feng)

 * Allow settings.base to specify the base model (Raymond Feng)

 * Extract the relation types (Raymond Feng)

 * Add a test case for relations during attach (Raymond Feng)

 * Refactor the relation handling and enable it with attach (Raymond Feng)

 * Redefine the existing class if it's resolved (Raymond Feng)

 * Add support for hasMany-through and more tests (Raymond Feng)

 * Enable deferred type/relation resolutions (Raymond Feng)

 * Add model.getDataSource() method (Ritchie Martori)

 * Fix removeUndefined to bypass non-plain objects (Raymond Feng)

 * Fix the regression when 1st arg is the connector module (Raymond Feng)

 * Improve the docs for model relations using diagrams (Raymond Feng)

 * Add a relation example following Ruby on Rails active records (Raymond Feng)

 * Honor the model plural name (Raymond Feng)

 * Support datasource/connector configuration using URL string (Raymond Feng)

 * Create remote functions for predefined scopes/relations (Raymond Feng)

 * Check undefined/null data (Raymond Feng)

 * Add 'plural' setting (Raymond Feng)

 * Add index to name prop (Raymond Feng)

 * Move resolveType to ModelBuilder (Raymond Feng)

 * Fix prototype mixin bug (Ritchie Martori)

 * Make sure model definition is built when attaching to a DS (Raymond Feng)

 * Remove undefined values from the query object (Raymond Feng)

 * Log more information for the connection failure (Raymond Feng)

 * Handle connection errors (Raymond Feng)

 * Fix EventEmitter mixin (Ritchie Martori)

 * Make sure foreign key properties are fully registered (Raymond Feng)

 * Use for-in loop to support properties from the super class (Raymond Feng)

 * Allow the id(s) to be redefined by subclass (Raymond Feng)

 * Allow to reference a model as type by name (Raymond Feng)

 * Code clean up (Raymond Feng)

 * Add more tests and fix toJSON (Raymond Feng)

 * Fix the foreign key definition (Raymond Feng)

 * Add settings property back to the model class (Raymond Feng)

 * Set name and settings (Raymond Feng)

 * Reset _ids for rebuild (Raymond Feng)

 * Fix the columnName (Raymond Feng)

 * Use super_ to call the base class (Raymond Feng)

 * Fix copy of model definitions (Raymond Feng)

 * Export Connector class (Raymond Feng)

 * Use ModelDefinition to access model name/properties/settings (Raymond Feng)

 * Refactor/cleanup the data source juggler implementation (Raymond Feng)

 * Add a ModelDefinition class (Raymond Feng)

 * Make sure schemaless property value is honored over __data (Raymond Feng)

 * Update LDL doc for the strict mode (Raymond Feng)


2013-09-12, Version strongloopsuite-1.0.0-5
===========================================



2013-09-12, Version strongloopsuite-1.0.0-4
===========================================

 * Allow connector to report failure during initialization (Raymond Feng)

 * Add error stack trace for ValidationError (Raymond Feng)


2013-09-11, Version strongloopsuite-1.0.0-3
===========================================

 * Set up assets to support embedded diagrams (Raymond Feng)

 * Add keywords to package.json (Raymond Feng)


2013-09-10, Version strongloopsuite-1.0.0-2
===========================================

 * Finalize package.json for sls-1.0.0 (Raymond Feng)


2013-09-09, Version strongloopsuite-1.0.0-1
===========================================

 * Check the filter param to make sure we have a default value (Raymond Feng)


2013-09-04, Version 1.2.0
=========================



2013-09-04, Version strongloopsuite-1.0.0-0
===========================================

 * Tidy up package.json for LoopBack 1.0.0 (Raymond Feng)

 * Update license file (Raymond Feng)

 * Fix the conflicts between MongoDB _id & juggler's internal prefix (Raymond Feng)

 * Set default value (Raymond Feng)

 * Fix the property population for schemaless models (Raymond Feng)

 * Adjust the lines to fit into width of 80 (Raymond Feng)

 * Check the existence of id (Raymond Feng)

 * Allows custom name of the id property for the memory connector (Raymond Feng)

 * Mark id arguments to be required (Raymond Feng)

 * Update titles (Raymond Feng)

 * Clean up the test case based on PR reviews (Raymond Feng)

 * Set strict to false by default for non-relational data sources (Raymond Feng)

 * Disable remoting for reload (Raymond Feng)

 * Add descriptions for remote method paramters (Raymond Feng)

 * Fix the remote method descriptions (Raymond Feng)

 * Update guides (Raymond Feng)

 * Track the greatest id to prevent records from being overriden (Raymond Feng)

 * Update descriptions to use data source (Raymond Feng)

 * Refactor the shared method declaration and add descriptions (Raymond Feng)

 * Update docs (Raymond Feng)

 * Update header levels (Raymond Feng)

 * Fix the message (Raymond Feng)

 * Update LDL guide (Raymond Feng)

 * Fix the test description (Raymond Feng)

 * Use DEBUG or NODE_DEBUG env to override the debug flag (Raymond Feng)

 * Fix the where option for delete (Raymond Feng)

 * Update the remote methods (Raymond Feng)

 * Update ldl.md (Raymond Feng)

 * Start to add LDL guide (Raymond Feng)

 * Remove the deletion of property type as the instane is shared by the base model class (Raymond Feng)

 * Remove the semicov dependency as now we use blanket (Raymond Feng)

 * Add LICENSE (Raymond Feng)

 * Fix the id references to allow custom name other than 'id' (Raymond Feng)

 * Add missing declaration (Raymond Feng)

 * Update jsdocs (Raymond Feng)

 * Added blanket.js for code coverage (cgole)

 * Refactor the docs into one (Raymond Feng)

 * Add docs.json and jsdocs (Raymond Feng)

 * Add an optional models argument to automigrate/autoupdate (Raymond Feng)

 * Refactor introspection to ModelBuilder (Raymond Feng)

 * Rename 'loopback-data' to 'loopback-datasource-juggler' (Raymond Feng)

 * Allows connector property to be a string (Raymond Feng)

 * Add a diagram (Raymond Feng)

 * Add required validation (Ritchie Martori)

 * Add a schemaless example (Raymond Feng)

 * Bring up json object introspection to build models (Raymond Feng)

 * Fix the constructor (Raymond Feng)

 * Add precision/scale for sync discovery (Raymond Feng)

 * Add precision/scale (Raymond Feng)

 * Remove validations (Ritchie)

 * Remove old model documentation (Ritchie)

 * Fix typo (Ritchie)

 * Removed hooks documentation (Ritchie)

 * Refactor types out (Raymond Feng)

 * Rename the test case (Raymond Feng)

 * Fix the ref to dataSource (Raymond Feng)

 * Allows non-strict mode to accept unknown properties (Raymond Feng)

 * Fix id references (Raymond Feng)

 * Add root true to remote methods (Ritchie)

 * Update docs for loopback-data (Raymond Feng)

 * Rename adapters to connectors (Raymond Feng)

 * Set up connector from the data source (Raymond Feng)

 * Rename dataSource() to avoid conflicts with the property (Raymond Feng)

 * Fix schema references (Raymond Feng)

 * Set up connector/adapter when postInit is not called (Raymond Feng)

 * More renames: schema -> dataSource, adapter -> connector (Raymond Feng)

 * Clean up docs (Raymond Feng)

 * Update README (Raymond Feng)

 * ADL --> LDL (Raymond Feng)

 * Add the id arg (Raymond Feng)

 * Add static deleteById (Raymond Feng)

 * Fix the model prop lookup (Raymond Feng)

 * Allow queries to filter fields (Ritchie Martori)

 * Add filter.fields support to dao and memory connector (Ritchie Martori)

 * README updates (Ritchie Martori)

 * Rename jugglingdb to loopback-data (Raymond Feng)

 * README.md renames (Ritchie Martori)

 * Remove updateAttribute as remote method (Ritchie Martori)

 * Fix inherit bug (Ritchie Martori)

 * Fix extend by using util.inherits (Ritchie Martori)

 * Fix typos (Raymond Feng)

 * Only flatten array/object for relational DBs (Raymond Feng)

 * Add support for nesting objects with an array (Raymond Feng)

 * Add plain string array (Raymond Feng)

 * Fix the array data population (Raymond Feng)

 * Add http mapping for create/updateAttributes methods (Raymond Feng)

 * Fix the ref to getSchemaType (Raymond Feng)

 * Add support for nesting schema (Raymond Feng)

 * Add Object type (Raymond Feng)

 * Add support to use adapter constructor for initialization (Raymond Feng)

 * Change default create method from save to create for remoting (Ritchie Martori)

 * Add event emitter methods to models. (Ritchie Martori)

 * Add support for extending models (Ritchie Martori)

 * Revert adapter serialization. Remove geo point distance indicator. (Ritchie Martori)

 * Add properties to ModelClass during definition (Ritchie Martori)

 * Fix global leak and incorrect var (Ritchie)

 * Add alias to destroy/destroyAll (Raymond Feng)

 * Alias destroy/destroyAll (Raymond Feng)

 * Add in memory geo filtering. (Ritchie Martori)

 * Move geo filter creation into reusable module. (Ritchie Martori)

 * Rename long to lng (Ritchie Martori)

 * Add geo filtering for memory adapter (Ritchie Martori)

 * model.find => model.findById, model.all => model.find (Ritchie Martori)

 * Fix incorrect variable name in updateAttributes (Ritchie Martori)

 * Fix memory adapter updateAttributes issue. (Ritchie Martori)

 * Fix the schema building (Raymond Feng)

 * Normalize the schema definition (Raymond Feng)

 * Update the discover apis to take options (Raymond Feng)

 * Removed a stray log. (Michael Schoonmaker)

 * Move the _operations={} up (Raymond Feng)

 * Work around the JDB test coverage tool limitation. See https://github.com/1602/semicov (Raymond Feng)

 * Pass in the options (Raymond Feng)

 * Support string types when defining properties (Ritchie)

 * Rename discoverModels to discoverModelDefinitions (Ritchie)

 * Handle separate settings and adapter objects (Ritchie)

 * Remove console log (Ritchie)

 * Fix missing settings (Ritchie)

 * Fix missing connector alias (Ritchie)

 * Fixed memory adapter filtering + asteroid compatibility upddates (Ritchie Martori)

 * Update inflection (Raymond Feng)

 * Make sure options is present (Raymond Feng)

 * Fix remoteEnabled bug (Ritchie)

 * Revert "Asteroid 0.7 updates" (Ritchie Martori)

 * Asteroid 0.7 updates (Ritchie Martori)

 * Adjust the mixins (Raymond Feng)

 * Allow dao.find() and exists() to take any type for id (Ritchie Martori)

 * Fix the receiver (Raymond Feng)

 * Add discoverExportedForeignKeys (Raymond Feng)

 * Add sync versions of discovery (Raymond Feng)

 * Avoid duplicate connecting (Raymond Feng)

 * Improve connect/disconnect (Raymond Feng)

 * Add plural name to models (Ritchie)

 * Update buildModels and support associations via foreign keys (Raymond Feng)

 * Add support to discover related schemas by foreign keys (Raymond Feng)

 * Add more debugging info (Raymond Feng)

 * Enhance support for composite keys (Raymond Feng)

 * Update column type info (Raymond Feng)

 * Fix mixin (Raymond Feng)

 * Add options including default (Raymond Feng)

 * Add test cases for loading json doc (Raymond Feng)

 * Adding more tests (Raymond Feng)

 * Refactor more functions into mixins (Raymond Feng)

 * Update remoting signatures for dao. (Ritchie Martori)

 * Add pluralized name to model and remoting method signatures (Ritchie)

 * Add docs (Raymond Feng)

 * Rename adl to be ModelBuilder (Raymond Feng)

 * Add more methods to map column/property names (Raymond Feng)

 * Add data source attach example (Ritchie)

 * Add ability to attach data source to an existing model (Ritchie)

 * Fix the mapping (Raymond Feng)

 * Fix the column mapping (Raymond Feng)

 * Fix the id column name (Raymond Feng)

 * Start to add discoverSchema and name mapping (Raymond Feng)

 * Fix the capitalize (Raymond Feng)

 * Transform the names (Raymond Feng)

 * Add discoverSchema (Raymond Feng)

 * Fix the delegation for discover (Raymond Feng)

 * Fix the discover methods (Raymond Feng)

 * Bring up the schema loading from json docs (Raymond Feng)

 * Remove schema.js (Raymond Feng)

 * Fix the on-demand connection (Raymond Feng)

 * Fix the datasource.define (Raymond Feng)

 * Start to refactor ADL and DataSource (Raymond Feng)

 * 0.2.0-33 (Anatoliy Chakkaev)

 * Fail uniqueness check in case of db error (Anatoliy Chakkaev)

 * Refactor the CRUD operations to DataAccessObject (Raymond Feng)

 * Fix the discover keys (Raymond Feng)

 * Add discover primary/foreign keys (Raymond Feng)

 * Safer include (Anatoliy Chakkaev)

 * Fix Problem with DataType Text, closes #278 (Anatoliy Chakkaev)

 * 0.2.0-32 (Anatoliy Chakkaev)

 * Temp. disable test for validation (Anatoliy Chakkaev)

 * Add context info to validation error (Anatoliy Chakkaev)

 * Only save schema props (Anatoliy Chakkaev)

 * 0.2.0-31 (Anatoliy Chakkaev)

 * Fix tick (Anatoliy Chakkaev)

 * Safe connect call (Anatoliy Chakkaev)

 * Support define fk with class name (Anatoliy Chakkaev)

 * Fix find with NaN id in base-sql (Anatoliy Chakkaev)

 * Added skip/limit to memory adapter (Anatoliy Chakkaev)

 * Relations passed to belongsTo.add (Anatoliy Chakkaev)

 * Fix injection in ids (Anatoliy Chakkaev)

 * Adds test for limit and skip + limit on `all()` queries as in docs. (Currently not all adapters may pass.) (dgsan)

 * Accept related objects when creating instance #247 (Anatoliy Chakkaev)

 * Allow null properties for headless models (Anatoliy Chakkaev)

 * Check types of sync and async getters created by belongsTo, close #266 (Anatoliy Chakkaev)

 * Fix m2m: only add fk when hasMany have no "through" (Anatoliy Chakkaev)

 * Upd readme (Anatoliy Chakkaev)

 * Many-to-many relation (Anatoliy Chakkaev)

 * Some tests for scope (Anatoliy Chakkaev)

 * Organize model.js (Anatoliy Chakkaev)

 * 0.2.0-30 (Anatoliy Chakkaev)

 * Upd changelog (Anatoliy Chakkaev)

 * Datatypes casting (Anatoliy Chakkaev)

 * Add discover methods for model names and properties (Raymond Feng)

 * Only call the orginal method once (Raymond Feng)

 * Revert "Fix the test case so that it passes in the same filter" (Raymond Feng)

 * Set up the connected handler before connect (Raymond Feng)

 * The connecting flag should be set to false initially (Raymond Feng)

 * Fix the test case so that it passes in the same filter (Raymond Feng)

 * Update README.md (mhupman)

 * Do not assign enumerable schema to object #256 (Anatoliy Chakkaev)

 * Manually require init (Anatoliy Chakkaev)

 * Fix dates in memory adapter (Anatoliy Chakkaev)

 * Added datatypes tests (Anatoliy Chakkaev)

 * Fix merged schema test (Anatoliy Chakkaev)

 * Allow database.js to export function(compound) (Anatoliy Chakkaev)

 * ValidationError instead Error (Anatoliy Chakkaev)

 * Update README.md (Anatoliy Chakkaev)

 * 0.2.0-29 (Anatoliy Chakkaev)

 * Find on hasMany scope method (Anatoliy Chakkaev)

 * Added map-reduce and find methods to list (Anatoliy Chakkaev)

 * 0.2.0-28 (Anatoliy Chakkaev)

 * Return valid in case of sync validations (Anatoliy Chakkaev)

 * Test update (Anatoliy Chakkaev)

 * Fix validation issue (Anatoliy Chakkaev)

 * Transactions (Anatoliy Chakkaev)

 * Schemas switching (Anatoliy Chakkaev)

 * Automigrate before relation tests (Anatoliy Chakkaev)

 * Update makefile (Anatoliy Chakkaev)

 * Add more love to tests, pr #249 (Anatoliy Chakkaev)

 * 0.2.0-27 (Anatoliy Chakkaev)

 * Fix validations (Anatoliy Chakkaev)

 * Batch create (Anatoliy Chakkaev)

 * tests only: no afterCreate/afterUpdate on errors (Scott Nonnenberg)

 * afterDestroy not called on adapter error (Scott Nonnenberg)

 * 0.2.0-26 (Anatoliy Chakkaev)

 * Ignore npm-debug.log (Anatoliy Chakkaev)

 * Fix memory adapter: broken upd attrs (Anatoliy Chakkaev)

 * Return instance of object when create (Anatoliy Chakkaev)

 * Turn off ignoring tests (Anatoliy Chakkaev)

 * Upd tests (Anatoliy Chakkaev)

 * Validation amends (Anatoliy Chakkaev)

 * Test hooks and object lifecycle as per #242 (Anatoliy Chakkaev)

 * Tests for data manipulation (Anatoliy Chakkaev)

 * Rewrite save and create for correct hooks order (Anatoliy Chakkaev)

 * Rename validation hooks (Anatoliy Chakkaev)

 * Update hooks.md (Mansur S)

 * Upd node version for travis (Anatoliy Chakkaev)

 * Uncomment tests (Anatoliy Chakkaev)

 * Mongodb tolerance (Anatoliy Chakkaev)

 * Enable growl (Anatoliy Chakkaev)

 * 0.2.0-25 (Anatoliy Chakkaev)

 * Update attribute additional test (Anatoliy Chakkaev)

 * Fix memory adapter and test (Anatoliy Chakkaev)

 * Removed include test from common (Anatoliy Chakkaev)

 * Test destroy (Anatoliy Chakkaev)

 * Migration-friendly tests (Anatoliy Chakkaev)

 * Fixes in belongsTo relation definition syntax (Anatoliy Chakkaev)

 * Docs: hooks, footer fix (Anatoliy Chakkaev)

 * Include test (Anatoliy Chakkaev)

 * Update jugglingdb.md (Mansur S)

 * Query testing: findOne (Anatoliy Chakkaev)

 * Added test case for #238: password hashing before save (Anatoliy Chakkaev)

 * Added short syntax for belongsTo (Anatoliy Chakkaev)

 * Docs for hooks and model (Anatoliy Chakkaev)

 * Beautify things (Anatoliy Chakkaev)

 * Fix memory adapter to support lowercase desc order (Anatoliy Chakkaev)

 * Rewriting tests (Anatoliy Chakkaev)

 * Make tests importable (Anatoliy Chakkaev)

 * Docs amends (Anatoliy Chakkaev)

 * Another way to define belongsTo (Anatoliy Chakkaev)

 * 0.2.0-24 (Anatoliy Chakkaev)

 * Added man pages to package (Anatoliy Chakkaev)

 * Docs for models (Anatoliy Chakkaev)

 * Added footer (Anatoliy Chakkaev)

 * Upd readme and changelog (Anatoliy Chakkaev)

 * Fix test (Anatoliy Chakkaev)

 * Switch to mocha testing in travis (Anatoliy Chakkaev)

 * Rewrite validations in mocha (Anatoliy Chakkaev)

 * Rename files (Anatoliy Chakkaev)

 * Minor test amends (Anatoliy Chakkaev)

 * Remove old hooks tests (Anatoliy Chakkaev)

 * Upd memory adapter to work with undefined in dataset (Anatoliy Chakkaev)

 * Rename essentials (Anatoliy Chakkaev)

 * Rewrite hooks API (Anatoliy Chakkaev)

 * Started docs for model, changelog (Anatoliy Chakkaev)

 * Makefile for mocha testing (Anatoliy Chakkaev)

 * Defaults test and fixes (Anatoliy Chakkaev)

 * Added changelog (Anatoliy Chakkaev)

 * Added GA (Anatoliy Chakkaev)

 * Added docs (Anatoliy Chakkaev)

 * Added some initial docs (Anatoliy Chakkaev)

 * Makefile with man/html docs generation (Anatoliy Chakkaev)

 * Settings always set (Anatoliy Chakkaev)

 * Added json test (Anatoliy Chakkaev)

 * Added filter, fix [] as type (Anatoliy Chakkaev)

 * 0.2.0-23 (Anatoliy Chakkaev)

 * Upd gitignore (Anatoliy Chakkaev)

 * Initializer for compound 1.1.5-16 (Anatoliy Chakkaev)

 * http adapter: pre/postProcess, fix destroy and all (Scott Nonnenberg)

 * This is the smash with blunt object fix for #215, since the more flexible #213 was rejected. (dgsan)

 * 0.2.0-22 (Anatoliy Chakkaev)

 * FIxes in async validations (in sync case), closes 214 (Anatoliy Chakkaev)

 * 0.2.0-21 (Anatoliy Chakkaev)

 * Browserify-proof railway init (Anatoliy Chakkaev)

 * .version as getter (Anatoliy Chakkaev)

 * 0.2.0-20 (Anatoliy Chakkaev)

 * Add proper type registration (Anatoliy Chakkaev)

 * 0.2.0-19 (Anatoliy Chakkaev)

 * List support for non-object values (Anatoliy Chakkaev)

 * Coding style in helper (Anatoliy Chakkaev)

 * Fix package version exposing (Anatoliy Chakkaev)

 * Add some array methods for List (Anatoliy Chakkaev)

 * Absolute paths in README.md, fixes #208 (Anatoliy Chakkaev)

 * Eliminated global leak (Anatoliy Chakkaev)

 * Described custom validations (Anatoliy Chakkaev)

 * 0.2.0-18 (Anatoliy Chakkaev)

 * Remove logging (Anatoliy Chakkaev)

 * Organize test with Log and Dog (Anatoliy Chakkaev)

 * If property is array (List) need to convert it to JSON (Anatoliy Chakkaev)

 * FIxed test for belongsTo (Anatoliy Chakkaev)

 * Unit test for bug fix related to belongsTo relation. It declares a Schema, uses memory. If it should be run for ALL DBs it will need to be changed. (dgsan)

 * This fixes the apparent scope and comparison issues when calling a foreign key relation. (dgsan)

 * Fixing Railway Hoisting Issue (Dan Shultz)

 * Revert validatable fix (Anatoliy Chakkaev)

 * 0.2.0-17 (Anatoliy Chakkaev)

 * Add attr param to custom validator, closes #200 (Anatoliy Chakkaev)

 * Removed unused experimental stuff (Anatoliy Chakkaev)

 * 0.2.0-16 (Anatoliy Chakkaev)

 * Update broken test case (Anatoliy Chakkaev)

 * 0.2.0-15 (Anatoliy Chakkaev)

 * Make pathTo available in db/schema (Anatoliy Chakkaev)

 * 0.2.0-14 (Anatoliy Chakkaev)

 * Fix uniqueness validation (mongo ids) (Anatoliy Chakkaev)

 * Throw error when model is not configured for webservice (Anatoliy Chakkaev)

 * Update test for #128 (Anatoliy Chakkaev)

 * Return null when findOne could not find record, closes #128 (Anatoliy Chakkaev)

 * 0.2.0-13 (Anatoliy Chakkaev)

 * Work with cs-compound (Anatoliy Chakkaev)

 * One more fix in updateAttribute test with uniqueness validation (1602)

 * Update validations test (Anatoliy Chakkaev)

 * Implement schema.extendModel, closes #157 (Anatoliy Chakkaev)

 * Add adapter (memory-bogus) test (Anatoliy Chakkaev)

 * Make memory adapter async (Anatoliy Chakkaev)

 * Implement findOrCreate, requested in #190 (Anatoliy Chakkaev)

 * Added test for #191 (Anatoliy Chakkaev)

 * Revert hasMany change (Anatoliy Chakkaev)

 * Update readme: clienside, describe built-in adapters (Anatoliy Chakkaev)

 * 0.2.0-12 (Anatoliy Chakkaev)

 * Added schema::model::set for railway (Anatoliy Chakkaev)

 * 0.2.0-11 (Anatoliy Chakkaev)

 * Added http (WebService) adapter (Anatoliy Chakkaev)

 * 0.2.0-10 (Anatoliy Chakkaev)

 * Accept adapter as first argument of Schema constructor (Anatoliy Chakkaev)

 * fix lost callback (Erin Noe-Payne)

 * attempted to write a test for hasmany all function.  this commit has it commented out (Robb Lovell)

 * added 'all' method to hasMany in abstract-class.js to correctly support a 'many' collection. added .idea to .gitignore to ignore WebStorm projects. (Robb Lovell)

 * Updated readme (Anatoliy Chakkaev)

 * fix typo :) (Asp3ctus)

 * app.enable('autoupdate') option support (Asp3ctus)

 * Travis env update, compare ids as strings (Anatoliy Chakkaev)

 * 0.2.0-9 (Anatoliy Chakkaev)

 * Fix for reading yml files (Anatoliy Chakkaev)

 * 0.2.0-8 (Anatoliy Chakkaev)

 * Only update id if it does not present in resulting dataset (Anatoliy Chakkaev)

 * 0.2.0-7 (Anatoliy Chakkaev)

 * Strict adapter checking (Anatoliy Chakkaev)

 * Do not throw on missing adapter, just display warning (Anatoliy Chakkaev)

 * updateAttributes data defaults to {} (Sascha Gehlich)

 * 0.2.0-4 (Anatoliy Chakkaev)

 * merge (Anatoliy Chakkaev)

 * 0.2.0-3 (Anatoliy Chakkaev)

 * Update railwayjs name, add ability to skip tests (Anatoliy Chakkaev)

 * allow database.js config (Sascha Gehlich)

 * remove unused (nano specific) files (Nicholas Westlake)

 * added filter on schema though I am not sure it will be used (Sébastien Drouyer)

 * added some documentation for include and all function (Sébastien Drouyer)

 * cleaned some old comments (Sébastien Drouyer)

 * Small copy-paste error :) (Sébastien Drouyer)

 * merged + removed preprocessdata callback as it seems it isn't usefull (Sébastien Drouyer)

 * removed unused console log and comments (Sébastien Drouyer)

 * small fix on relations (Sébastien Drouyer)

 * added tests for the include functionnality (Sébastien Drouyer)

 * added include functionnality to abstract class and mysql (Sébastien Drouyer)

 * add additional types stored in Schema.types to schema context (Sascha Gehlich)

 * let the adapter decide when to load the schema (Sascha Gehlich)

 * fixed railway integration (Sascha Gehlich)

 * Update readme (Anatoliy Chakkaev)

 * Added mysql icon (Anatoliy Chakkaev)

 * Added some adapters descriptions (Anatoliy Chakkaev)

 * Added coffee-script as dev dependency (Anatoliy Chakkaev)

 * Arrange contributors, remove coffee-script (Anatoliy Chakkaev)

 * Fix broken yml config, closes #159 (Anatoliy Chakkaev)

 * 0.2.0-2 (Anatoliy Chakkaev)

 * Allow extend tests (Anatoliy Chakkaev)

 * Package.json updated (Anatoliy Chakkaev)

 * added relations key (Sébastien Drouyer)

 * Remove sql adapters and tests (Anatoliy Chakkaev)

 * 0.2.0-1 (Anatoliy Chakkaev)

 * Remove sqlite3 adapter (Anatoliy Chakkaev)

 * Removed nosql adapters (moved to own repos) (Anatoliy Chakkaev)

 * allow socketPath for mysql config (Tim Griesser)

 * Fix cradle+railwayjs (Anatoliy Chakkaev)

 * added nano settings for travis-ci (Nicholas Westlake)

 * added nano adapter (Nicholas Westlake)

 * Fixed bug for CoffeeScript and MongoDB (Sebastian del Valle)

 * Log Redis connection errors instead of crashing (Dominik Krejcik)

 * Docs and style in lib/list (Anatoliy Chakkaev)

 * 0.1.27-3 (Anatoliy Chakkaev)

 * Namespace adapters (Anatoliy Chakkaev)

 * when using cradle if we don't wait for the schema to be connected, the models fails to load correctly. (Muneeb Samuels)

 * 0.1.27-2 (Anatoliy Chakkaev)

 * Better docs, no warning (Anatoliy Chakkaev)

 * update mongodb adapter (Nathan Cartwright)

 * Cast id to string before creation, fix #145 (Anatoliy Chakkaev)

 * remove commentouted source (taiyoh)

 * fixed type check strictly (taiyoh)

 * 0.1.27-1 (Anatoliy Chakkaev)

 * Fix id:null issue #98 (Anatoliy Chakkaev)

 * - fixed typo in updateOrCreate method. (Muneeb Samuels)

 * - added views to do .all queries, it speeds up the query. (Muneeb Samuels)

 * - fixed typo in updateOrCreate method. - added views to do .all queries, it speeds up the query. (Muneeb Samuels)

 * limited tests to the one I know (Sébastien Drouyer)

 * trying a fix for redis (Sébastien Drouyer)

 * fixed regression for postgres (Sébastien Drouyer)

 * fixed tests for mongodb (Sébastien Drouyer)

 * fixed issue for sqlite (Sébastien Drouyer)

 * added log to data (TEMPORARY) to debug on travis (Sébastien Drouyer)

 * fixed indentation + adapted to markdown syntax (Sébastien Drouyer)

 * corrected indentation issues (Sébastien Drouyer)

 * small sentence fixes + added usage examples in belongsTo comments (Sébastien Drouyer)

 * add test cases for caching in hasMany and fixed test cases for caching in belongsTo (Sébastien Drouyer)

 * fixed and enhanced caching in getters and setters in abstract-class (Sébastien Drouyer)

 * added test case for the cache of belongsTo (Sébastien Drouyer)

 * cradle adapter update (Muneeb Samuels)

 * using views speeds up the query by only fetching the documents for the model being queried. (Muneeb Samuels)

 * Globally published models for railway 1.0 (Anatoliy Chakkaev)

 * added caching functionnality (Sébastien Drouyer)

 * Models publishing for both railway stable and unstable (Anatoliy Chakkaev)

 * Fix railway 1.0 support (Anatoliy Chakkaev)

 * Fix instanceof checking (Anatoliy Chakkaev)

 * Remove globals, read yaml (Anatoliy Chakkaev)

 * added test cases for IN and NOT IN. Only in mysql and postgres for the moment (Sébastien Drouyer)

 * generalize escape on IN and NOT IN values (Sébastien Drouyer)

 * Fixed postgres adapter for IN and NIN when values are strings and where there is 0 value (Sébastien Drouyer)

 * Fixed IN and NOT IN when searching on strings (Sébastien Drouyer)

 * Fixed bug for IN on NOT IN - corrected (Sébastien Drouyer)

 * Fix inheritance (Anatoliy Chakkaev)

 * Fix broken mysql adapter after merging pull request (Anatoliy Chakkaev)

 * Ignored v8.log (Anatoliy Chakkaev)

 * Remove unused cached relations, closes #134 (Anatoliy Chakkaev)

 * Fixed bug (oversight ?) on alter table (Sébastien Drouyer)

 * Update lib/adapters/cradle.js (Muneeb Samuels)

 * limit + skip (Muneeb Samuels)

 * Fix typo, start new release preview (Anatoliy Chakkaev)

 * Print properly formatted object (Anatoliy Chakkaev)


2012-10-16, Version 0.1.23
==========================

 * Remove lazy collections, remove unused caching stuff, unsupport node 0.4 (travis) (Anatoliy Chakkaev)

 * Further optimizations: remove hasOwnProperty backward compat (Anatoliy Chakkaev)

 * Switch test coverage reporting off for travis (Anatoliy Chakkaev)

 * Proper collection caching (Anatoliy Chakkaev)


2012-10-13, Version 0.1.21
==========================

 * Specify collection length (Anatoliy Chakkaev)

 * Optimize collection (Anatoliy Chakkaev)

 * Better performance on big datasets read (Anatoliy Chakkaev)

 * Fix for redis adapter when finding records filtered with multiple attributes (Mikko Lehtinen)

 * Better safeRequire (Anatoliy Chakkaev)

 * Fix memory adapter tests (Anatoliy Chakkaev)

 * Update lib/adapters/postgres.js (clarktlaugh)

 * Added cradle adapter (Anatoliy Chakkaev)

 * Configure travis services (Anatoliy Chakkaev)

 * Update mysql to 2.0 (Anatoliy Chakkaev)

 * Fix redis2 indexes cleanup (Anatoliy Chakkaev)

 * Not strict equal when matching ids in embedded lists (Anatoliy Chakkaev)

 * Mongoose Adapter Single Index support-Spacing Fix (Nashad Alam)

 * Mongoose Adapter Single Index support (Nashad Alam)

 * Allow for IN, NOT IN, and != queries in postgres (Matt Huggins)

 * Prevent redis pussy riot (Anatoliy Chakkaev)

 * Fix standard_conforming_strings for postgres (Anatoliy Chakkaev)

 * Update lib/adapters/memory.js (Mikxail)

 * Make property configurable to pass tests (Anatoliy Chakkaev)

 * List API improvements (Anatoliy Chakkaev)

 * List improvements (Anatoliy Chakkaev)

 * Fix postgres (Anatoliy Chakkaev)

 * Added typed lists support (Anatoliy Chakkaev)

 * fix global leak in postgres adapter (Sam Taylor)

 * Revert sort-only indexes (Anatoliy Chakkaev)

 * Redis sort-only indexes (Anatoliy Chakkaev)

 * Fix in-memory adapter tests (Anatoliy Chakkaev)

 * Fix typo, tune redis2 (Anatoliy Chakkaev)

 * Rewritten redis (Anatoliy Chakkaev)

 * Refactored and optimized redis adapter (Anatoliy Chakkaev)

 * Fix postgres offset feature (Anatoliy Chakkaev)

 * Bump 0.1.14. Fix typo in redis adapter (Anatoliy Chakkaev)

 * Callback called only once + database selection (Anatoliy Chakkaev)

 * Changed validatable inheritance, fixed issue with belongsTo #113 (Anatoliy Chakkaev)

 * More information about alter in isActual (Anatoliy Chakkaev)

 * Fix autoupdate for mysql ; (Anatoliy Chakkaev)

 * Autoupdate multicolumn indexes (Anatoliy Chakkaev)

 * I put the delete in the wrong line, moved down.. (Mike P)

 * re-adding fix to not save id as a property on update (Mike P)

 * Update lib/adapters/neo4j.js (Mike P)

 * Update lib/abstract-class.js (Mike P)

 * Single-column indexes in mysql (autoupdate) (Anatoliy Chakkaev)

 * Unnecessary error on mongodb authentication. Skip checking (Anatoliy Chakkaev)

 * Fix typo, bump version (Anatoliy Chakkaev)

 * Provide additional info about collection (Anatoliy Chakkaev)

 * Freeze postgres version (Anatoliy Chakkaev)

 * Move to latest mongoose / fix api (Anatoliy Chakkaev)

 * Remove JSON serialization test case (Anatoliy Chakkaev)

 * Adds replica-set support to the mongodb native driver. (Timothy Marks)

 * Adds authenticate to db.open if a username and password are set. (Timothy Marks)

 * Update postgres (Anatoliy Chakkaev)

 * JSON in tests, Schema.JSON published (Anatoliy Chakkaev)

 * Adds Replica Set Support to JugglingDB Mongoose Adapter (Timothy Marks)

 * Fixes issue where only id would be saved when updating an existing object for mongodb driver. (Timothy Marks)

 * Added stricter value checking on number. (Dombi Attila)

 * modified destroyAll (Taner Topal)

 * Added fix to the abstract-class.js file for issue #72.  The fix is resolved by by5739. (Jude Lam)

 * Allow relative driver paths, adopt for node 0.8 (Anatoliy Chakkaev)

 * The updateAttribute callback doesn't behaves as its described. It should send the object instance alongside the error too. (Dombi Attila)

 * Wrap database name with quotes (Anatoliy Chakkaev)

 * fix sql error when initializing models with empty Number property. It should return NULL when a number is empty (Dombi Attila)

 * Fix PostgreSQL query offset (Matt Huggins)

 * First version of a cradle adapter (Aurélien Thieriot)

 * https://groups.google.com/d/msg/railwayjs/4YWICL6EAOg/ebCxGkQ5eQcJ (Wizek)

 * Fix coding style (Anatoliy Chakkaev)

 * Adopt postgres stuff (Anatoliy Chakkaev)

 * Coverage added to gitignore (Anatoliy Chakkaev)

 * added custom collection name to mongoose (Jonathan Spies)

 * heavily modified sections of postgres adapter, postgres is now passing all tests (Joseph Junker)

 * ran into some confusion with default values while changing postgres adapter, added postgres default values test (Joseph Junker)

 * migration_test is mysql specific, added postgres migration test (Joseph Junker)

 * added multiple sort for mongoose (Jonathan Spies)

 * Fixes mysql adapter 'neq' condition. (Rob Scott)

 * added double quotes to field names (bitmage)

 * Support modular railway (Anatoliy Chakkaev)

 * Upsert with setters (Anatoliy Chakkaev)

 * Added semicov dependency (Anatoliy Chakkaev)

 * Fix sql adapters (Anatoliy Chakkaev)

 * Setters enabled in new and create (Anatoliy Chakkaev)

 * Jslinize if blocks, not strict equal for ids on uniqueness checking (Anatoliy Chakkaev)

 * Prevent data from leaking to global (Henri Bergius)

 * Fix mongoose adapter find (Anatoliy Chakkaev)

 * Tune propertyChanged behavior (Anatoliy Chakkaev)

 * Fix 'undefined is not a function' problem at postgres adapter (Kelvin Wong)

 * Fix test: not strict equal when comparing ids (Anatoliy Chakkaev)

 * Update version (Anatoliy Chakkaev)

 * Turn off caching (Anatoliy Chakkaev)

 * Some safeties to URL handling (Henri Bergius)

 * Enable setting up Redis with URL (Henri Bergius)

 * Add warning for validations in schema.js (Anatoliy Chakkaev)

 * Not strict equal for scoped find, trigger beforeUpdate with data (Anatoliy Chakkaev)

 * Fix scoped find method (Anatoliy Chakkaev)

 * Postgres migrations fix #54 (Anatoliy Chakkaev)

 * Documentation, railway tweaks (Anatoliy Chakkaev)

 * Document (Anatoliy Chakkaev)

 * Fix multiple queries issue #51 (Anatoliy Chakkaev)

 * Delayed database calls (Anatoliy Chakkaev)

 * upsert for redis (Anatoliy Chakkaev)

 * Support upsert (Anatoliy Chakkaev)

 * Implemented destroyAll for sub-scopes (Taner Topal)

 * Tune sqlite3 dependency version (2.0.18) (Anatoliy Chakkaev)

 * Added contributors, MRU cache cleanup, closes #46 (Anatoliy Chakkaev)

 * Pass DEFAULT to autoincrement values in PG (Felipe Sateler)

 * Bump version 0.1.3 (Anatoliy Chakkaev)

 * Correctly handle callback after blank automigration (Anatoliy Chakkaev)

 * Support node 0.4 in mongodb adapter (Anatoliy Chakkaev)

 * Mongodb adapter (Anatoliy Chakkaev)

 * Fix executable for neo4j travis (Anatoliy Chakkaev)

 * Added neo4j support for travis ci (Anatoliy Chakkaev)

 * Remove sequelize tests (Anatoliy Chakkaev)

 * Removed sequelize adapter (Anatoliy Chakkaev)

 * Remove frozen neo4j lib, add neo4j database setup for travis-ci (Anatoliy Chakkaev)

 * Custom table name for sqlite3 (Anatoliy Chakkaev)

 * Added sql for common parts (Anatoliy Chakkaev)

 * DRY sql adapters (Anatoliy Chakkaev)

 * Unhashish, escape names, start moving common parts to sql.js (Anatoliy Chakkaev)

 * Allow custom table name in postgres too (Felipe Sateler)

 * Allow custom table name in mysql (Anatoliy Chakkaev)

 * Don't add a WHERE if there are no constraints (Henri Bergius)

 * Support reverse sort for redis (Anatoliy Chakkaev)

 * Model.findOne, mongoose reverse sort, closes #38 (Anatoliy Chakkaev)

 * Fix unnecessary _was attributes issue, closes #36, #31, #34, #35 (Anatoliy Chakkaev)

 * Reverse sort order in redis and memory, test (Anatoliy Chakkaev)


2012-03-01, Version 0.1.1
=========================

 * Bump version 0.1.1 (Anatoliy Chakkaev)

 * Test belongsTo (Anatoliy Chakkaev)

 * MySQL shouldn't break on null Date values (Henri Bergius)

 * Safety: there might not be any indexes to use (Henri Bergius)

 * Update README.md (1602)

 * Default should not be handled by database engine (Anatoliy Chakkaev)

 * Add schema.isActual and automigrate on sqlite start (Anatoliy Chakkaev)

 * Fix sorting by id in redis (Mansur)

 * changed belongsTo so grabs the belongs to relationship properly (Rick O'Toole)

 * Fixing some bugs, which fix default values and length of fields in mysql adapter (Amir M. Mahmoudi)

 * Remove unnecesare code from test helper (Anatoliy Chakkaev)

 * modify README.md (Shunsuke Watanabe)

 * Add alias for skip/offet (mongoose) (Anatoliy Chakkaev)

 * Add some features to advanced queries (Amir M. Mahmoudi)

 * Disable advanced queries for redis and memory (Anatoliy Chakkaev)

 * Advanced queries for sql-s and mongodb (Anatoliy Chakkaev)

 * Emit logging event (Anatoliy Chakkaev)

 * Disable neo4j for travis (Anatoliy Chakkaev)

 * Added utils module (Anatoliy Chakkaev)

 * Mongoose order/limit/offset and more (Anatoliy Chakkaev)

 * Fix sqlite3 verion in dependency (Anatoliy Chakkaev)

 * SQLite3 adapter (Anatoliy Chakkaev)

 * Fix postgres adapter (Anatoliy Chakkaev)

 * Added hashish dependency (Anatoliy Chakkaev)

 * Setup postgres for travis (Anatoliy Chakkaev)

 * Added pg dependency (Anatoliy Chakkaev)

 * Model.count with params support, fix time in mysql (Anatoliy Chakkaev)

 * Allow to call create without callback (Anatoliy Chakkaev)

 * Get version (Anatoliy Chakkaev)

 * Remove unnecessary logging (Anatoliy Chakkaev)

 * Update version reading (Anatoliy Chakkaev)

 * Remove node07 (Anatoliy Chakkaev)

 * Adjust test (Anatoliy Chakkaev)

 * Mysql sort, where and limit (Anatoliy Chakkaev)

 * Update test comand (Anatoliy Chakkaev)

 * Rewrite redis test to make possible filter and sort simultaneously (Anatoliy Chakkaev)

 * Implement first-round sorting in memory adapter (Anatoliy Chakkaev)

 * Redis-adapter: test sorting, support alpha-sort, fix destroyAll issue (Anatoliy Chakkaev)

 * Update readme (Anatoliy Chakkaev)

 * Return name of type (Anatoliy Chakkaev)

 * Update package (Anatoliy Chakkaev)

 * Added nodeunit dep (Anatoliy Chakkaev)

 * Travis (Anatoliy Chakkaev)

 * Safe require package.json (Anatoliy Chakkaev)

 * Do not store null values (Anatoliy Chakkaev)

 * Postgresql adapter (buggy) (Anatoliy Chakkaev)

 * Describe consturctor calling without "new" (Anatoliy Chakkaev)

 * Allow constructor to be called without "new" (Anatoliy Chakkaev)

 * limit/offset and order clause for redis adapter (Julien Guimont)

 * Describe test case (Anatoliy Chakkaev)

 * Fix non-schema data saving (Anatoliy Chakkaev)

 * Allow override sette and getters (Anatoliy Chakkaev)

 * Remove non-schema properties on reload (Anatoliy Chakkaev)

 * Drop and add columns (Anatoliy Chakkaev)

 * Automigrade/update (Anatoliy Chakkaev)

 * Reset changes method (Anatoliy Chakkaev)

 * Fix test for updateAttribute (Anatoliy Chakkaev)

 * Validation should return undefined in case of async validations (Anatoliy Chakkaev)

 * Some errors in the previous PR (Julien Guimont)

 * Async validations should not trump previous validations. Previous validations should be true as well as async validations (Julien Guimont)

 * Keep dirty state for cached objects (Anatoliy Chakkaev)

 * Fixed/Improved mysql escaping in the fields names (redvulps)

 * Use events module (Anatoliy Chakkaev)

 * Make all args in .save optional (Anatoliy Chakkaev)

 * Update attribute + hooks (Anatoliy Chakkaev)

 * Tune async validation hooks (Anatoliy Chakkaev)

 * Describe object livecycle, update isValid usage (1602)

 * Async flow for hooks (Anatoliy Chakkaev)

 * updated mysql adapter to support boolean definition (redvulps)

 * Updated mysql adapter to support fields that have internal names like "key" or "order" (redvulps)

 * Async validations hooks (Anatoliy Chakkaev)

 * Async validations (Anatoliy Chakkaev)

 * Rewrite custom validation (Anatoliy Chakkaev)

 * Pass instance as callback second arg when validation fails (Anatoliy Chakkaev)

 * Hookable validations without breaking functionality (Anatoliy Chakkaev)

 * Some coding style fixes (Anatoliy Chakkaev)

 * Added active record style callbacks and hooks. Before and after create, save, update, destroy and after initialization. (Julien Guimont)

 * Add the ability to create custom validation on fields (Julien Guimont)

 * Save where conds (Anatoliy Chakkaev)

 * Bump 0.0.6 (Anatoliy Chakkaev)

 * Run schema callback on nextTick (Anatoliy Chakkaev)

 * Fix NaN-NaN... in dates (Anatoliy Chakkaev)

 * Logging in mysql and redis (Anatoliy Chakkaev)

 * bugfix: class is a reserved word in V8 / node 0.6 (Justinas Stankevičius)

 * phony test (Anatoliy Chakkaev)

 * Added Makefile (Anatoliy Chakkaev)


2011-11-05, Version 0.0.4
=========================

 * Version 0.0.4 (Anatoliy Chakkaev)

 * Accept non-url format in mongoose adapter (Anatoliy Chakkaev)

 * Run callbacks on schema ready (Anatoliy Chakkaev)

 * Move conditions to `where` section, fix neo4j (Anatoliy Chakkaev)

 * Neo4j cypher query support (Anatoliy Chakkaev)

 * Mysql (Anatoliy Chakkaev)

 * Ability to transparently close connection with database (Anatoliy Chakkaev)

 * Tune indexes in redis (Anatoliy Chakkaev)

 * Only save to database attributes that listed in schema (Anatoliy Chakkaev)

 * Update neo4j: safe callbacks, update indexes on save (Anatoliy Chakkaev)

 * Bump version (Anatoliy Chakkaev)


2011-10-16, Version 0.0.2
=========================

 * First release!
