// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const ValidationError = require('../..').ValidationError;

const contextTestHelpers = require('../helpers/context-test-helpers');
const ContextRecorder = contextTestHelpers.ContextRecorder;
const aCtxForModel = contextTestHelpers.aCtxForModel;

const uid = require('../helpers/uid-generator');
const HookMonitor = require('../helpers/hook-monitor');

module.exports = function(dataSource, should, connectorCapabilities) {
  describe('EmbedsMany - update', function() {
    let ctxRecorder, hookMonitor, expectedError;
    beforeEach(function setupHelpers() {
      ctxRecorder = new ContextRecorder('hook not called');
      hookMonitor = new HookMonitor({includeModelName: true});
      expectedError = new Error('test error');
    });

    let Owner, Embedded;
    let migrated = false;
    beforeEach(function setupDatabase() {
      Embedded = dataSource.createModel('Embedded', {
        // Set id.generated to false to honor client side values
        id: {type: String, id: true, generated: false, default: uid.next},
        name: {type: String, required: true},
        extra: {type: String, required: false},
      });

      Owner = dataSource.createModel('Owner', {});
      Owner.embedsMany(Embedded);

      hookMonitor.install(Embedded);
      hookMonitor.install(Owner);

      if (migrated) {
        return Owner.deleteAll();
      } else {
        return dataSource.automigrate(Owner.modelName)
          .then(function() { migrated = true; });
      }
    });

    let ownerInstance, existingItem;
    beforeEach(function setupData() {
      return Owner.create({})
        .then(function(inst) {
          ownerInstance = inst;
        })
        .then(function() {
          const item = new Embedded({name: 'created'});
          return ownerInstance.embeddedList.create(item).then(function(it) {
            existingItem = it;
          });
        })
        .then(function() {
          hookMonitor.resetNames();
        });
    });

    function callUpdate() {
      // Unfortunately, updateById was not promisified yet
      return new Promise(function(resolve, reject) {
        ownerInstance.embeddedList.updateById(
          existingItem.id,
          {name: 'updated'},
          function(err, result) {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });
    }

    it('triggers hooks in the correct order', function() {
      return callUpdate().then(function(result) {
        hookMonitor.names.should.eql([
          'Embedded:before save',
          // TODO 'Embedded:persist',
          'Owner:before save',
          'Owner:persist',
          'Owner:loaded',
          'Owner:after save',
          // TODO 'Embedded:loaded',
          'Embedded:after save',
        ]);
      });
    });

    it('trigers `before save` hook on embedded model', function() {
      Embedded.observe('before save', ctxRecorder.recordAndNext());
      return callUpdate().then(function(instance) {
        ctxRecorder.records.should.eql(aCtxForModel(Embedded, {
          currentInstance: {
            id: instance.id,
            name: 'created',
            extra: undefined,
          },
          data: {
            name: 'updated',
          },
          // TODO isNewInstance: true,
        }));
      });
    });

    // TODO
    it('trigers `before save` hook on owner model');

    it('applies updates from `before save` hook', function() {
      Embedded.observe('before save', function(ctx, next) {
        ctx.data.extra = 'hook data';
        next();
      });
      return callUpdate().then(function(instance) {
        instance.should.have.property('extra', 'hook data');
      });
    });

    it('validates model after `before save` hook', function() {
      Embedded.observe('before save', invalidateEmbeddedModel);
      return callUpdate().then(throwShouldHaveFailed, function(err) {
        err.should.be.instanceOf(ValidationError);
        (err.details.codes || {}).should.eql({name: ['presence']});
      });
    });

    it('aborts when `before save` hook fails', function() {
      Embedded.observe('before save', nextWithError(expectedError));
      return callUpdate().then(throwShouldHaveFailed, function(err) {
        err.should.eql(expectedError);
      });
    });

    // TODO
    it('triggers `persist` hook on embedded model');
    it('triggers `persist` hook on owner model');
    it('applies updates from `persist` hook');
    it('aborts when `persist` hook fails');

    // TODO
    it('triggers `loaded` hook on embedded model');
    it('triggers `loaded` hook on owner model');
    it('applies updates from `loaded` hook');
    it('aborts when `loaded` hook fails');

    it('triggers `after save` hook on embedded model', function() {
      Embedded.observe('after save', ctxRecorder.recordAndNext());
      return callUpdate().then(function(instance) {
        ctxRecorder.records.should.eql(aCtxForModel(Embedded, {
          instance: {
            id: instance.id,
            name: 'updated',
            extra: undefined,
          },
          // TODO isNewInstance: true,
        }));
      });
    });

    // TODO
    it('triggers `after save` hook on owner model');

    it('applies updates from `after save` hook', function() {
      Embedded.observe('after save', function(ctx, next) {
        ctx.instance.should.be.instanceOf(Embedded);
        ctx.instance.extra = 'hook data';
        next();
      });
      return callUpdate().then(function(instance) {
        instance.should.have.property('extra', 'hook data');
      });
    });

    it('aborts when `after save` hook fails', function() {
      Embedded.observe('after save', nextWithError(expectedError));
      return callUpdate().then(throwShouldHaveFailed, function(err) {
        err.should.eql(expectedError);
      });
    });

    function invalidateEmbeddedModel(context, next) {
      if (context.instance) {
        context.instance.name = '';
      } else {
        context.data.name = '';
      }
      next();
    }

    function nextWithError(err) {
      return function(context, next) {
        next(err);
      };
    }

    function throwShouldHaveFailed() {
      throw new Error('operation should have failed');
    }
  });
};
