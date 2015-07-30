var ValidationError = require('../').ValidationError;
var traverse = require('traverse');

module.exports = function(dataSource, should) {
  describe('Persistence hooks', function() {
    var observedContexts, expectedError, observersCalled;
    var TestModel, existingInstance;
    var migrated = false, lastId;
    var triggered;

    var undefinedValue = undefined;

    beforeEach(function setupDatabase(done) {
      observedContexts = "hook not called";
      expectedError = new Error('test error');
      observersCalled = [];

      TestModel = dataSource.createModel('TestModel', {
        // Set id.generated to false to honor client side values
        id: { type: String, id: true, generated: false, default: uid },
        name: { type: String, required: true },
        extra: { type: String, required: false }
      });

      lastId = 0;

      if (migrated) {
        TestModel.deleteAll(done);
      } else {
        dataSource.automigrate(TestModel.modelName, function(err) {
          migrated = true;
          done(err);
        });
      }
    });

    beforeEach(function createTestData(done) {
      TestModel.create({ name: 'first' }, function(err, instance) {
        if (err) return done(err);

        // Look it up from DB so that default values are retrieved
        TestModel.findById(instance.id, function(err, instance) {
          existingInstance = instance;
          undefinedValue = existingInstance.extra;

          TestModel.create({ name: 'second' }, function(err) {
            if (err) return done(err);
            done();
          });
        });
      });
    });

    describe('PersistedModel.find', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        TestModel.find(
          { where: { id: '1' } },
          function(err, list) {
            if (err) return done(err);

            triggered.should.eql([
              'access',
              'loaded'
            ]);
            done();
          });
      });

      it('triggers `access` hook', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.find({ where: { id: '1' } }, function(err, list) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            query: { where: { id: '1' } }
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
          ctx.query = { where: { id: existingInstance.id } };
          next();
        });

        TestModel.find(function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql([existingInstance.name]);
          done();
        });
      });

      it('triggers `access` hook for geo queries', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.find({ where: { geo: { near: '10,20' }}}, function(err, list) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            query: { where: { geo: { near: '10,20' } } }
          }));
          done();
        });
      });

      it('applies updates from `access` hook for geo queries', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: existingInstance.id } };
          next();
        });

        TestModel.find({ where: { geo: { near: '10,20' } } }, function(err, list) {
          if (err) return done(err);
          list.map(get('name')).should.eql([existingInstance.name]);
          done();
        });
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe('loaded', pushContextAndNext(function(ctx) {
          ctx.instance.extra = 'hook data';
        }));

        TestModel.find(
          {where: {id: 1}},
          function (err, list) {
            if (err) return done(err);

            observedContexts.should.eql(aTestModelCtx({
              instance: {
                id: "1",
                name: "first",
                extra: "hook data"
              },
              isNewInstance: false,
              hookState: { test: true },
              options: {}
            }));
            done();
          });
      })

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.find(
          {where: {id: 1}},
          function(err, list) {
            [err].should.eql([expectedError]);
            done();
          });
      });
    });

    describe('PersistedModel.create', function() {
      it('triggers hooks in the correct order', function(done) {
        monitorHookExecution();

        TestModel.create(
          { name: 'created' },
          function(err, record, created) {
            if (err) return done(err);

            triggered.should.eql([
              'before save',
              'persist',
              'loaded',
              'after save'
            ]);
            done();
          });
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.create({ name: 'created' }, function(err, instance) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            instance: {
              id: instance.id,
              name: 'created',
              extra: undefined
            },
            isNewInstance: true
          }));
          done();
        });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        TestModel.create({ name: 'created' }, function(err, instance) {
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

        TestModel.create({ id: uid(), name: 'a-name' }, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('sends `before save` for each model in an array', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.create(
          [{ name: '1' }, { name: '2' }],
          function(err, list) {
            if (err) return done(err);
            // Creation of multiple instances is executed in parallel
            observedContexts.sort(function(c1, c2) {
              return c1.instance.name - c2.instance.name;
            });
            observedContexts.should.eql([
              aTestModelCtx({
                instance: { id: list[0].id, name: '1', extra: undefined },
                isNewInstance: true
              }),
              aTestModelCtx({
                instance: { id: list[1].id, name: '2', extra: undefined  },
                isNewInstance: true
               }),
            ]);
            done();
          });
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.create({ name: 'created' }, function(err) {
          (err || {}).should.be.instanceOf(ValidationError);
          (err.details.codes || {}).should.eql({ name: ['presence'] });
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext());

        TestModel.create(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);

            observedContexts.should.eql(aTestModelCtx({
              data: { id: 'new-id', name: 'a name' },
              isNewInstance: true,
              currentInstance: { extra: null, id: 'new-id', name: 'a name' }
            }));

            done();
          });
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          { id: 'new-id', name: 'a name' },
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
                extra: 'hook data'
              });
              done();
            });

          });
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', pushContextAndNext());

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);

            observedContexts.should.eql(aTestModelCtx({
              data: { id: 'new-id', name: 'a name' },
              isNewInstance: true
            }));

            done();
          });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.create(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe('loaded', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        // By default, the instance passed to create callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        TestModel.create(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);

            instance.should.have.property('extra', 'hook data');
            done();
          });
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.create({ name: 'created' }, function(err, instance) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            instance: {
              id: instance.id,
              name: 'created',
              extra: undefined
            },
            isNewInstance: true
          }));
          done();
        });
      });

      it('aborts when `after save` hook fails', function(done) {
        TestModel.observe('after save', nextWithError(expectedError));

        TestModel.create({ name: 'created' }, function(err, instance) {
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

        TestModel.create({ name: 'a-name' }, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('sends `after save` for each model in an array', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.create(
          [{ name: '1' }, { name: '2' }],
          function(err, list) {
            if (err) return done(err);
            // Creation of multiple instances is executed in parallel
            observedContexts.sort(function(c1, c2) {
              return c1.instance.name - c2.instance.name;
            });
            observedContexts.should.eql([
              aTestModelCtx({
                instance: { id: list[0].id, name: '1', extra: undefined },
                isNewInstance: true
              }),
              aTestModelCtx({
                instance: { id: list[1].id, name: '2', extra: undefined },
                isNewInstance: true
              }),
            ]);
            done();
          });
      });

      it('emits `after save` when some models were not saved', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          if (ctx.instance.name === 'fail')
            next(expectedError);
          else
            next();
        });

        TestModel.observe('after save', pushContextAndNext());

        TestModel.create(
          [{ name: 'ok' }, { name: 'fail' }],
          function(err, list) {
            (err || []).should.have.length(2);
            err[1].should.eql(expectedError);

            // NOTE(bajtos) The current implementation of `Model.create(array)`
            // passes all models in the second callback argument, including
            // the models that were not created due to an error.
            list.map(get('name')).should.eql(['ok', 'fail']);

            observedContexts.should.eql(aTestModelCtx({
              instance: { id: list[0].id, name: 'ok', extra: undefined },
              isNewInstance: true
            }));
            done();
          });
      });
    });

    describe('PersistedModel.findOrCreate', function() {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({ query: {
              where: { name: 'new-record' },
              limit: 1,
              offset: 0,
              skip: 0
            }}));
            done();
          });
      });

      if (dataSource.connector.findOrCreate) {
        it('triggers `before save` hook when found', function(done) {
          TestModel.observe('before save', pushContextAndNext());

          TestModel.findOrCreate(
            { where: { name: existingInstance.name } },
            { name: existingInstance.name },
            function(err, record, created) {
              if (err) return done(err);
              record.id.should.eql(existingInstance.id);
              observedContexts.should.eql(aTestModelCtx({
                instance: {
                  id: getLastGeneratedUid(),
                  name: existingInstance.name,
                  extra: undefined
                },
                isNewInstance: true
              }));
              done();
            });
        });
      }

      it('triggers `before save` hook when not found', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({
              instance: {
                id: record.id,
                name: 'new-record',
                extra: undefined
              },
              isNewInstance: true
            }));
            done();
          });
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({ name: ['presence'] });
            done();
          });
      });

      it('triggers hooks in the correct order when not found', function(done) {
        monitorHookExecution();

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);
            triggered.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save'
            ]);
            done();
          });
      });

      it('triggers hooks in the correct order when found', function(done) {
        monitorHookExecution();

        TestModel.findOrCreate(
          { where: { name: existingInstance.name } },
          { name: existingInstance.name },
          function(err, record, created) {
            if (err) return done(err);

            if (dataSource.connector.findOrCreate) {
              triggered.should.eql([
                'access',
                'before save',
                'persist',
                'loaded'
              ]);
            } else {
              triggered.should.eql([
                'access',
                'loaded'
              ]);
            }
            done();
          });
      });

      it('aborts when `access` hook fails', function(done) {
        TestModel.observe('access', nextWithError(expectedError));

        TestModel.findOrCreate(
          { where: { id: 'does-not-exist' } },
          { name: 'does-not-exist' },
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        TestModel.findOrCreate(
          { where: { id: 'does-not-exist' } },
          { name: 'does-not-exist' },
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      if (dataSource.connector.findOrCreate) {
        it('triggers `persist` hook when found', function(done) {
          TestModel.observe('persist', pushContextAndNext());

          TestModel.findOrCreate(
            { where: { name: existingInstance.name } },
            { name: existingInstance.name },
            function(err, record, created) {
              if (err) return done(err);

              record.id.should.eql(existingInstance.id);

               // `findOrCreate` creates a new instance of the object everytime.
               // So, `data.id` as well as `currentInstance.id` always matches
               // the newly generated UID.
               // Hence, the test below asserts both `data.id` and
               // `currentInstance.id` to match  getLastGeneratedUid().
               // On same lines, it also asserts `isNewInstance` to be true.
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: getLastGeneratedUid(),
                  name: existingInstance.name
                },
                isNewInstance: true,
                currentInstance: {
                  id: getLastGeneratedUid(),
                  name: record.name,
                  extra: null
                },
                where: { name: existingInstance.name }
              }));

              done();
            });
        });
      }

      it('triggers `persist` hook when not found', function(done) {
        TestModel.observe('persist', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);

            // `context.where` is present in Optimized connector context,
            // but, unoptimized connector does NOT have it.
            if (dataSource.connector.findOrCreate) {
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: record.id,
                  name: 'new-record'
                },
                isNewInstance: true,
                currentInstance: {
                  id: record.id,
                  name: record.name,
                  extra: null
                },
                where: { name: 'new-record' }
              }));
            } else {
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: record.id,
                  name: 'new-record'
                },
                isNewInstance: true,
                currentInstance: { id: record.id, name: record.name, extra: null }
              }));
            }
            done();
          });
      });

      if (dataSource.connector.findOrCreate) {
        it('applies updates from `persist` hook when found', function(done) {
          TestModel.observe('persist', pushContextAndNext(function(ctx){
            ctx.data.extra = 'hook data';
          }));

          TestModel.findOrCreate(
            { where: { name: existingInstance.name } },
            { name: existingInstance.name },
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
                  extra: undefined
                });
              });

              done();
            });
        });
      }

      it('applies updates from `persist` hook when not found', function(done) {
        TestModel.observe('persist', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
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
                  extra: 'hook data'
                });
              });
            }
            done();
          });
      });

      if (dataSource.connector.findOrCreate) {
        it('triggers `loaded` hook when found', function(done) {
          TestModel.observe('loaded', pushContextAndNext());

          TestModel.findOrCreate(
            { where: { name: existingInstance.name } },
            { name: existingInstance.name },
            function(err, record, created) {
              if (err) return done(err);

              record.id.should.eql(existingInstance.id);

               // After the call to `connector.findOrCreate`, since the record
               // already exists, `data.id` matches `existingInstance.id`
               // as against the behaviour noted for `persist` hook
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: existingInstance.id,
                  name: existingInstance.name
                },
                isNewInstance: false
              }));

              done();
            });
        });
      }

      it('triggers `loaded` hook when not found', function(done) {
        TestModel.observe('loaded', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, record, created) {
            if (err) return done(err);

            observedContexts.should.eql(aTestModelCtx({
              data: {
                id: record.id,
                name: 'new-record'
              },
              isNewInstance: true
            }));

            done();
          });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.findOrCreate(
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      if (dataSource.connector.findOrCreate) {
        it('applies updates from `loaded` hook when found', function(done) {
          TestModel.observe('loaded', pushContextAndNext(function(ctx){
            ctx.data.extra = 'hook data';
          }));

          TestModel.findOrCreate(
            { where: { name: existingInstance.name } },
            { name: existingInstance.name },
            function(err, instance) {
              if (err) return done(err);

              instance.should.have.property('extra', 'hook data');

              done();
            });
        });
      }

      it('applies updates from `loaded` hook when not found', function(done) {
        TestModel.observe('loaded', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
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
          { where: { name: 'new-record' } },
          { name: 'new-record' },
          function(err, instance) {
            if (err) return done(err);

            instance.should.have.property('extra', 'hook data');
            done();
          });
      });

      it('triggers `after save` hook when not found', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { name: 'new name' } },
          { name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({
              instance: {
                id: instance.id,
                name: 'new name',
                extra: undefined
              },
              isNewInstance: true
            }));
            done();
          });
      });

      it('does not trigger `after save` hook when found', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.findOrCreate(
          { where: { id: existingInstance.id } },
          { name: existingInstance.name },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql("hook not called");
            done();
          });
      });
    });

    describe('PersistedModel.count', function(done) {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.count({ id: existingInstance.id }, function(err, count) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({ query: {
            where: { id: existingInstance.id }
          }}));
          done();
        });
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query.where = { id: existingInstance.id };
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
            triggered.should.eql([
              'before save',
              'persist',
              'loaded',
              'after save'
            ]);
            done();
          });
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        existingInstance.name = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({ instance: {
            id: existingInstance.id,
            name: 'changed',
            extra: undefined,
          }, options: { throws: false, validate: true } }));
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
          (err.details.codes || {}).should.eql({ name: ['presence'] });
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext());

        existingInstance.name = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);

          // HACK: extra is undefined for NoSQL and null for SQL
          delete observedContexts.data.extra;
          delete observedContexts.currentInstance.extra;
          observedContexts.should.eql(aTestModelCtx({
            data: {
              id: existingInstance.id,
              name: 'changed'
            },
            currentInstance: {
              id: existingInstance.id,
              name: 'changed'
            },
            where: { id: existingInstance.id },
            options: { throws: false, validate: true }
          }));

          done();
        });
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', pushContextAndNext());

        existingInstance.extra = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);

          observedContexts.should.eql(aTestModelCtx({
            data: {
              id: existingInstance.id,
              name: existingInstance.name,
              extra: 'changed',
            },
            isNewInstance: false,
            options: { throws: false, validate: true }
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
          });
      });

      it('applies updates from `loaded` hook', function(done) {
        TestModel.observe('loaded', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('triggers `after save` hook on update', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        existingInstance.name = 'changed';
        existingInstance.save(function(err, instance) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            instance: {
              id: existingInstance.id,
              name: 'changed',
              extra: undefined
            },
            isNewInstance: false,
            options: { throws: false, validate: true }
          }));
          done();
        });
      });

      it('triggers `after save` hook on create', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        var instance = new TestModel(
          { id: 'new-id', name: 'created' },
          { persisted: true });

        instance.save(function(err, instance) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            instance: {
              id: instance.id,
              name: 'created',
              extra: undefined
            },
            isNewInstance: true,
            options: { throws: false, validate: true }
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
          { name: 'changed' },
          function(err, record, created) {
            if (err) return done(err);
            triggered.should.eql([
              'before save',
              'persist',
              'loaded',
              'after save'
            ]);
            done();
          });
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        var currentInstance = deepCloneToObject(existingInstance);

        existingInstance.updateAttributes({ name: 'changed' }, function(err) {
          if (err) return done(err);
          existingInstance.name.should.equal('changed');
          observedContexts.should.eql(aTestModelCtx({
            where: { id: existingInstance.id },
            data: { name: 'changed' },
            currentInstance: currentInstance
          }));
          done();
        });
      });

      it('aborts when `before save` hook fails', function(done) {
        TestModel.observe('before save', nextWithError(expectedError));

        existingInstance.updateAttributes({ name: 'updated' }, function(err) {
          [err].should.eql([expectedError]);
          done();
        });
      });

      it('applies updates from `before save` hook', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.data.extra = 'extra data';
          ctx.data.name = 'hooked name';
          next();
        });

        existingInstance.updateAttributes({ name: 'updated' }, function(err) {
          if (err) return done(err);
          // We must query the database here because `updateAttributes`
          // returns effectively `this`, not the data from the datasource
          TestModel.findById(existingInstance.id, function(err, instance) {
            if (err) return done(err);
            should.exists(instance);
            instance.toObject(true).should.eql({
              id: existingInstance.id,
              name: 'hooked name',
              extra: 'extra data'
            });
            done();
          });
        });
      });

      it('validates model after `before save` hook', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        existingInstance.updateAttributes({ name: 'updated' }, function(err) {
          (err || {}).should.be.instanceOf(ValidationError);
          (err.details.codes || {}).should.eql({ name: ['presence'] });
          done();
        });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext());
        existingInstance.updateAttributes({ name: 'changed' }, function(err) {
          if (err) return done(err);

          observedContexts.should.eql(aTestModelCtx({
            where: { id: existingInstance.id },
            data: { name: 'changed' },
            currentInstance: {
              id: existingInstance.id,
              name: 'changed',
              extra: null
            }
          }));

          done();
        });
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        // By default, the instance passed to updateAttributes callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        existingInstance.updateAttributes({ name: 'changed' }, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('applies updates from `persist` hook - for nested model instance', function(done) {
        var Address = dataSource.createModel('NestedAddress', {
          id: { type: String, id: true, default: 1 },
          city: { type: String, required: true },
          country: { type: String, required: true }
        });

        var User = dataSource.createModel('UserWithAddress', {
          id: { type: String, id: true, default: uid() },
          name: { type: String, required: true },
          address: {type: Address, required: false},
          extra: {type: String}
        });

        dataSource.automigrate(['UserWithAddress', 'NestedAddress'], function(err) {
          if (err) return done(err);
          User.create({name: 'Joe'}, function(err, instance) {
            if (err) return done(err);

            var existingUser = instance;

            User.observe('persist', pushContextAndNext(function(ctx) {
              should.exist(ctx.data.address)
              ctx.data.address.should.be.type('object');
              ctx.data.address.should.not.be.instanceOf(Address);

              ctx.data.extra = 'hook data';
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
                    extra: 'hook data'
                  });
                  done();
                });
              });
          });
        });
      });

      it('triggers `loaded` hook', function(done) {
        TestModel.observe('loaded', pushContextAndNext());
        existingInstance.updateAttributes({ name: 'changed' }, function(err) {
          if (err) return done(err);

          observedContexts.should.eql(aTestModelCtx({
            data: { name: 'changed' }
          }));

          done();
        });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        existingInstance.updateAttributes(
          { name: 'changed' },
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      it('applies updates from `loaded` hook updateAttributes', function(done) {
        TestModel.observe('loaded', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        // By default, the instance passed to updateAttributes callback is NOT updated
        // with the changes made through persist/loaded hooks. To preserve
        // backwards compatibility, we introduced a new setting updateOnLoad,
        // which if set, will apply these changes to the model instance too.
        TestModel.settings.updateOnLoad = true;
        existingInstance.updateAttributes({ name: 'changed' }, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        existingInstance.name = 'changed';
        existingInstance.updateAttributes({ name: 'changed' }, function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            instance: {
              id: existingInstance.id,
              name: 'changed',
              extra: undefined
            },
            isNewInstance: false
          }));
          done();
        });
      });

      it('aborts when `after save` hook fails', function(done) {
        TestModel.observe('after save', nextWithError(expectedError));

        existingInstance.updateAttributes({ name: 'updated' }, function(err) {
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

        existingInstance.updateAttributes({ name: 'updated' }, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });
    });

    describe('PersistedModel.updateOrCreate', function() {
      it('triggers hooks in the correct order on create', function(done) {
        monitorHookExecution();

        TestModel.updateOrCreate(
          { id: 'not-found', name: 'not found' },
          function(err, record, created) {
            if (err) return done(err);
            triggered.should.eql([
              'access',
              'before save',
              'persist',
              'loaded',
              'after save'
            ]);
            done();
          });
      });

      it('triggers hooks in the correct order on update', function(done) {
        monitorHookExecution();

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'new name' },
          function(err, record, created) {
            if (err) return done(err);
            if (dataSource.connector.updateOrCreate) {
              triggered.should.eql([
                'access',
                'before save',
                'persist',
                'loaded',
                'after save'
              ]);
            } else {
              triggered.should.eql([
                'access',
                'loaded',
                'before save',
                'persist',
                'loaded',
                'after save'
              ]);
            }
            done();
          });
      });

      it('triggers `access` hook on create', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: 'not-found', name: 'not found' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({ query: {
              where: { id: 'not-found' }
            }}));
            done();
          });
      });

      it('triggers `access` hook on update', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({ query: {
              where: { id: existingInstance.id }
            }}));
            done();
          });
      });

      it('does not trigger `access` on missing id', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.updateOrCreate(
          { name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.equal('hook not called');
            done();
          });
      });

      it('applies updates from `access` hook when found', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: { neq: existingInstance.id } } };
          next();
        });

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            findTestModels({ fields: ['id', 'name' ] }, function(err, list) {
              if (err) return done(err);
              (list||[]).map(toObject).should.eql([
                { id: existingInstance.id, name: existingInstance.name, extra: undefined },
                { id: instance.id, name: 'new name', extra: undefined }
              ]);
              done();
            });
        });
      });

      it('applies updates from `access` hook when not found', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: 'not-found' } };
          next();
        });

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            findTestModels({ fields: ['id', 'name' ] }, function(err, list) {
              if (err) return done(err);
              (list||[]).map(toObject).should.eql([
                { id: existingInstance.id, name: existingInstance.name, extra: undefined },
                { id: list[1].id, name: 'second', extra: undefined },
                { id: instance.id, name: 'new name', extra: undefined }
              ]);
              done();
            });
        });
      });

      it('triggers hooks only once', function(done) {
        TestModel.observe('access', pushNameAndNext('access'));
        TestModel.observe('before save', pushNameAndNext('before save'));

        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: { neq: existingInstance.id } } };
          next();
        });

        TestModel.updateOrCreate(
          { id: 'ignored', name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            observersCalled.should.eql(['access', 'before save']);
            done();
          });
      });

      it('triggers `before save` hook on update', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'updated name' },
          function(err, instance) {
            if (err) return done(err);
            if (dataSource.connector.updateOrCreate) {
              // Atomic implementations of `updateOrCreate` cannot
              // provide full instance as that depends on whether
              // UPDATE or CREATE will be triggered
              observedContexts.should.eql(aTestModelCtx({
                where: { id: existingInstance.id },
                data: { id: existingInstance.id, name: 'updated name' }
              }));
            } else {
              // currentInstance is set, because a non-atomic `updateOrCreate`
              // will use `prototype.updateAttributes` internally, which
              // exposes this to the context
              observedContexts.should.eql(aTestModelCtx({
                where: { id: existingInstance.id },
                data: { id: existingInstance.id, name: 'updated name' },
                currentInstance: existingInstance
              }));
            }
            done();
          });
      });

      it('triggers `before save` hook on create', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              // Atomic implementations of `updateOrCreate` cannot
              // provide full instance as that depends on whether
              // UPDATE or CREATE will be triggered
              observedContexts.should.eql(aTestModelCtx({
                where: { id: 'new-id' },
                data: { id: 'new-id', name: 'a name' }
              }));
            } else {
              // The default unoptimized implementation runs
              // `instance.save` and thus a full instance is availalbe
              observedContexts.should.eql(aTestModelCtx({
                instance: { id: 'new-id', name: 'a name', extra: undefined },
                isNewInstance: true
              }));
            }

            done();
          });
      });

      it('applies updates from `before save` hook on update', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.data.name = 'hooked';
          next();
        });

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'updated name' },
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
            ctx.data.name = 'hooked';
          }
          next();
        });

        TestModel.updateOrCreate(
          { id: 'new-id', name: 'new name' },
          function(err, instance) {
            if (err) return done(err);
            instance.name.should.equal('hooked');
            done();
          });
      });

      // FIXME(bajtos) this fails with connector-specific updateOrCreate
      // implementations, see the comment inside lib/dao.js (updateOrCreate)
      it.skip('validates model after `before save` hook on update', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'updated name' },
          function(err, instance) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({ name: ['presence'] });
            done();
          });
      });

      // FIXME(bajtos) this fails with connector-specific updateOrCreate
      // implementations, see the comment inside lib/dao.js (updateOrCreate)
      it.skip('validates model after `before save` hook on create', function(done) {
        TestModel.observe('before save', invalidateTestModel());

        TestModel.updateOrCreate(
          { id: 'new-id', name: 'new name' },
          function(err, instance) {
            (err || {}).should.be.instanceOf(ValidationError);
            (err.details.codes || {}).should.eql({ name: ['presence'] });
            done();
          });
      });

      it('triggers `persist` hook on create', function(done) {
        TestModel.observe('persist', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              observedContexts.should.eql(aTestModelCtx({
                where: { id: 'new-id' },
                data: { id: 'new-id', name: 'a name' },
                currentInstance: {
                  id: 'new-id',
                  name: 'a name',
                  extra: undefined
                }
              }));
            } else {
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: 'new-id',
                  name: 'a name'
                },
                isNewInstance: true,
                currentInstance: {
                  id: 'new-id',
                  name: 'a name',
                  extra: undefined
                }
              }));
            }
            done();
          });
      });

      it('triggers `persist` hook on update', function(done) {
        TestModel.observe('persist', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'updated name' },
          function(err, instance) {
            if (err) return done(err);

            observedContexts.should.eql(aTestModelCtx({
              where: { id: existingInstance.id },
              data: {
                id: existingInstance.id,
                name: 'updated name'
              },
              currentInstance: {
                id: existingInstance.id,
                name: 'updated name',
                extra: undefined
              }
            }));
            done();
          });
      });

      it('triggers `loaded` hook on create', function(done) {
        TestModel.observe('loaded', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              observedContexts.should.eql(aTestModelCtx({
                data: { id: 'new-id', name: 'a name' }
              }));
            } else {
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: 'new-id',
                  name: 'a name'
                },
                isNewInstance: true
              }));
            }
            done();
          });
      });

      it('triggers `loaded` hook on update', function(done) {
        TestModel.observe('loaded', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'updated name' },
          function(err, instance) {
            if (err) return done(err);

            if (dataSource.connector.updateOrCreate) {
              observedContexts.should.eql(aTestModelCtx({
                data: {
                  id: existingInstance.id,
                  name: 'updated name'
                }
              }));
            } else {
              // For Unoptimized connector, the callback function `pushContextAndNext`
              // is called twice. As a result, observedContexts
              // returns an array and NOT a single instance.
              observedContexts.should.eql([
                aTestModelCtx({
                  instance: {
                    id: existingInstance.id,
                    name: 'first',
                    extra: null
                  },
                  isNewInstance: false,
                  options: { notify: false }
                }),
                aTestModelCtx({
                  data: {
                    id: existingInstance.id,
                    name: 'updated name'
                  }
                })
              ]);
            }
            done();
          });
      });

      it('emits error when `loaded` hook fails', function(done) {
        TestModel.observe('loaded', nextWithError(expectedError));
        TestModel.updateOrCreate(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            [err].should.eql([expectedError]);
            done();
          });
      });

      it('triggers `after save` hook on update', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: existingInstance.id, name: 'updated name' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({
              instance: {
                id: existingInstance.id,
                name: 'updated name',
                extra: undefined
              },
              isNewInstance: false
            }));
            done();
          });
      });

      it('triggers `after save` hook on create', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.updateOrCreate(
          { id: 'new-id', name: 'a name' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({
              instance: {
                id: instance.id,
                name: 'a name',
                extra: undefined
              },
              isNewInstance: true
            }));
            done();
          });
      });
    });

    describe('PersistedModel.deleteAll', function() {
      it('triggers `access` hook with query', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.deleteAll({ name: existingInstance.name }, function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
             query: { where: { name: existingInstance.name } }
          }));
          done();
        });
      });

      it('triggers `access` hook without query', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({ query: { where: {} } }));
          done();
        });
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: { neq: existingInstance.id } } };
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
        TestModel.observe('before delete', pushContextAndNext());

        TestModel.deleteAll({ name: existingInstance.name }, function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
             where: { name: existingInstance.name }
          }));
          done();
        });
      });

      it('triggers `before delete` hook without query', function(done) {
        TestModel.observe('before delete', pushContextAndNext());

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({ where: {} }));
          done();
        });
      });

      it('applies updates from `before delete` hook', function(done) {
        TestModel.observe('before delete', function(ctx, next) {
          ctx.where = { id: { neq: existingInstance.id } };
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
        TestModel.observe('after delete', pushContextAndNext());

        TestModel.deleteAll(function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({ where: {} }));
          done();
        });
      });

      it('triggers `after delete` hook without query', function(done) {
        TestModel.observe('after delete', pushContextAndNext());

        TestModel.deleteAll({ name: existingInstance.name }, function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            where: { name: existingInstance.name }
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
        TestModel.observe('access', pushContextAndNext());

        existingInstance.delete(function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
             query: { where: { id: existingInstance.id } }
          }));
          done();
        });
      });

      it('applies updated from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: { neq: existingInstance.id } } };
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
        TestModel.observe('before delete', pushContextAndNext());

        existingInstance.delete(function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
           where: { id: existingInstance.id },
           instance: existingInstance
          }));
          done();
        });
      });

      it('applies updated from `before delete` hook', function(done) {
        TestModel.observe('before delete', function(ctx, next) {
          ctx.where = { id: { neq: existingInstance.id } };
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
              existingInstance.toObject());
            done();
          });
        });
      });

      it('triggers `after delete` hook', function(done) {
        TestModel.observe('after delete', pushContextAndNext());

        existingInstance.delete(function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            where: { id: existingInstance.id },
            instance: existingInstance
          }));
          done();
        });
      });

      it('triggers `after delete` hook without query', function(done) {
        TestModel.observe('after delete', pushContextAndNext());

        TestModel.deleteAll({ name: existingInstance.name }, function(err) {
          if (err) return done(err);
          observedContexts.should.eql(aTestModelCtx({
            where: { name: existingInstance.name }
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
        TestModel.observe('before delete', pushContextAndNext(function(ctx) {
          ctx.hookState.foo = 'bar';
        }));

        TestModel.observe('after delete', pushContextAndNext(function(ctx) {
          ctx.hookState.foo = ctx.hookState.foo.toUpperCase();
        }));

        existingInstance.delete(function(err) {
          if (err) return done(err);
          observedContexts.should.eql([
            aTestModelCtx({
              hookState: { foo: 'bar', test: true },
              where: { id: '1' },
              instance: existingInstance
            }),
            aTestModelCtx({
              hookState: { foo: 'BAR', test: true },
              where: { id: '1' },
              instance: existingInstance
            })
          ]);
          done();
        });
      });

      it('triggers hooks only once', function(done) {
        TestModel.observe('access', pushNameAndNext('access'));
        TestModel.observe('after delete', pushNameAndNext('after delete'));
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: { neq: existingInstance.id } } };
          next();
        });

        existingInstance.delete(function(err) {
          if (err) return done(err);
          observersCalled.should.eql(['access', 'after delete']);
          done();
        });
      });
    });

    describe('PersistedModel.updateAll', function() {
      it('triggers `access` hook', function(done) {
        TestModel.observe('access', pushContextAndNext());

        TestModel.updateAll(
          { name: 'searched' },
          { name: 'updated' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({ query: {
              where: { name: 'searched' }
            }}));
            done();
          });
      });

      it('applies updates from `access` hook', function(done) {
        TestModel.observe('access', function(ctx, next) {
          ctx.query = { where: { id: { neq: existingInstance.id } } };
          next();
        });

        TestModel.updateAll(
          { id: existingInstance.id },
          { name: 'new name' },
          function(err) {
            if (err) return done(err);
            findTestModels({ fields: ['id', 'name' ] }, function(err, list) {
              if (err) return done(err);
              (list||[]).map(toObject).should.eql([
                { id: existingInstance.id, name: existingInstance.name, extra: undefined },
                { id: '2', name: 'new name', extra: undefined }
              ]);
              done();
            });
        });
      });

      it('triggers `before save` hook', function(done) {
        TestModel.observe('before save', pushContextAndNext());

        TestModel.updateAll(
          { name: 'searched' },
          { name: 'updated' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({
              where: { name: 'searched' },
              data: { name: 'updated' },
            }));
            done();
          });
      });

      it('applies updates from `before save` hook', function(done) {
        TestModel.observe('before save', function(ctx, next) {
          ctx.data = { name: 'hooked', extra: 'added' };
          next();
        });

        TestModel.updateAll(
          { id: existingInstance.id },
          { name: 'updated name' },
          function(err) {
            if (err) return done(err);
            loadTestModel(existingInstance.id, function(err, instance) {
              if (err) return done(err);
              instance.should.have.property('name', 'hooked');
              instance.should.have.property('extra', 'added');
              done();
            });
          });
      });

      it('triggers `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext());

        TestModel.updateAll(
          { name: existingInstance.name },
          { name: 'changed' },
          function(err, instance) {
            if (err) return done(err);

            observedContexts.should.eql(aTestModelCtx({
              data: { name: 'changed' },
              where: { name: existingInstance.name }
            }));

            done();
          });
      });

      it('applies updates from `persist` hook', function(done) {
        TestModel.observe('persist', pushContextAndNext(function(ctx){
          ctx.data.extra = 'hook data';
        }));

        TestModel.updateAll(
          { id: existingInstance.id },
          { name: 'changed' },
          function(err) {
            if (err) return done(err);
            loadTestModel(existingInstance.id, function(err, instance) {
              instance.should.have.property('extra', 'hook data');
              done();
            });
          });
      });

      it('does not trigger `loaded`', function(done) {
        TestModel.observe('loaded', pushContextAndNext());

        TestModel.updateAll(
          { id: existingInstance.id },
          { name: 'changed' },
          function(err, instance) {
            if (err) return done(err);
            observedContexts.should.eql("hook not called");
            done();
          });
      });

      it('triggers `after save` hook', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.updateAll(
          { id: existingInstance.id },
          { name: 'updated name' },
          function(err) {
            if (err) return done(err);
            observedContexts.should.eql(aTestModelCtx({
              where: { id: existingInstance.id },
              data: { name: 'updated name' }
            }));
            done();
          });
      });

      it('accepts hookState from options', function(done) {
        TestModel.observe('after save', pushContextAndNext());

        TestModel.updateAll(
          { id: existingInstance.id },
          { name: 'updated name' },
          { foo: 'bar' },
          function(err) {
            if (err) return done(err);
            observedContexts.options.should.eql({
                foo: 'bar'
            });
            done();
          });
      });

    });

    function pushContextAndNext(fn) {
      return function(context, next) {
        if (typeof fn === 'function') {
          fn(context);
        }

        context = deepCloneToObject(context);
        context.hookState.test = true;

        if (typeof observedContexts === 'string') {
          observedContexts = context;
          return next();
        }

        if (!Array.isArray(observedContexts)) {
          observedContexts = [observedContexts];
        }

        observedContexts.push(context);
        next();
      };
    }

    function pushNameAndNext(name) {
      return function(context, next) {
        observersCalled.push(name);
        next();
      };
    }

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

    function aTestModelCtx(ctx) {
      ctx.Model = TestModel;
      if (!ctx.hookState) {
        ctx.hookState = { test: true };
      }
      if (!ctx.options) {
        ctx.options = {};
      }
      return deepCloneToObject(ctx);
    }

    function findTestModels(query, cb) {
      if (cb === undefined && typeof query === 'function') {
        cb = query;
        query = null;
      }

      TestModel.find(query, { notify: false }, cb);
    }

    function loadTestModel(id, cb) {
      TestModel.findOne({ where: { id: id } }, { notify: false }, cb);
    }

    function uid() {
      lastId += 1;
      return '' + lastId;
    }

    function getLastGeneratedUid() {
      return '' + lastId;
    }

    function monitorHookExecution() {
      triggered = [];
      TestModel._notify = TestModel.notifyObserversOf;
      TestModel.notifyObserversOf = function(operation, context, callback) {
        triggered.push(operation);
        this._notify.apply(this, arguments);
      };
    }
  });

  function deepCloneToObject(obj) {
    return traverse(obj).map(function(x) {
      if (x === undefined) {
        // RDBMSs return null
        return null;
      }
      if (x && x.toObject)
        return x.toObject(true);
      if (x && typeof x === 'function' && x.modelName)
        return '[ModelCtor ' + x.modelName + ']';
    });
  }

  function get(propertyName) {
    return function(obj) {
      return obj[propertyName];
    };
  }

  function toObject(obj) {
    return obj.toObject ? obj.toObject() : obj;
  }
};
