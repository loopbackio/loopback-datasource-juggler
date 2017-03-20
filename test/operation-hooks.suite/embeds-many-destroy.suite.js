// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var Promise = require('bluebird');
var ValidationError = require('../..').ValidationError;

var contextTestHelpers = require('../helpers/context-test-helpers');
var ContextRecorder = contextTestHelpers.ContextRecorder;
var aCtxForModel = contextTestHelpers.aCtxForModel;

var uid = require('../helpers/uid-generator');
var HookMonitor = require('../helpers/hook-monitor');

module.exports = function(dataSource, should, connectorCapabilities) {
  describe('EmbedsMany - destroy', function() {
    var ctxRecorder, hookMonitor, expectedError;
    beforeEach(function sharedSetup() {
      ctxRecorder = new ContextRecorder('hook not called');
      hookMonitor = new HookMonitor({includeModelName: true});
      expectedError = new Error('test error');
    });

    var Owner, Embedded;
    var migrated = false;
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

    var ownerInstance, existingInstance, existingItem;
    beforeEach(function setupData() {
      return Owner.create({})
        .then(function(inst) {
          ownerInstance = inst;
        })
        .then(function() {
          var item = new Embedded({name: 'created'});
          return ownerInstance.embeddedList.create(item).then(function(it) {
            existingItem = it;
          });
        })
        .then(function() {
          hookMonitor.resetNames();
        });
    });

    function callDestroy() {
      // Unfortunately, updateById was not promisified yet
      return new Promise(function(resolve, reject) {
        return ownerInstance.embeddedList.destroy(
          existingItem.id,
          function(err, result) {
            if (err) reject(err);
            else resolve(result);
          });
      });
    }

    it('triggers hooks in the correct order', function() {
      return callDestroy().then(function(result) {
        hookMonitor.names.should.eql([
          'Embedded:before delete',
          'Owner:before save',
          'Owner:persist',
          'Owner:loaded',
          'Owner:after save',
          'Embedded:after delete',
        ]);
      });
    });

    it('trigers `before delete` hook', function() {
      Embedded.observe('before delete', ctxRecorder.recordAndNext());
      return callDestroy().then(function() {
        ctxRecorder.records.should.eql(aCtxForModel(Embedded, {
          instance: {
            id: existingItem.id,
            name: 'created',
            extra: undefined,
          },
        }));
      });
    });

    // TODO
    // In order to allow "before delete" hook to make changes,
    // we need to enhance the context to include information
    // about the model instance being deleted.
    // "ctx.where: { id: embedded.id }" may not be enough,
    // as it does not identify the parent (owner) model
    it('applies updates from `before delete` hook');

    it('aborts when `before delete` hook fails', function() {
      Embedded.observe('before delete', nextWithError(expectedError));
      return callDestroy().then(throwShouldHaveFailed, function(err) {
        err.should.eql(expectedError);
      });
    });

    it('trigers `after delete` hook', function() {
      Embedded.observe('after delete', ctxRecorder.recordAndNext());
      return callDestroy().then(function() {
        ctxRecorder.records.should.eql(aCtxForModel(Embedded, {
          instance: {
            id: existingItem.id,
            name: 'created',
            extra: undefined,
          },
        }));
      });
    });

    it('aborts when `after delete` hook fails', function() {
      Embedded.observe('after delete', nextWithError(expectedError));
      return callDestroy().then(throwShouldHaveFailed, function(err) {
        err.should.eql(expectedError);
      });
    });

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
