// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const ValidationError = require('../').ValidationError;

const async = require('async');
const contextTestHelpers = require('./helpers/context-test-helpers');
const ContextRecorder = contextTestHelpers.ContextRecorder;
const deepCloneToObject = contextTestHelpers.deepCloneToObject;
const aCtxForModel = contextTestHelpers.aCtxForModel;
const GeoPoint = require('../lib/geo.js').GeoPoint;

const uid = require('./helpers/uid-generator');
const getLastGeneratedUid = uid.last;

const HookMonitor = require('./helpers/hook-monitor');
let isNewInstanceFlag;

module.exports = function(dataSource, should, connectorCapabilities) {
  isNewInstanceFlag = connectorCapabilities.replaceOrCreateReportsNewInstance;
  if (!connectorCapabilities) connectorCapabilities = {};
  if (isNewInstanceFlag === undefined) {
    const warn = 'The connector does not support a recently added feature:' +
      ' replaceOrCreateReportsNewInstance';
    console.warn(warn);
  }
  describe('Persistence hooks', function() {
    let ctxRecorder, hookMonitor, expectedError;
    let TestModel, existingInstance, GeoModel;
    let migrated = false;

    let undefinedValue = undefined;

    beforeEach(function setupDatabase(done) {
      ctxRecorder = new ContextRecorder('hook not called');
      hookMonitor = new HookMonitor({includeModelName: false});
      expectedError = new Error('test error');

      TestModel = dataSource.createModel('TestModel', {
        // Set id.generated to false to honor client side values
        id: {type: String, id: true, generated: false, default: uid.next},
        name: {type: String, required: true},
        extra: {type: String, required: false},
      });

      GeoModel = dataSource.createModel('GeoModel', {
        id: {type: String, id: true, default: uid.next},
        name: {type: String, required: false},
        location: {type: GeoPoint, required: false},
      });

      uid.reset();

      if (migrated) {
        async.series([
          function(cb) {
            TestModel.deleteAll(cb);
          },
          function(cb) {
            GeoModel.deleteAll(cb);
          },
        ], done);
      } else {
        dataSource.automigrate([TestModel.modelName, 'GeoModel'], function(err) {
          migrated = true;
          done(err);
        });
      }
    });

    beforeEach(function createTestData(done) {
      TestModel.create({name: 'first'}, function(err, instance) {
        if (err) return done(err);

        // Look it up from DB so that default values are retrieved
        TestModel.findById(instance.id, function(err, instance) {
          existingInstance = instance;
          undefinedValue = existingInstance.extra;

          TestModel.create({name: 'second'}, function(err) {
            if (err) return done(err);
            const location1 = new GeoPoint({lat: 10.2, lng: 6.7});
            const location2 = new GeoPoint({lat: 10.3, lng: 6.8});
            GeoModel.create([
              {name: 'Rome', location: location1},
              {name: 'Tokyo', location: location2},
            ], function(err) {
              done(err);
            });
          });
        });
      });
    });

    describe('PersistedModel.find', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        TestModel.find(
          {where: {id: '1'}},
          function(err, list) {
            if (err) return done(err);

            hookMonitor.names.should.eql([
              'access',
              'loaded',
            ]);
            done();
          },
        );
      });

      it('triggers the loaded hook multiple times when multiple instances exist', function(done) {
        monitorHookExecution();

        TestModel.find(function(err, list) {
          if (err) return done(err);

          hookMonitor.names.should.eql([
            'access',
            'loaded',
            'loaded',
          ]);
          done();
        });
      });

      it('should not trigger hooks, if notify is false', function(done) {
        monitorHookExecution();
        TestModel.find(
          {where: {id: '1'}},
          {notify: false},
          function(err, list) {
            if (err) return done(err);
            hookMonitor.names.should.be.empty();
            done();
          },
        );
      });

      it('triggers the loaded hook multiple times when multiple instances exist when near filter is used',
        function(done) {
          const hookMonitorGeoModel = new HookMonitor({includeModelName: false});

          function monitorHookExecutionGeoModel(hookNames) {
            hookMonitorGeoModel.install(GeoModel, hookNames);
          }

          monitorHookExecutionGeoModel();

          const query = {
            where: {location: {near: '10,5'}},
          };
          GeoModel.find(query, function(err, list) {
            if (err) return done(err);

            hookMonitorGeoModel.names.should.eql(['access', 'loaded', 'loaded']);
            done();
          });
        });

      it('applies updates from `loaded` hook when near filter is used', function(done) {
        GeoModel.observe('loaded', function(ctx, next) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {name: 'Berlin'});
          next();
        });

        const query = {
          where: {location: {near: '10,5'}},
        };

        GeoModel.find(query, function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql(['Berlin', 'Berlin']);
          done();
        });
      });

      it('applies updates to one specific instance from `loaded` hook when near filter is used',
        function(done) {
          GeoModel.observe('loaded', function(ctx, next) {
            if (ctx.data.name === 'Rome') {
              // It's crucial to change `ctx.data` reference, not only data props
              ctx.data = Object.assign({}, ctx.data, {name: 'Berlin'});
            }
            next();
          });

          const query = {
            where: {location: {near: '10,5'}},
          };

          GeoModel.find(query, function(err, list) {
            if (err) return done(err);
            list.map(get('name')).should.containEql('Berlin', 'Tokyo');
            done();
          });
        });

      it('applies updates from `loaded` hook when near filter is not used', function(done) {
        TestModel.observe('loaded', function(ctx, next) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {name: 'Paris'});
          next();
        });

        TestModel.find(function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql(['Paris', 'Paris']);
          done();
        });
      });

      it('applies updates to one specific instance from `loaded` hook when near filter is not used',
        function(done) {
          TestModel.observe('loaded', function(ctx, next) {
            if (ctx.data.name === 'first') {
              // It's crucial to change `ctx.data` reference, not only data props
              ctx.data = Object.assign({}, ctx.data, {name: 'Paris'});
            }
            next();
          });

          TestModel.find(function(err, list) {
            if (err) return done(err);
            list.map(get('name')).should.eql(['Paris', 'second']);
            done();
          });
        });

      it('should not trigger hooks for geo queries, if notify is false',
        function(done) {
          monitorHookExecution();

          TestModel.find(
            {where: {geo: {near: '10,20'}}},
            {notify: false},
            function(err, list) {
              if (err) return done(err);
              hookMonitor.names.should.be.empty();
              done();
            },
          );
        });

      it('should apply updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {name: 'second'}};
          next();
        });

        TestModel.find({name: 'first'}, function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql(['second']);
          done();
        });
      });

      it('triggers `access` hook', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.find({where: {id: '1'}}, function(err, list) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            query: {where: {id: '1'}},
          }));
          done();
        });
      });

      it('aborts when `access` hook fails', function(done) {
        TestModel.observe('access', nextWithError(expectedError));

        TestModel.find(function(err, list) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: existingInstance.id}};
          next();
        });

        TestModel.find(function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql([existingInstance.name]);
          done();
        });
      });

      it('triggers `access` hook for geo queries', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.find({where: {geo: {near: '10,20'}}}, function(err, list) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            query: {where: {geo: {near: '10,20'}}},
          }));
          done();
        });
      });

      it('applies updates from `access` hook for geo queries', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: existingInstance.id}};
          next();
        });

        TestModel.find({where: {geo: {near: '10,20'}}}, function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql([existingInstance.name]);
          done();
        });
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        TestModel.find(
          {where: {id: 1}},
          function(err, list) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {
                id: '1',
                name: 'first',
                extra: 'hook data',
              },
              isNewInstance: false,
              options: {},
            }));

            list[0].should.have.property('extra', 'hook data');
            done();
          },
        );
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.find(
          {where: {id: 1}},
          function(err, list) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });
    });

    describe('PersistedModel.create', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        TestModel.create(
          {name: 'created'},
          function(err, record, created) {
            if (err) return done(err);

            hookMonitor.names.should.eql([
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            done();
          },
        );
      });

      it('aborts when `after save` fires when option to notify is false', function(done) {
        monitorHookExecution();

        TestModel.create({name: 'created'}, {notify: false}, function(err, record, created) {
          if (err) return done(err);

          hookMonitor.names.should.not.containEql('after save');
          done();
        });
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.create({name: 'created'}, function(err, instance) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            instance: {
              id: instance.id,
              name: 'created',
              extra: undefined,
            },
            isNewInstance: true,
          }));
          done();
        });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        TestModel.create({name: 'created'}, function(err, instance) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `before save` hook', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        TestModel.create({id: uid.next(), name: 'a-name'}, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('sends `before save` for each model in an array', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.create(
          [{name: '1'}, {name: '2'}],
          function(err, list) {
            if (err) return done(err);
            // Creation of multiple instances is executed in parallel
            ctxRecorder.records.sort(function(c1, c2) {
              return c1.instance.name - c2.instance.name;
            });
            ctxRecorder.records.should.eql([
              aCtxForModel(TestModel, {
                instance: {id: list[0].id, name: '1', extra: undefined},
                isNewInstance: true,
              }),
              aCtxForModel(TestModel, {
                instance: {id: list[1].id, name: '2', extra: undefined},
                isNewInstance: true,
              }),
            ]);
            done();
          },
        );
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.create({name: 'created'}, function(err) {
          (err || {}).should.be.instanceOf(ValidationError);
          (err.details.codes || {}).should.eql({name: ['presence']});
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.create(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {id: 'new-id', name: 'a name'},
              isNewInstance: true,
              currentInstance: {extra: null, id: 'new-id', name: 'a name'},
            }));

            done();
          },
        );
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            instance.should.have.property('extra', 'hook data');

            // Also query the database here to verify that, on `create`
            // updates from `persist` hook are reflected into database
            TestModel.findById('new-id', function(err, dbInstance) {
              if (err) return done(err);
              should.exists(dbInstance);
              dbInstance.toObject(true).should.eql({
                id: 'new-id',
                name: 'a name',
                extra: 'hook data',
              });
              done();
            });
          },
        );
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {id: 'new-id', name: 'a name'},
              isNewInstance: true,
            }));

            done();
          },
        );
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.create(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            instance.should.have.property('extra', 'hook data');
            done();
          },
        );
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.create({name: 'created'}, function(err, instance) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            instance: {
              id: instance.id,
              name: 'created',
              extra: undefined,
            },
            isNewInstance: true,
          }));
          done();
        });
      });

      it('aborts when `after save` hook fails', function(done) {
        TestModel.observe('after save', nextWithError(expectedError));

        TestModel.create({name: 'created'}, function(err, instance) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `after save` hook', function(done) {
        TestModel.observe('after save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        TestModel.create({name: 'a-name'}, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('sends `after save` for each model in an array', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.create(
          [{name: '1'}, {name: '2'}],
          function(err, list) {
            if (err) return done(err);
            // Creation of multiple instances is executed in parallel
            ctxRecorder.records.sort(function(c1, c2) {
              return c1.instance.name - c2.instance.name;
            });
            ctxRecorder.records.should.eql([
              aCtxForModel(TestModel, {
                instance: {id: list[0].id, name: '1', extra: undefined},
                isNewInstance: true,
              }),
              aCtxForModel(TestModel, {
                instance: {id: list[1].id, name: '2', extra: undefined},
                isNewInstance: true,
              }),
            ]);
            done();
          },
        );
      });

      it('emits `after save` when some models were not saved', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          if (ctx.instance.name === 'fail')
            next(expectedError);
          else
            next();
        });

        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.create(
          [{name: 'ok'}, {name: 'fail'}],
          function(err, list) {
            (err || []).should.have.length(2);
            err[1].should.eql(expectedError);

            // NOTE(bajtos) The current implementation of `Model.create(array)`
            // passes all models in the second callback argument, including
            // the models that were not created due to an error.
            list.map(get('name')).should.eql(['ok', 'fail']);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {id: list[0].id, name: 'ok', extra: undefined},
              isNewInstance: true,
            }));
            done();
          },
        );
      });
    });

    describe('PersistedModel.createAll', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        TestModel.createAll(
          [{name: '1'}, {name: '2'}],
          function(err) {
            if (err) return done(err);

            hookMonitor.names.should.eql([
              'before save',
              'before save',
              'persist',
              'loaded',
              'after save',
              'after save',
            ]);
            done();
          },
        );
      });

      it('aborts when `after save` fires when option to notify is false', function(done) {
        monitorHookExecution();

        TestModel.create(
          [{name: '1'}, {name: '2'}],
          {notify: false},
          function(err) {
            if (err) return done(err);

            hookMonitor.names.should.not.containEql('after save');
            done();
          },
        );
      });

      it('triggers `before save` hook for each item in the array', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.createAll([{name: '1'}, {name: '2'}], function(err, list) {
          if (err) return done(err);
          // Creation of multiple instances is executed in parallel
          ctxRecorder.records.sort(function(c1, c2) {
            return c1.instance.name - c2.instance.name;
          });
          ctxRecorder.records.should.eql([
            aCtxForModel(TestModel, {
              instance: {id: list[0].id, name: '1', extra: undefined},
              isNewInstance: true,
            }),
            aCtxForModel(TestModel, {
              instance: {id: list[1].id, name: '2', extra: undefined},
              isNewInstance: true,
            }),
          ]);
          done();
        });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        TestModel.createAll([{name: '1'}, {name: '2'}], function(err) {
          err.should.eql(expectedError);
          done();
        });
      });

      it('applies updates from `before save` hook to each item in the array', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        TestModel.createAll(
          [{id: uid.next(), name: 'a-name'}, {id: uid.next(), name: 'b-name'}],
          function(err, instances) {
            if (err) return done(err);
            instances.forEach(instance => {
              instance.should.have.property('extra', 'hook data');
            });
            done();
          },
        );
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.createAll([{name: 'created1'}, {name: 'created2'}], function(err) {
          (err || {}).should.be.instanceOf(ValidationError);
          (err.details.codes || {}).should.eql({name: ['presence']});
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.createAll(
          [{id: 'new-id-1', name: 'a name'}, {id: 'new-id-2', name: 'b name'}],
          function(err, instances) {
            if (err) return done(err);

            ctxRecorder.records.should.eql([
              aCtxForModel(TestModel, {
                data: {id: 'new-id-1', name: 'a name'},
                isNewInstance: true,
                currentInstance: {extra: null, id: 'new-id-1', name: 'a name'},
              }),
              aCtxForModel(TestModel, {
                data: {id: 'new-id-2', name: 'b name'},
                isNewInstance: true,
                currentInstance: {extra: null, id: 'new-id-2', name: 'b name'},
              }),
            ]);

            done();
          },
        );
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe(
          'persist',
          ctxRecorder.recordAndNext(function(ctxArr) {
            // It's crucial to change `ctx.data` reference, not only data props
            ctxArr.forEach(ctx => {
              ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
            });
          }),
        );

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.createAll(
          [{id: 'new-id', name: 'a name'}],
          function(err, instances) {
            if (err) return done(err);

            instances.forEach(instance => {
              instance.should.have.property('extra', 'hook data');
            });

            // Also query the database here to verify that, on `create`
            // updates from `persist` hook are reflected into database
            TestModel.findById('new-id', function(err, dbInstance) {
              if (err) return done(err);
              should.exists(dbInstance);
              dbInstance.toObject(true).should.eql({
                id: 'new-id',
                name: 'a name',
                extra: 'hook data',
              });
              done();
            });
          },
        );
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.createAll(
          [
            {id: 'new-id-1', name: 'a name'},
            {id: 'new-id-2', name: 'b name'},
          ],
          function(err) {
            if (err) return done(err);

            ctxRecorder.records.sort(function(c1, c2) {
              return c1.data.name - c2.data.name;
            });
            ctxRecorder.records.should.eql([
              aCtxForModel(TestModel, {
                data: {id: 'new-id-1', name: 'a name'},
                isNewInstance: true,
              }),
              aCtxForModel(TestModel, {
                data: {id: 'new-id-2', name: 'b name'},
                isNewInstance: true,
              }),
            ]);

            done();
          },
        );
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.createAll(
          [{id: 'new-id', name: 'a name'}],
          function(err) {
            err.should.eql(expectedError);
            done();
          },
        );
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe(
          'loaded',
          ctxRecorder.recordAndNext(function(ctx) {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
          }),
        );

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          [{id: 'new-id', name: 'a name'}],
          function(err, instances) {
            if (err) return done(err);

            instances.forEach((instance) => {
              instance.should.have.property('extra', 'hook data');
            });
            done();
          },
        );
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.createAll([{name: '1'}, {name: '2'}], function(err, list) {
          if (err) return done(err);

          ctxRecorder.records.sort(function(c1, c2) {
            return c1.instance.name - c2.instance.name;
          });
          ctxRecorder.records.should.eql([
            aCtxForModel(TestModel, {
              instance: {id: list[0].id, name: '1', extra: undefined},
              isNewInstance: true,
            }),
            aCtxForModel(TestModel, {
              instance: {id: list[1].id, name: '2', extra: undefined},
              isNewInstance: true,
            }),
          ]);
          done();
        });
      });

      it('aborts when `after save` hook fails', function(done) {
        TestModel.observe('after save', nextWithError(expectedError));

        TestModel.createAll([{name: 'created'}], function(err) {
          err.should.eql(expectedError);
          done();
        });
      });

      it('applies updates from `after save` hook', function(done) {
        TestModel.observe('after save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        TestModel.createAll([
          {name: 'a-name'},
          {name: 'b-name'},
        ], function(err, instances) {
          if (err) return done(err);
          instances.forEach((instance) => {
            instance.should.have.property('extra', 'hook data');
          });
          done();
        });
      });

      it('do not emit `after save` when before save fails for even one', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          if (ctx.instance.name === 'fail') next(expectedError);
          else next();
        });

        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.createAll([{name: 'ok'}, {name: 'fail'}], function(err, list) {
          err.should.eql(expectedError);
          done();
        });
      });
    });

    describe('PersistedModel.findOrCreate', function() {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, record, created) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
              where: {name: 'new-record'},
              limit: 1,
              offset: 0,
              skip: 0,
            }}));
            done();
          },
        );
      });

      if (dataSource.connector.findOrCreate) {
        it('triggers `before save` hook when found', function(done) {
          TestModel.observe('before save', ctxRecorder.recordAndNext());

          TestModel.findOrCreate(
            {where: {name: existingInstance.name}},
            {name: existingInstance.name},
            function(err, record, created) {
              if (err) return done(err);
              record.id.should.eql(existingInstance.id);
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                instance: {
                  id: getLastGeneratedUid(),
                  name: existingInstance.name,
                  extra: undefined,
                },
                isNewInstance: true,
              }));
              done();
            },
          );
        });
      }

      it('triggers `before save` hook when not found', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, record, created) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: record.id,
                name: 'new-record',
                extra: undefined,
              },
              isNewInstance: true,
            }));
            done();
          },
        );
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({name: ['presence']});
            done();
          },
        );
      });

      it('triggers hooks in the correct order when not found', function(done) {
        monitorHookExecution();

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            done();
          },
        );
      });

      it('triggers hooks in the correct order when found', function(done) {
        monitorHookExecution();

        TestModel.findOrCreate(
          {where: {name: existingInstance.name}},
          {name: existingInstance.name},
          function(err, record, created) {
            if (err) return done(err);

            if (dataSource.connector.findOrCreate) {
              hookMonitor.names.should.eql([
                'access',
                'before save',
                'persist',
                'loaded',
              ]);
            } else {
              hookMonitor.names.should.eql([
                'access',
                'loaded',
              ]);
            }
            done();
          },
        );
      });

      it('aborts when `access` hook fails', function(done) {
        TestModel.observe('access', nextWithError(expectedError));

        TestModel.findOrCreate(
          {where: {id: 'does-not-exist'}},
          {name: 'does-not-exist'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        TestModel.findOrCreate(
          {where: {id: 'does-not-exist'}},
          {name: 'does-not-exist'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      if (dataSource.connector.findOrCreate) {
        it('triggers `persist` hook when found', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext());

          TestModel.findOrCreate(
            {where: {name: existingInstance.name}},
            {name: existingInstance.name},
            function(err, record, created) {
              if (err) return done(err);

              record.id.should.eql(existingInstance.id);

              // `findOrCreate` creates a new instance of the object everytime.
              // So, `data.id` as well as `currentInstance.id` always matches
              // the newly generated UID.
              // Hence, the test below asserts both `data.id` and
              // `currentInstance.id` to match  getLastGeneratedUid().
              // On same lines, it also asserts `isNewInstance` to be true.
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {
                  id: getLastGeneratedUid(),
                  name: existingInstance.name,
                },
                isNewInstance: true,
                currentInstance: {
                  id: getLastGeneratedUid(),
                  name: record.name,
                  extra: null,
                },
                where: {name: existingInstance.name},
              }));

              done();
            },
          );
        });
      }

      it('triggers `persist` hook when not found', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, record, created) {
            if (err) return done(err);

            // `context.where` is present in Optimized connector context,
            // but, unoptimized connector does NOT have it.
            if (dataSource.connector.findOrCreate) {
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {
                  id: record.id,
                  name: 'new-record',
                },
                isNewInstance: true,
                currentInstance: {
                  id: record.id,
                  name: record.name,
                  extra: null,
                },
                where: {name: 'new-record'},
              }));
            } else {
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {
                  id: record.id,
                  name: 'new-record',
                },
                isNewInstance: true,
                currentInstance: {id: record.id, name: record.name, extra: null},
              }));
            }
            done();
          },
        );
      });

      if (dataSource.connector.findOrCreate) {
        it('applies updates from `persist` hook when found', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
          }));

          TestModel.findOrCreate(
            {where: {name: existingInstance.name}},
            {name: existingInstance.name},
            function(err, instance) {
              if (err) return done(err);

              // instance returned by `findOrCreate` context does not
              // have the values updated from `persist` hook
              instance.should.not.have.property('extra', 'hook data');

              // Query the database. Here, since record already exists
              // `findOrCreate`, does not update database for
              // updates from `persist` hook
              TestModel.findById(existingInstance.id, function(err, dbInstance) {
                if (err) return done(err);
                should.exists(dbInstance);
                dbInstance.toObject(true).should.eql({
                  id: existingInstance.id,
                  name: existingInstance.name,
                  extra: undefined,
                });
              });

              done();
            },
          );
        });
      }

      it('applies updates from `persist` hook when not found', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.findOrCreate) {
              instance.should.have.property('extra', 'hook data');
            } else {
              // Unoptimized connector gives a call to `create. And during
              // create the updates applied through persist hook are
              // reflected into the database, but the same updates are
              // NOT reflected in the instance object obtained in callback
              // of create.
              // So, this test asserts unoptimized connector to
              // NOT have `extra` property. And then verifes that the
              // property `extra` is actually updated in DB
              instance.should.not.have.property('extra', 'hook data');
              TestModel.findById(instance.id, function(err, dbInstance) {
                if (err) return done(err);
                should.exists(dbInstance);
                dbInstance.toObject(true).should.eql({
                  id: instance.id,
                  name: instance.name,
                  extra: 'hook data',
                });
              });
            }
            done();
          },
        );
      });

      if (dataSource.connector.findOrCreate) {
        it('triggers `loaded` hook when found', function(done) {
          TestModel.observe('loaded', ctxRecorder.recordAndNext());

          TestModel.findOrCreate(
            {where: {name: existingInstance.name}},
            {name: existingInstance.name},
            function(err, record, created) {
              if (err) return done(err);

              record.id.should.eql(existingInstance.id);

              // After the call to `connector.findOrCreate`, since the record
              // already exists, `data.id` matches `existingInstance.id`
              // as against the behaviour noted for `persist` hook
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {
                  id: existingInstance.id,
                  name: existingInstance.name,
                },
                isNewInstance: false,
              }));

              done();
            },
          );
        });
      }

      it('triggers `loaded` hook when not found', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, record, created) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {
                id: record.id,
                name: 'new-record',
              },
              isNewInstance: true,
            }));

            done();
          },
        );
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      if (dataSource.connector.findOrCreate) {
        it('applies updates from `loaded` hook when found', function(done) {
          TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
          }));

          TestModel.findOrCreate(
            {where: {name: existingInstance.name}},
            {name: existingInstance.name},
            function(err, instance) {
              if (err) return done(err);

              instance.should.have.property('extra', 'hook data');

              done();
            },
          );
        });
      }

      it('applies updates from `loaded` hook when not found', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        // Unoptimized connector gives a call to `create. But,
        // by default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        // Note - in case of findOrCreate, this setting is needed ONLY for
        // unoptimized connector.
        TestModel.settings.updateOnLoad = true;
        TestModel.findOrCreate(
          {where: {name: 'new-record'}},
          {name: 'new-record'},
          function(err, instance) {
            if (err) return done(err);

            instance.should.have.property('extra', 'hook data');
            done();
          },
        );
      });

      it('triggers `after save` hook when not found', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.findOrCreate(
          {where: {name: 'new name'}},
          {name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: instance.id,
                name: 'new name',
                extra: undefined,
              },
              isNewInstance: true,
            }));
            done();
          },
        );
      });

      it('does not trigger `after save` hook when found', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.findOrCreate(
          {where: {id: existingInstance.id}},
          {name: existingInstance.name},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql('hook not called');
            done();
          },
        );
      });
    });

    describe('PersistedModel.count', function(done) {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.count({id: existingInstance.id}, function(err, count) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
            where: {id: existingInstance.id},
          }}));
          done();
        });
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query.where = {id: existingInstance.id};
          next();
        });

        TestModel.count(function(err, count) {
          if (err) return done(err);
          count.should.equal(1);
          done();
        });
      });
    });

    describe('PersistedModel.prototype.save', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        existingInstance.save(
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            done();
          },
        );
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        existingInstance.name = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {instance: {
            id: existingInstance.id,
            name: 'changed',
            extra: undefined,
          }, options: {throws: false, validate: true}}));
          done();
        });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        existingInstance.save(function(err, instance) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `before save` hook', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        existingInstance.save(function(err) {
          (err || {}).should.be.instanceOf(ValidationError);
          (err.details.codes || {}).should.eql({name: ['presence']});
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        existingInstance.name = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);

          // HACK: extra is undefined for NoSQL and null for SQL
          delete ctxRecorder.records.data.extra;
          delete ctxRecorder.records.currentInstance.extra;
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            data: {
              id: existingInstance.id,
              name: 'changed',
            },
            currentInstance: {
              id: existingInstance.id,
              name: 'changed',
            },
            where: {id: existingInstance.id},
            options: {throws: false, validate: true},
          }));

          done();
        });
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        existingInstance.extra = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);

          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            data: {
              id: existingInstance.id,
              name: existingInstance.name,
              extra: 'changed',
            },
            isNewInstance: isNewInstanceFlag ? false : undefined,
            options: {throws: false, validate: true},
          }));

          done();
        });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        existingInstance.save(
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('triggers `after save` hook on update', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        existingInstance.name = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            instance: {
              id: existingInstance.id,
              name: 'changed',
              extra: undefined,
            },
            isNewInstance: isNewInstanceFlag ? false : undefined,
            options: {throws: false, validate: true},
          }));
          done();
        });
      });

      it('triggers `after save` hook on create', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        // The rationale behind passing { persisted: true } is to bypass the check
        // made by DAO to determine whether the instance should be saved via
        // PersistedModel.create and force it to call connector.save()
        const instance = new TestModel(
          {id: 'new-id', name: 'created'},
          {persisted: true},
        );

        instance.save(function(err, instance) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            instance: {
              id: instance.id,
              name: 'created',
              extra: undefined,
            },
            isNewInstance: isNewInstanceFlag ? true : undefined,
            options: {throws: false, validate: true},
          }));
          done();
        });
      });

      it('aborts when `after save` hook fails', function(done) {
        TestModel.observe('after save', nextWithError(expectedError));

        existingInstance.save(function(err, instance) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `after save` hook', function(done) {
        TestModel.observe('after save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });
    });

    describe('PersistedModel.prototype.updateAttributes', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        existingInstance.updateAttributes(
          {name: 'changed'},
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            done();
          },
        );
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        const currentInstance = deepCloneToObject(existingInstance);

        existingInstance.updateAttributes({name: 'changed'}, function(err) {
          if (err) return done(err);
          existingInstance.name.should.equal('changed');
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {id: existingInstance.id},
            data: {name: 'changed'},
            currentInstance: currentInstance,
          }));
          done();
        });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        existingInstance.updateAttributes({name: 'updated'}, function(err) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `before save` hook', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {
            extra: 'extra data',
            name: 'hooked name',
          });
          next();
        });

        existingInstance.updateAttributes({name: 'updated'}, function(err) {
          if (err) return done(err);
          // We must query the database here because `updateAttributes`
          // returns effectively `this`, not the data from the datasource
          TestModel.findById(existingInstance.id, function(err, instance) {
            if (err) return done(err);
            should.exists(instance);
            instance.toObject(true).should.eql({
              id: existingInstance.id,
              name: 'hooked name',
              extra: 'extra data',
            });
            done();
          });
        });
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        existingInstance.updateAttributes({name: 'updated'}, function(err) {
          (err || {}).should.be.instanceOf(ValidationError);
          (err.details.codes || {}).should.eql({name: ['presence']});
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());
        existingInstance.updateAttributes({name: 'changed'}, function(err) {
          if (err) return done(err);

          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {id: existingInstance.id},
            data: {name: 'changed'},
            currentInstance: {
              id: existingInstance.id,
              name: 'changed',
              extra: null,
            },
            isNewInstance: false,
          }));

          done();
        });
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        // By default, the instance passed to updateAttributes callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        existingInstance.updateAttributes({name: 'changed'}, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          TestModel.findById(existingInstance.id, (err, found) => {
            if (err) return done(err);
            found.should.have.property('extra', 'hook data');
            done();
          });
        });
      });

      it('applies updates from `persist` hook - for nested model instance', function(done) {
        const Address = dataSource.createModel('NestedAddress', {
          id: {type: String, id: true, default: 1},
          city: {type: String, required: true},
          country: {type: String, required: true},
        });

        const User = dataSource.createModel('UserWithAddress', {
          id: {type: String, id: true, default: uid.next},
          name: {type: String, required: true},
          address: {type: Address, required: false},
          extra: {type: String},
        });

        dataSource.automigrate(['UserWithAddress', 'NestedAddress'], function(err) {
          if (err) return done(err);
          User.create({name: 'Joe'}, function(err, instance) {
            if (err) return done(err);

            const existingUser = instance;

            User.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
              should.exist(ctx.data.address);
              ctx.data.address.should.be.type('object');
              ctx.data.address.should.not.be.instanceOf(Address);

              // It's crucial to change `ctx.data` reference, not only data props
              ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
            }));

            // By default, the instance passed to updateAttributes callback is NOT updated
            // with the changes made through persist/loaded hooks. To preserve
            // backwards compatibility, we introduced a new setting updateOnLoad,
            // which if set, will apply these changes to the model instance too.
            User.settings.updateOnLoad = true;
            existingUser.updateAttributes(
              {address: new Address({city: 'Springfield', country: 'USA'})},
              function(err, inst) {
                if (err) return done(err);

                inst.should.have.property('extra', 'hook data');

                User.findById(existingUser.id, function(err, dbInstance) {
                  if (err) return done(err);
                  dbInstance.toObject(true).should.eql({
                    id: existingUser.id,
                    name: existingUser.name,
                    address: {id: '1', city: 'Springfield', country: 'USA'},
                    extra: 'hook data',
                  });
                  done();
                });
              },
            );
          });
        });
      });

      it('emits error when `persist` hook fails', function(done) {
        TestModel.observe('persist', nextWithError(expectedError));

        TestModel.settings.updateOnLoad = true;
        existingInstance.updateAttributes({name: 'test'}, function(err, instance) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());
        existingInstance.updateAttributes({name: 'changed'}, function(err) {
          if (err) return done(err);

          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            data: {name: 'changed'},
            isNewInstance: false,
          }));

          done();
        });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        existingInstance.updateAttributes(
          {name: 'changed'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      it('applies updates from `loaded` hook updateAttributes', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        // By default, the instance passed to updateAttributes callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        existingInstance.updateAttributes({name: 'changed'}, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        existingInstance.name = 'changed';
        existingInstance.updateAttributes({name: 'changed'}, function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            instance: {
              id: existingInstance.id,
              name: 'changed',
              extra: undefined,
            },
            isNewInstance: false,
          }));
          done();
        });
      });

      it('aborts when `after save` hook fails', function(done) {
        TestModel.observe('after save', nextWithError(expectedError));

        existingInstance.updateAttributes({name: 'updated'}, function(err) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `after save` hook', function(done) {
        TestModel.observe('after save', function(ctx, next) {
          ctx.instance.should.be.instanceOf(TestModel);
          ctx.instance.extra = 'hook data';
          next();
        });

        existingInstance.updateAttributes({name: 'updated'}, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });
    });

    if (!dataSource.connector.replaceById) {
      describe.skip('replaceAttributes - not implemented', function() {});
    } else {
      describe('PersistedModel.prototype.replaceAttributes', function() {
        it('triggers hooks in the correct order', function(done) {
          monitorHookExecution();

          existingInstance.replaceAttributes(
            {name: 'replaced'},
            function(err, record, created) {
              if (err) return done(err);
              hookMonitor.names.should.eql([
                'before save',
                'persist',
                'loaded',
                'after save',
              ]);
              done();
            },
          );
        });

        it('triggers `before save` hook', function(done) {
          TestModel.observe('before save', ctxRecorder.recordAndNext());

          existingInstance.replaceAttributes({name: 'changed'}, function(err) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: existingInstance.id,
                name: 'changed',
                extra: undefined,
              },
              isNewInstance: false,
            }));
            done();
          });
        });

        it('aborts when `before save` hook fails', function(done) {
          TestModel.observe('before save', nextWithError(expectedError));

          existingInstance.replaceAttributes({name: 'replaced'}, function(err) {
            [err].should.eql([expectedError]);
            done();
          });
        });

        it('applies updates from `before save` hook', function(done) {
          TestModel.observe('before save', function(ctx, next) {
            ctx.instance.extra = 'extra data';
            ctx.instance.name = 'hooked name';
            next();
          });

          existingInstance.replaceAttributes({name: 'updated'}, function(err) {
            if (err) return done(err);
            TestModel.findById(existingInstance.id, function(err, instance) {
              if (err) return done(err);
              should.exists(instance);
              instance.toObject(true).should.eql({
                id: existingInstance.id,
                name: 'hooked name',
                extra: 'extra data',
              });
              done();
            });
          });
        });

        it('validates model after `before save` hook', function(done) {
          TestModel.observe('before save', invalidateTestModel());

          existingInstance.replaceAttributes({name: 'updated'}, function(err) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({name: ['presence']});
            done();
          });
        });

        it('triggers `persist` hook', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext());
          existingInstance.replaceAttributes({name: 'replacedName'}, function(err) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              where: {id: existingInstance.id},
              data: {
                name: 'replacedName',
                id: existingInstance.id,
              },
              currentInstance: {
                id: existingInstance.id,
                name: 'replacedName',
                extra: null,
              },
              isNewInstance: false,
            }));

            done();
          });
        });

        it('applies delete from `persist` hook', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
            delete ctx.data.extra;
          }));

          existingInstance.replaceAttributes({name: 'changed'}, function(err, instance) {
            if (err) return done(err);
            instance.should.not.have.property('extra', 'hook data');
            done();
          });
        });

        it('applies updates from `persist` hook - for nested model instance', function(done) {
          const Address = dataSource.createModel('NestedAddress', {
            id: {type: String, id: true, default: 1},
            city: {type: String, required: true},
            country: {type: String, required: true},
          });

          const User = dataSource.createModel('UserWithAddress', {
            id: {type: String, id: true, default: uid.next},
            name: {type: String, required: true},
            address: {type: Address, required: false},
            extra: {type: String},
          });

          dataSource.automigrate(['UserWithAddress', 'NestedAddress'], function(err) {
            if (err) return done(err);
            User.create({name: 'Joe'}, function(err, instance) {
              if (err) return done(err);

              const existingUser = instance;

              User.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
                should.exist(ctx.data.address);
                ctx.data.address.should.be.type('object');
                ctx.data.address.should.not.be.instanceOf(Address);

                // It's crucial to change `ctx.data` reference, not only data props
                ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
              }));

              existingUser.replaceAttributes(
                {name: 'John', address: new Address({city: 'Springfield', country: 'USA'})},
                function(err, inst) {
                  if (err) return done(err);

                  inst.should.have.property('extra', 'hook data');

                  User.findById(existingUser.id, function(err, dbInstance) {
                    if (err) return done(err);
                    dbInstance.toObject(true).should.eql({
                      id: existingUser.id,
                      name: 'John',
                      address: {id: '1', city: 'Springfield', country: 'USA'},
                      extra: 'hook data',
                    });
                    done();
                  });
                },
              );
            });
          });
        });

        it('triggers `loaded` hook', function(done) {
          TestModel.observe('loaded', ctxRecorder.recordAndNext());
          existingInstance.replaceAttributes({name: 'changed'}, function(err, data) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {
                name: 'changed',
                id: data.id,
              },
              isNewInstance: false,
            }));
            done();
          });
        });

        it('emits error when `loaded` hook fails', function(done) {
          TestModel.observe('loaded', nextWithError(expectedError));
          existingInstance.replaceAttributes(
            {name: 'replaced'},
            function(err, instance) {
              [err].should.eql([expectedError]);
              done();
            },
          );
        });

        it('applies updates from `loaded` hook replaceAttributes', function(done) {
          TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {name: 'changed in hook'});
          }));

          existingInstance.replaceAttributes({name: 'changed'}, function(err, instance) {
            if (err) return done(err);
            instance.should.have.property('name', 'changed in hook');
            done();
          });
        });

        it('triggers `after save` hook', function(done) {
          TestModel.observe('after save', ctxRecorder.recordAndNext());

          existingInstance.name = 'replaced';
          existingInstance.replaceAttributes({name: 'replaced'}, function(err) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: existingInstance.id,
                name: 'replaced',
                extra: undefined,
              },
              isNewInstance: false,
            }));
            done();
          });
        });

        it('aborts when `after save` hook fails', function(done) {
          TestModel.observe('after save', nextWithError(expectedError));

          existingInstance.replaceAttributes({name: 'replaced'}, function(err) {
            [err].should.eql([expectedError]);
            done();
          });
        });

        it('applies updates from `after save` hook', function(done) {
          TestModel.observe('after save', function(ctx, next) {
            ctx.instance.should.be.instanceOf(TestModel);
            ctx.instance.extra = 'hook data';
            next();
          });

          existingInstance.replaceAttributes({name: 'updated'}, function(err, instance) {
            if (err) return done(err);
            instance.should.have.property('extra', 'hook data');
            done();
          });
        });
      });
    }

    describe('PersistedModel.updateOrCreate', function() {
      it('triggers hooks in the correct order on create', function(done) {
        monitorHookExecution();

        TestModel.updateOrCreate(
          {id: 'not-found', name: 'not found'},
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            done();
          },
        );
      });

      it('triggers hooks in the correct order on update', function(done) {
        monitorHookExecution();

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'new name'},
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            done();
          },
        );
      });

      it('triggers `access` hook on create', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: 'not-found', name: 'not found'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
              where: {id: 'not-found'},
            }}));
            done();
          },
        );
      });

      it('triggers `access` hook on update', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
              where: {id: existingInstance.id},
            }}));
            done();
          },
        );
      });

      it('does not trigger `access` on missing id', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.equal('hook not called');
            done();
          },
        );
      });

      it('applies updates from `access` hook when found', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            findTestModels({fields: ['id', 'name']}, function(err, list) {
              if (err) return done(err);
              (list || []).map(toObject).should.eql([
                {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                {id: instance.id, name: 'new name', extra: undefined},
              ]);
              done();
            });
          },
        );
      });

      it('applies updates from `access` hook when not found', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: 'not-found'}};
          next();
        });

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            findTestModels({fields: ['id', 'name']}, function(err, list) {
              if (err) return done(err);
              (list || []).map(toObject).should.eql([
                {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                {id: list[1].id, name: 'second', extra: undefined},
                {id: instance.id, name: 'new name', extra: undefined},
              ]);
              done();
            });
          },
        );
      });

      it('triggers hooks only once', function(done) {
        monitorHookExecution(['access', 'before save']);

        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        TestModel.updateOrCreate(
          {id: 'ignored', name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            hookMonitor.names.should.eql(['access', 'before save']);
            done();
          },
        );
      });

      it('triggers `before save` hook on update', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            if (dataSource.connector.updateOrCreate) {
              // Atomic implementations of `updateOrCreate` cannot
              // provide full instance as that depends on whether
              // UPDATE or CREATE will be triggered
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                where: {id: existingInstance.id},
                data: {id: existingInstance.id, name: 'updated name'},
              }));
            } else {
              // currentInstance is set, because a non-atomic `updateOrCreate`
              // will use `prototype.updateAttributes` internally, which
              // exposes this to the context
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                where: {id: existingInstance.id},
                data: {id: existingInstance.id, name: 'updated name'},
                currentInstance: existingInstance,
              }));
            }
            done();
          },
        );
      });

      it('triggers `before save` hook on create', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              // Atomic implementations of `updateOrCreate` cannot
              // provide full instance as that depends on whether
              // UPDATE or CREATE will be triggered
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                where: {id: 'new-id'},
                data: {id: 'new-id', name: 'a name'},
              }));
            } else {
              // The default unoptimized implementation runs
              // `instance.save` and thus a full instance is availalbe
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                instance: {id: 'new-id', name: 'a name', extra: undefined},
                isNewInstance: true,
              }));
            }

            done();
          },
        );
      });

      it('applies updates from `before save` hook on update', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {name: 'hooked'});
          next();
        });

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            instance.name.should.equal('hooked');
            done();
          },
        );
      });

      it('applies updates from `before save` hook on create', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          if (ctx.instance) {
            ctx.instance.name = 'hooked';
          } else {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {name: 'hooked'});
          }
          next();
        });

        TestModel.updateOrCreate(
          {id: 'new-id', name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            instance.name.should.equal('hooked');
            done();
          },
        );
      });

      // FIXME(bajtos) this fails with connector-specific updateOrCreate
      // implementations, see the comment inside lib/dao.js (updateOrCreate)
      it.skip('validates model after `before save` hook on update', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({name: ['presence']});
            done();
          },
        );
      });

      // FIXME(bajtos) this fails with connector-specific updateOrCreate
      // implementations, see the comment inside lib/dao.js (updateOrCreate)
      it.skip('validates model after `before save` hook on create', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.updateOrCreate(
          {id: 'new-id', name: 'new name'},
          function(err, instance) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({name: ['presence']});
            done();
          },
        );
      });

      it('triggers `persist` hook on create', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                where: {id: 'new-id'},
                data: {id: 'new-id', name: 'a name'},
                currentInstance: {
                  id: 'new-id',
                  name: 'a name',
                  extra: undefined,
                },
              }));
            } else {
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {
                  id: 'new-id',
                  name: 'a name',
                },
                isNewInstance: true,
                currentInstance: {
                  id: 'new-id',
                  name: 'a name',
                  extra: undefined,
                },
              }));
            }
            done();
          },
        );
      });

      it('triggers `persist` hook on update', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);

            const expectedContext = aCtxForModel(TestModel, {
              where: {id: existingInstance.id},
              data: {
                id: existingInstance.id,
                name: 'updated name',
              },
              currentInstance: {
                id: existingInstance.id,
                name: 'updated name',
                extra: undefined,
              },
            });

            if (!dataSource.connector.updateOrCreate) {
              // When the connector does not provide updateOrCreate,
              // DAO falls back to updateAttributes which sets this flag
              expectedContext.isNewInstance = false;
            }

            ctxRecorder.records.should.eql(expectedContext);
            done();
          },
        );
      });

      it('triggers `loaded` hook on create', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {id: 'new-id', name: 'a name'},
                isNewInstance: isNewInstanceFlag ? true : undefined,
              }));
            } else {
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
                data: {
                  id: 'new-id',
                  name: 'a name',
                },
                isNewInstance: true,
              }));
            }
            done();
          },
        );
      });

      it('triggers `loaded` hook on update', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {
                id: existingInstance.id,
                name: 'updated name',
              },
              isNewInstance: isNewInstanceFlag ? false : undefined,
            }));
            done();
          },
        );
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.updateOrCreate(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          },
        );
      });

      it('triggers `after save` hook on update', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: existingInstance.id,
                name: 'updated name',
                extra: undefined,
              },
              isNewInstance: isNewInstanceFlag ? false : undefined,
            }));
            done();
          },
        );
      });

      it('aborts when `after save` fires on update or create when option to notify is false', function(done) {
        monitorHookExecution();

        TestModel.updateOrCreate({name: 'created'}, {notify: false}, function(err, record, created) {
          if (err) return done(err);

          hookMonitor.names.should.not.containEql('after save');
          done();
        });
      });

      it('triggers `after save` hook on create', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.updateOrCreate(
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: instance.id,
                name: 'a name',
                extra: undefined,
              },
              isNewInstance: isNewInstanceFlag ? true : undefined,
            }));
            done();
          },
        );
      });
    });

    if (!dataSource.connector.replaceById) {
      describe.skip('replaceOrCreate - not implemented', function() {});
    } else {
      describe('PersistedModel.replaceOrCreate', function() {
        it('triggers hooks in the correct order on create', function(done) {
          monitorHookExecution();

          TestModel.replaceOrCreate(
            {id: 'not-found', name: 'not found'},
            function(err, record, created) {
              if (err) return done(err);
              hookMonitor.names.should.eql([
                'access',
                'before save',
                'persist',
                'loaded',
                'after save',
              ]);
              done();
            },
          );
        });

        it('triggers hooks in the correct order on replace', function(done) {
          monitorHookExecution();

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'new name'},
            function(err, record, created) {
              if (err) return done(err);
              hookMonitor.names.should.eql([
                'access',
                'before save',
                'persist',
                'loaded',
                'after save',
              ]);
              done();
            },
          );
        });

        it('triggers `access` hook on create', function(done) {
          TestModel.observe('access', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: 'not-found', name: 'not found'},
            function(err, instance) {
              if (err) return done(err);
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
                where: {id: 'not-found'},
              }}));
              done();
            },
          );
        });

        it('triggers `access` hook on replace', function(done) {
          TestModel.observe('access', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'new name'},
            function(err, instance) {
              if (err) return done(err);
              ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
                where: {id: existingInstance.id},
              }}));
              done();
            },
          );
        });

        it('does not trigger `access` on missing id', function(done) {
          TestModel.observe('access', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {name: 'new name'},
            function(err, instance) {
              if (err) return done(err);
              ctxRecorder.records.should.equal('hook not called');
              done();
            },
          );
        });

        it('applies updates from `access` hook when found', function(done) {
          TestModel.observe('access', function(ctx, next) {
            ctx.query = {where: {id: {neq: existingInstance.id}}};
            next();
          });

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'new name'},
            function(err, instance) {
              if (err) return done(err);
              findTestModels({fields: ['id', 'name']}, function(err, list) {
                if (err) return done(err);
                (list || []).map(toObject).should.eql([
                  {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                  {id: instance.id, name: 'new name', extra: undefined},
                ]);
                done();
              });
            },
          );
        });

        it('applies updates from `access` hook when not found', function(done) {
          TestModel.observe('access', function(ctx, next) {
            ctx.query = {where: {id: 'not-found'}};
            next();
          });

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'new name'},
            function(err, instance) {
              if (err) return done(err);
              findTestModels({fields: ['id', 'name']}, function(err, list) {
                if (err) return done(err);
                (list || []).map(toObject).should.eql([
                  {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                  {id: list[1].id, name: 'second', extra: undefined},
                  {id: instance.id, name: 'new name', extra: undefined},
                ]);
                done();
              });
            },
          );
        });

        it('triggers hooks only once', function(done) {
          monitorHookExecution(['access', 'before save']);

          TestModel.observe('access', function(ctx, next) {
            ctx.query = {where: {id: {neq: existingInstance.id}}};
            next();
          });

          TestModel.replaceOrCreate(
            {id: 'ignored', name: 'new name'},
            function(err, instance) {
              if (err) return done(err);
              hookMonitor.names.should.eql(['access', 'before save']);
              done();
            },
          );
        });

        it('triggers `before save` hookon create', function(done) {
          TestModel.observe('before save', ctxRecorder.recordAndNext());
          TestModel.replaceOrCreate({id: existingInstance.id, name: 'new name'},
            function(err, instance) {
              if (err)
                return done(err);

              const expectedContext = aCtxForModel(TestModel, {
                instance: instance,
              });

              if (!dataSource.connector.replaceOrCreate) {
                expectedContext.isNewInstance = false;
              }
              done();
            });
        });

        it('triggers `before save` hook on replace', function(done) {
          TestModel.observe('before save', ctxRecorder.recordAndNext());
          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'replaced name'},
            function(err, instance) {
              if (err) return done(err);

              const expectedContext = aCtxForModel(TestModel, {
                instance: {
                  id: existingInstance.id,
                  name: 'replaced name',
                  extra: undefined,
                },
              });

              if (!dataSource.connector.replaceOrCreate) {
                expectedContext.isNewInstance = false;
              }
              ctxRecorder.records.should.eql(expectedContext);

              done();
            },
          );
        });

        it('triggers `before save` hook on create', function(done) {
          TestModel.observe('before save', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'a name'},
            function(err, instance) {
              if (err) return done(err);

              const expectedContext = aCtxForModel(TestModel, {
                instance: {
                  id: 'new-id',
                  name: 'a name',
                  extra: undefined,
                },
              });

              if (!dataSource.connector.replaceOrCreate) {
                expectedContext.isNewInstance = true;
              }
              ctxRecorder.records.should.eql(expectedContext);

              done();
            },
          );
        });

        it('applies updates from `before save` hook on create', function(done) {
          TestModel.observe('before save', function(ctx, next) {
            ctx.instance.name = 'hooked';
            next();
          });

          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'new name'},
            function(err, instance) {
              if (err) return done(err);
              instance.name.should.equal('hooked');
              done();
            },
          );
        });

        it('validates model after `before save` hook on create', function(done) {
          TestModel.observe('before save', invalidateTestModel());

          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'new name'},
            function(err, instance) {
              (err || {}).should.be.instanceOf(ValidationError);
              (err.details.codes || {}).should.eql({name: ['presence']});
              done();
            },
          );
        });

        it('triggers `persist` hook on create', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'a name'},
            function(err, instance) {
              if (err) return done(err);

              const expectedContext = aCtxForModel(TestModel, {
                currentInstance: {
                  id: 'new-id',
                  name: 'a name',
                  extra: undefined,
                },
                data: {
                  id: 'new-id',
                  name: 'a name',
                },
              });

              if (dataSource.connector.replaceOrCreate) {
                expectedContext.where = {id: 'new-id'};
              } else {
                // non-atomic implementation does not provide ctx.where
                // because a new instance is being created, so there
                // are not records to match where filter.
                expectedContext.isNewInstance = true;
              }
              ctxRecorder.records.should.eql(expectedContext);
              done();
            },
          );
        });

        it('triggers `persist` hook on replace', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'replaced name'},
            function(err, instance) {
              if (err) return done(err);

              const expected = {
                where: {id: existingInstance.id},
                data: {
                  id: existingInstance.id,
                  name: 'replaced name',
                },
                currentInstance: {
                  id: existingInstance.id,
                  name: 'replaced name',
                  extra: undefined,
                },
              };

              const expectedContext = aCtxForModel(TestModel, expected);

              if (!dataSource.connector.replaceOrCreate) {
                expectedContext.isNewInstance = false;
              }

              ctxRecorder.records.should.eql(expectedContext);
              done();
            },
          );
        });

        it('applies updates from `persist` hook on create', function(done) {
          TestModel.observe('persist', (ctx, next) => {
            // it's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
            next();
          });

          // By default, the instance passed to create callback is NOT updated
          // with the changes made through persist/loaded hooks. To preserve
          // backwards compatibility, we introduced a new setting updateOnLoad,
          // which if set, will apply these changes to the model instance too.
          TestModel.settings.updateOnLoad = true;

          TestModel.replaceOrCreate(
            {name: 'a name'},
            function(err, instance) {
              if (err) return done(err);
              instance.should.have.property('extra', 'hook data');
              TestModel.findById(instance.id, (err, found) => {
                if (err) return done(err);
                found.should.have.property('extra', 'hook data');
                done();
              });
            },
          );
        });

        it('applies updates from `persist` hook on update', function(done) {
          TestModel.observe('persist', (ctx, next) => {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
            next();
          });

          existingInstance.name = 'changed';
          const data = existingInstance.toObject();

          TestModel.replaceOrCreate(data, function(err, instance) {
            if (err) return done(err);
            instance.should.have.property('extra', 'hook data');
            TestModel.findById(existingInstance.id, (err, found) => {
              if (err) return done(err);
              found.should.have.property('extra', 'hook data');
              done();
            });
          });
        });

        it('triggers `loaded` hook on create', function(done) {
          TestModel.observe('loaded', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'a name'},
            function(err, instance) {
              if (err) return done(err);

              const expected = {
                data: {
                  id: 'new-id',
                  name: 'a name',
                },
              };

              expected.isNewInstance =
                isNewInstanceFlag ?
                  true : undefined;

              ctxRecorder.records.should.eql(aCtxForModel(TestModel, expected));
              done();
            },
          );
        });

        it('triggers `loaded` hook on replace', function(done) {
          TestModel.observe('loaded', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'replaced name'},
            function(err, instance) {
              if (err) return done(err);

              const expected = {
                data: {
                  id: existingInstance.id,
                  name: 'replaced name',
                },
              };

              expected.isNewInstance =
                isNewInstanceFlag ?
                  false : undefined;

              ctxRecorder.records.should.eql(aCtxForModel(TestModel, expected));
              done();
            },
          );
        });

        it('emits error when `loaded` hook fails', function(done) {
          TestModel.observe('loaded', nextWithError(expectedError));
          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'a name'},
            function(err, instance) {
              [err].should.eql([expectedError]);
              done();
            },
          );
        });

        it('triggers `after save` hook on replace', function(done) {
          TestModel.observe('after save', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: existingInstance.id, name: 'replaced name'},
            function(err, instance) {
              if (err) return done(err);

              const expected = {
                instance: {
                  id: existingInstance.id,
                  name: 'replaced name',
                  extra: undefined,
                },
              };

              expected.isNewInstance =
                isNewInstanceFlag ?
                  false : undefined;

              ctxRecorder.records.should.eql(aCtxForModel(TestModel, expected));
              done();
            },
          );
        });

        it('triggers `after save` hook on create', function(done) {
          TestModel.observe('after save', ctxRecorder.recordAndNext());

          TestModel.replaceOrCreate(
            {id: 'new-id', name: 'a name'},
            function(err, instance) {
              if (err) return done(err);

              const expected = {
                instance: {
                  id: instance.id,
                  name: 'a name',
                  extra: undefined,
                },
              };
              expected.isNewInstance =
                isNewInstanceFlag ?
                  true : undefined;

              ctxRecorder.records.should.eql(aCtxForModel(TestModel, expected));
              done();
            },
          );
        });
      });
    }

    if (!dataSource.connector.replaceById) {
      describe.skip('replaceById - not implemented', function() {});
    } else {
      describe('PersistedModel.replaceById', function() {
        it('triggers hooks in the correct order on create', function(done) {
          monitorHookExecution();

          existingInstance.name = 'replaced name';
          TestModel.replaceById(
            existingInstance.id,
            existingInstance.toObject(),
            function(err, record, created) {
              if (err) return done(err);
              hookMonitor.names.should.eql([
                'before save',
                'persist',
                'loaded',
                'after save',
              ]);
              done();
            },
          );
        });

        it('triggers `persist` hook', function(done) {
          // "extra" property is undefined by default. As a result,
          // NoSQL connectors omit this property from the data. Because
          // SQL connectors store it as null, we have different results
          // depending on the database used.
          // By enabling "persistUndefinedAsNull", we force NoSQL connectors
          // to store unset properties using "null" value and thus match SQL.
          TestModel.settings.persistUndefinedAsNull = true;

          TestModel.observe('persist', ctxRecorder.recordAndNext());

          existingInstance.name = 'replaced name';
          TestModel.replaceById(
            existingInstance.id,
            existingInstance.toObject(),
            function(err, instance) {
              if (err) return done(err);

              const expected = {
                where: {id: existingInstance.id},
                data: {
                  id: existingInstance.id,
                  name: 'replaced name',
                  extra: null,
                },
                currentInstance: {
                  id: existingInstance.id,
                  name: 'replaced name',
                  extra: null,
                },
              };

              const expectedContext = aCtxForModel(TestModel, expected);
              expectedContext.isNewInstance = false;

              ctxRecorder.records.should.eql(expectedContext);
              done();
            },
          );
        });

        it('applies updates from `persist` hook', function(done) {
          TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
          }));

          existingInstance.name = 'changed';
          TestModel.replaceById(
            existingInstance.id,
            existingInstance.toObject(),
            function(err, instance) {
              if (err) return done(err);
              instance.should.have.property('extra', 'hook data');
              TestModel.findById(existingInstance.id, (err, found) => {
                if (err) return done(err);
                found.should.have.property('extra', 'hook data');
                done();
              });
            },
          );
        });
      });
    }

    describe('PersistedModel.deleteAll', function() {
      it('triggers `access` hook with query', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.deleteAll({name: existingInstance.name}, function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            query: {where: {name: existingInstance.name}},
          }));
          done();
        });
      });

      it('triggers `access` hook without query', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {where: {}}}));
          done();
        });
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          findTestModels(function(err, list) {
            if (err) return done(err);
            (list || []).map(get('id')).should.eql([existingInstance.id]);
            done();
          });
        });
      });

      it('triggers `before delete` hook with query', function(done) {
        TestModel.observe('before delete', ctxRecorder.recordAndNext());

        TestModel.deleteAll({name: existingInstance.name}, function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {name: existingInstance.name},
          }));
          done();
        });
      });

      it('triggers `before delete` hook without query', function(done) {
        TestModel.observe('before delete', ctxRecorder.recordAndNext());

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {where: {}}));
          done();
        });
      });

      it('applies updates from `before delete` hook', function(done) {
        TestModel.observe('before delete', function(ctx, next) {
          ctx.where = {id: {neq: existingInstance.id}};
          next();
        });

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          findTestModels(function(err, list) {
            if (err) return done(err);
            (list || []).map(get('id')).should.eql([existingInstance.id]);
            done();
          });
        });
      });

      it('aborts when `before delete` hook fails', function(done) {
        TestModel.observe('before delete', nextWithError(expectedError));

        TestModel.deleteAll(function(err, list) {
          [err].should.eql([expectedError]);
          TestModel.findById(existingInstance.id, function(err, inst) {
            if (err) return done(err);
            (inst ? inst.toObject() : 'null').should.
              eql(existingInstance.toObject());
            done();
          });
        });
      });

      it('triggers `after delete` hook without query', function(done) {
        TestModel.observe('after delete', ctxRecorder.recordAndNext());

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {},
            info: {count: 2},
          }));
          done();
        });
      });

      it('triggers `after delete` hook with query', function(done) {
        TestModel.observe('after delete', ctxRecorder.recordAndNext());

        TestModel.deleteAll({name: existingInstance.name}, function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {name: existingInstance.name},
            info: {count: 1},
          }));
          done();
        });
      });

      it('aborts when `after delete` hook fails', function(done) {
        TestModel.observe('after delete', nextWithError(expectedError));

        TestModel.deleteAll(function(err) {
          [err].should.eql([expectedError]);
          done();
        });
      });
    });

    describe('PersistedModel.prototype.delete', function() {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        existingInstance.delete(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            query: {where: {id: existingInstance.id}},
          }));
          done();
        });
      });

      it('applies updated from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        existingInstance.delete(function(err) {
          if (err) return done(err);
          findTestModels(function(err, list) {
            if (err) return done(err);
            (list || []).map(get('id')).should.eql([existingInstance.id]);
            done();
          });
        });
      });

      it('triggers `before delete` hook', function(done) {
        TestModel.observe('before delete', ctxRecorder.recordAndNext());

        existingInstance.delete(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {id: existingInstance.id},
            instance: existingInstance,
          }));
          done();
        });
      });

      it('applies updated from `before delete` hook', function(done) {
        TestModel.observe('before delete', function(ctx, next) {
          ctx.where = {id: {neq: existingInstance.id}};
          next();
        });

        existingInstance.delete(function(err) {
          if (err) return done(err);
          findTestModels(function(err, list) {
            if (err) return done(err);
            (list || []).map(get('id')).should.eql([existingInstance.id]);
            done();
          });
        });
      });

      it('aborts when `before delete` hook fails', function(done) {
        TestModel.observe('before delete', nextWithError(expectedError));

        existingInstance.delete(function(err, list) {
          [err].should.eql([expectedError]);
          TestModel.findById(existingInstance.id, function(err, inst) {
            if (err) return done(err);
            (inst ? inst.toObject() : 'null').should.eql(
              existingInstance.toObject(),
            );
            done();
          });
        });
      });

      it('triggers `after delete` hook', function(done) {
        TestModel.observe('after delete', ctxRecorder.recordAndNext());

        existingInstance.delete(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {id: existingInstance.id},
            instance: existingInstance,
            info: {count: 1},
          }));
          done();
        });
      });

      it('triggers `after delete` hook without query', function(done) {
        TestModel.observe('after delete', ctxRecorder.recordAndNext());

        TestModel.deleteAll({name: existingInstance.name}, function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
            where: {name: existingInstance.name},
            info: {count: 1},
          }));
          done();
        });
      });

      it('aborts when `after delete` hook fails', function(done) {
        TestModel.observe('after delete', nextWithError(expectedError));

        TestModel.deleteAll(function(err) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('propagates hookState from `before delete` to `after delete`', function(done) {
        TestModel.observe('before delete', ctxRecorder.recordAndNext(function(ctx) {
          ctx.hookState.foo = 'bar';
        }));

        TestModel.observe('after delete', ctxRecorder.recordAndNext(function(ctx) {
          ctx.hookState.foo = ctx.hookState.foo.toUpperCase();
        }));

        existingInstance.delete(function(err) {
          if (err) return done(err);
          ctxRecorder.records.should.eql([
            aCtxForModel(TestModel, {
              hookState: {foo: 'bar'},
              where: {id: '1'},
              instance: existingInstance,
            }),
            aCtxForModel(TestModel, {
              hookState: {foo: 'BAR'},
              info: {count: 1},
              where: {id: '1'},
              instance: existingInstance,
            }),
          ]);
          done();
        });
      });

      it('triggers hooks only once', function(done) {
        monitorHookExecution();
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        existingInstance.delete(function(err) {
          if (err) return done(err);
          hookMonitor.names.should.eql(['access', 'before delete', 'after delete']);
          done();
        });
      });
    });

    describe('PersistedModel.updateAll', function() {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.updateAll(
          {name: 'searched'},
          {name: 'updated'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
              where: {name: 'searched'},
            }}));
            done();
          },
        );
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        TestModel.updateAll(
          {id: existingInstance.id},
          {name: 'new name'},
          function(err) {
            if (err) return done(err);
            findTestModels({fields: ['id', 'name']}, function(err, list) {
              if (err) return done(err);
              (list || []).map(toObject).should.eql([
                {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                {id: '2', name: 'new name', extra: undefined},
              ]);
              done();
            });
          },
        );
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.updateAll(
          {name: 'searched'},
          {name: 'updated'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              where: {name: 'searched'},
              data: {name: 'updated'},
            }));
            done();
          },
        );
      });

      it('applies updates from `before save` hook', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.data = {name: 'hooked', extra: 'added'};
          next();
        });

        TestModel.updateAll(
          {id: existingInstance.id},
          {name: 'updated name'},
          function(err) {
            if (err) return done(err);
            loadTestModel(existingInstance.id, function(err, instance) {
              if (err) return done(err);
              instance.should.have.property('name', 'hooked');
              instance.should.have.property('extra', 'added');
              done();
            });
          },
        );
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.updateAll(
          {name: existingInstance.name},
          {name: 'changed'},
          function(err, instance) {
            if (err) return done(err);

            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {name: 'changed'},
              where: {name: existingInstance.name},
            }));

            done();
          },
        );
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {extra: 'hook data'});
        }));

        TestModel.updateAll(
          {id: existingInstance.id},
          {name: 'changed'},
          function(err) {
            if (err) return done(err);
            loadTestModel(existingInstance.id, function(err, instance) {
              instance.should.have.property('extra', 'hook data');
              done();
            });
          },
        );
      });

      it('does not trigger `loaded`', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        TestModel.updateAll(
          {id: existingInstance.id},
          {name: 'changed'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql('hook not called');
            done();
          },
        );
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.updateAll(
          {id: existingInstance.id},
          {name: 'updated name'},
          function(err) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              where: {id: existingInstance.id},
              data: {name: 'updated name'},
              info: {count: 1},
            }));
            done();
          },
        );
      });

      it('accepts hookState from options', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.updateAll(
          {id: existingInstance.id},
          {name: 'updated name'},
          {foo: 'bar'},
          function(err) {
            if (err) return done(err);
            ctxRecorder.records.options.should.eql({
              foo: 'bar',
            });
            done();
          },
        );
      });
    });

    describe('PersistedModel.upsertWithWhere', function() {
      it('triggers hooks in the correct order on create', function(done) {
        monitorHookExecution();
        TestModel.upsertWithWhere({extra: 'not-found'},
          {id: 'not-found', name: 'not found', extra: 'not-found'},
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            TestModel.findById('not-found', function(err, data) {
              if (err) return done(err);
              data.name.should.equal('not found');
              data.extra.should.equal('not-found');
              done();
            });
          });
      });

      it('triggers hooks in the correct order on update', function(done) {
        monitorHookExecution();
        TestModel.upsertWithWhere({id: existingInstance.id},
          {name: 'new name', extra: 'new extra'},
          function(err, record, created) {
            if (err) return done(err);
            hookMonitor.names.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save',
            ]);
            TestModel.findById(existingInstance.id, function(err, data) {
              if (err) return done(err);
              data.name.should.equal('new name');
              data.extra.should.equal('new extra');
              done();
            });
          });
      });

      it('triggers `access` hook on create', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({extra: 'not-found'},
          {id: 'not-found', name: 'not found'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
              where: {extra: 'not-found'},
            }}));
            done();
          });
      });

      it('triggers `access` hook on update', function(done) {
        TestModel.observe('access', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: existingInstance.id},
          {name: 'new name', extra: 'new extra'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {query: {
              where: {id: existingInstance.id},
            }}));
            done();
          });
      });

      it('triggers hooks only once', function(done) {
        monitorHookExecution(['access', 'before save']);

        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        TestModel.upsertWithWhere({id: existingInstance.id},
          {name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            hookMonitor.names.should.eql(['access', 'before save']);
            done();
          });
      });

      it('applies updates from `access` hook when found', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: {neq: existingInstance.id}}};
          next();
        });

        TestModel.upsertWithWhere({id: existingInstance.id},
          {name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            findTestModels({fields: ['id', 'name']}, function(err, list) {
              if (err) return done(err);
              (list || []).map(toObject).should.eql([
                {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                {id: instance.id, name: 'new name', extra: undefined},
              ]);
              done();
            });
          });
      });

      it('applies updates from `access` hook when not found', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = {where: {id: 'not-found'}};
          next();
        });

        TestModel.upsertWithWhere({id: existingInstance.id},
          {name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            findTestModels({fields: ['id', 'name']}, function(err, list) {
              if (err) return done(err);
              (list || []).map(toObject).should.eql([
                {id: existingInstance.id, name: existingInstance.name, extra: undefined},
                {id: list[1].id, name: 'second', extra: undefined},
                {id: instance.id, name: 'new name', extra: undefined},
              ]);
              done();
            });
          });
      });

      it('triggers `before save` hook on update', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: existingInstance.id},
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            const expectedContext = aCtxForModel(TestModel, {
              where: {id: existingInstance.id},
              data: {
                id: existingInstance.id,
                name: 'updated name',
              },
            });
            if (!dataSource.connector.upsertWithWhere) {
              // the difference between `existingInstance` and the following
              // plain-data object is `currentInstance` the missing fields are
              // null in `currentInstance`, wehere as in `existingInstance` they
              // are undefined; please see other tests for example see:
              // test for "PersistedModel.create triggers `persist` hook"
              expectedContext.currentInstance = {id: existingInstance.id, name: 'first', extra: null};
            }
            ctxRecorder.records.should.eql(expectedContext);
            done();
          });
      });

      it('triggers `before save` hook on create', function(done) {
        TestModel.observe('before save', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);
            const expectedContext = aCtxForModel(TestModel, {});

            if (dataSource.connector.upsertWithWhere) {
              expectedContext.data = {id: 'new-id', name: 'a name'};
              expectedContext.where = {id: 'new-id'};
            } else {
              expectedContext.instance = {id: 'new-id', name: 'a name', extra: null};
              expectedContext.isNewInstance = true;
            }
            ctxRecorder.records.should.eql(expectedContext);
            done();
          });
      });

      it('applies updates from `before save` hook on update', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          // It's crucial to change `ctx.data` reference, not only data props
          ctx.data = Object.assign({}, ctx.data, {name: 'hooked'});
          next();
        });

        TestModel.upsertWithWhere({id: existingInstance.id},
          {name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            instance.name.should.equal('hooked');
            done();
          });
      });

      it('applies updates from `before save` hook on create', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          if (ctx.instance) {
            ctx.instance.name = 'hooked';
          } else {
            // It's crucial to change `ctx.data` reference, not only data props
            ctx.data = Object.assign({}, ctx.data, {name: 'hooked'});
          }
          next();
        });

        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'new name'},
          function(err, instance) {
            if (err) return done(err);
            instance.name.should.equal('hooked');
            done();
          });
      });

      it('validates model after `before save` hook on create', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'new name'},
          function(err, instance) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({name: ['presence']});
            done();
          });
      });

      it('validates model after `before save` hook on update', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.upsertWithWhere({id: existingInstance.id},
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({name: ['presence']});
            done();
          });
      });

      it('triggers `persist` hook on create', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);

            const expectedContext = aCtxForModel(TestModel, {
              data: {id: 'new-id', name: 'a name'},
              currentInstance: {
                id: 'new-id',
                name: 'a name',
                extra: undefined,
              },
            });
            if (dataSource.connector.upsertWithWhere) {
              expectedContext.where = {id: 'new-id'};
            } else {
              expectedContext.isNewInstance = true;
            }

            ctxRecorder.records.should.eql(expectedContext);
            done();
          });
      });

      it('triggers persist hook on update', function(done) {
        TestModel.observe('persist', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: existingInstance.id},
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            const expectedContext = aCtxForModel(TestModel, {
              where: {id: existingInstance.id},
              data: {
                id: existingInstance.id,
                name: 'updated name',
              },
              currentInstance: {
                id: existingInstance.id,
                name: 'updated name',
                extra: undefined,
              },
            });
            if (!dataSource.connector.upsertWithWhere) {
              expectedContext.isNewInstance = false;
            }
            ctxRecorder.records.should.eql(expectedContext);
            done();
          });
      });

      it('triggers `loaded` hook on create', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              data: {id: 'new-id', name: 'a name'},
              isNewInstance: true,
            }));
            done();
          });
      });

      it('triggers `loaded` hook on update', function(done) {
        TestModel.observe('loaded', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: existingInstance.id},
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            const expectedContext = aCtxForModel(TestModel, {
              data: {
                id: existingInstance.id,
                name: 'updated name',
              },
              isNewInstance: false,
            });
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, expectedContext));
            done();
          });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'a name'},
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      it('triggers `after save` hook on update', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: existingInstance.id},
          {id: existingInstance.id, name: 'updated name'},
          function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: existingInstance.id,
                name: 'updated name',
                extra: undefined,
              },
              isNewInstance: false,
            }));
            done();
          });
      });

      it('triggers `after save` hook on create', function(done) {
        TestModel.observe('after save', ctxRecorder.recordAndNext());

        TestModel.upsertWithWhere({id: 'new-id'},
          {id: 'new-id', name: 'a name'}, function(err, instance) {
            if (err) return done(err);
            ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
              instance: {
                id: instance.id,
                name: 'a name',
                extra: undefined,
              },
              isNewInstance: true,
            }));
            done();
          });
      });
    });

    function nextWithError(err) {
      return function(context, next) {
        next(err);
      };
    }

    function invalidateTestModel() {
      return function(context, next) {
        if (context.instance) {
          context.instance.name = '';
        } else {
          context.data.name = '';
        }
        next();
      };
    }

    function findTestModels(query, cb) {
      if (cb === undefined && typeof query === 'function') {
        cb = query;
        query = null;
      }

      TestModel.find(query, {notify: false}, cb);
    }

    function loadTestModel(id, cb) {
      TestModel.findOne({where: {id: id}}, {notify: false}, cb);
    }

    function monitorHookExecution(hookNames) {
      hookMonitor.install(TestModel, hookNames);
    }

    require('./operation-hooks.suite')(dataSource, should, connectorCapabilities);
  });

  function get(propertyName) {
    return function(obj) {
      return obj[propertyName];
    };
  }

  function toObject(obj) {
    return obj.toObject ? obj.toObject() : obj;
  }
};
