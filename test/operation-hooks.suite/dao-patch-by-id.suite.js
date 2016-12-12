// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var ValidationError = require('../..').ValidationError;
var contextTestHelpers = require('../helpers/context-test-helpers');
var ContextRecorder = contextTestHelpers.ContextRecorder;
var aCtxForModel = contextTestHelpers.aCtxForModel;
var uid = require('../helpers/uid-generator');
var HookMonitor = require('../helpers/hook-monitor');

module.exports = function(dataSource, should, connectorCapabilities) {
  describe('patchById', function() {
    var instanceId, TestModel, hookMonitor, ctxRecorder, expectedError;
    beforeEach(function setupHelpers() {
      ctxRecorder = new ContextRecorder('hook not called');
      hookMonitor = new HookMonitor({ includeModelName: true });
      expectedError = new Error('test error');
    });

    beforeEach(function setupDatabase(done) {
      TestModel = dataSource.createModel('TestModel', {
        // Set id.generated to false to honor client side values
        id: { type: String, id: true, generated: false, default: uid.next },
        name: { type: String, required: true },
        extra: { type: String, required: false },
      });
      done();
    });

    beforeEach(function setupData(done) {
      TestModel.create({ name: 'John', extra: 'extra info' }, function(err, instance) {
        if (err) return done(err);
        instanceId = instance.id;
        hookMonitor.install(TestModel);
        done();
      });
    });

    it('triggers hooks in the correct order', function(done) {
      TestModel.patchById(instanceId,
        { name: 'changed' },
        function(err, info) {
          if (err) return done(err);
          hookMonitor.names.should.eql([
            'TestModel:before save',
            'TestModel:persist',
            'TestModel:loaded',
            'TestModel:after save',
          ]);
          done();
        });
    });

    it('triggers `before save` hook', function(done) {
      TestModel.observe('before save', ctxRecorder.recordAndNext());

      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);
        ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
          where: { id: instanceId },
          data: { name: 'changed' },
        }));
        done();
      });
    });

    it('aborts when `before save` hook fails', function(done) {
      TestModel.observe('before save', nextWithError(expectedError));

      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
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

      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);
        TestModel.findById(instanceId, function(err, instance) {
          if (err) return done(err);
          should.exists(instance);

          instance.toObject(true).should.eql({
            id: instanceId,
            name: 'hooked name',
            extra: 'extra data',
          });

          done();
        });
      });
    });

    it('validates model after `before save` hook', function(done) {
      TestModel.observe('before save', invalidateData);

      TestModel.patchById(instanceId, { name: 'updated' }, function(err) {
        err.should.be.instanceOf(ValidationError);
        (err.details.codes || {}).should.eql({ name: ['presence'] });
        done();
      });
    });

    it('triggers `persist` hook', function(done) {
      TestModel.observe('persist', ctxRecorder.recordAndNext());
      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);

        ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
          where: { id: instanceId },
          data: { name: 'changed' },
          isNewInstance: false,
        }));

        done();
      });
    });

    it('applies updates from `persist` hook', function(done) {
      TestModel.observe('persist', ctxRecorder.recordAndNext(function(ctx) {
        ctx.data.extra = 'hook data';
      }));

      TestModel.settings.updateOnLoad = true;
      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);
        TestModel.findById(instanceId, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });
    });

    it('triggers `loaded` hook', function(done) {
      TestModel.observe('loaded', ctxRecorder.recordAndNext());
      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);

        ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
          data: { name: 'changed' },
        }));

        done();
      });
    });

    it('emits error when `loaded` hook fails', function(done) {
      TestModel.observe('loaded', nextWithError(expectedError));
      TestModel.patchById(
        instanceId,
        { name: 'changed' },
        function(err, info) {
          [err].should.eql([expectedError]);
          done();
        }
      );
    });

    it('applies updates from `loaded` hook', function(done) {
      TestModel.observe('loaded', ctxRecorder.recordAndNext(function(ctx) {
        ctx.data.extra = 'hook data';
      }));

      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);
        TestModel.findById(instanceId, function(err, instance) {
          if (err) return done(err);
          instance.should.have.property('extra', 'hook data');
          done();
        });
      });
    });

    it('triggers `after save` hook', function(done) {
      TestModel.observe('after save', ctxRecorder.recordAndNext());

      TestModel.patchById(instanceId, { name: 'changed' }, function(err, info) {
        if (err) return done(err);
        ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
          isNewInstance: false,
        }));
        done();
      });
    });

    it('aborts when `after save` hook fails', function(done) {
      TestModel.observe('after save', nextWithError(expectedError));

      TestModel.patchById(instanceId, { name: 'updated' }, function(err, info) {
        [err].should.eql([expectedError]);
        done();
      });
    });

    it('applies updates from `after save` hook', function(done) {
      TestModel.observe('after save', ctxRecorder.recordAndNext());

      TestModel.patchById(instanceId, { name: 'updated' }, function(err, info) {
        if (err) return done(err);
        ctxRecorder.records.should.eql(aCtxForModel(TestModel, {
          isNewInstance: false,
        }));
        done();
      });
    });

    function nextWithError(err) {
      return function(context, next) {
        next(err);
      };
    }

    function invalidateData(context, next) {
      delete context.data.name;
      next();
    }
  });
};
