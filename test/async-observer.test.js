// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

var ModelBuilder = require('../').ModelBuilder;
var should = require('./init');
var Promise = require('bluebird');

describe('async observer', function() {
  var TestModel;
  beforeEach(function defineTestModel() {
    var modelBuilder = new ModelBuilder();
    TestModel = modelBuilder.define('TestModel', {name: String});
  });

  it('calls registered async observers', function(done) {
    var notifications = [];
    TestModel.observe('before', pushAndNext(notifications, 'before'));
    TestModel.observe('after', pushAndNext(notifications, 'after'));

    TestModel.notifyObserversOf('before', {}, function(err) {
      if (err) return done(err);
      notifications.push('call');
      TestModel.notifyObserversOf('after', {}, function(err) {
        if (err) return done(err);

        notifications.should.eql(['before', 'call', 'after']);
        done();
      });
    });
  });

  it('allows multiple observers for the same operation', function(done) {
    var notifications = [];
    TestModel.observe('event', pushAndNext(notifications, 'one'));
    TestModel.observe('event', pushAndNext(notifications, 'two'));

    TestModel.notifyObserversOf('event', {}, function(err) {
      if (err) return done(err);
      notifications.should.eql(['one', 'two']);
      done();
    });
  });

  it('allows multiple operations to be notified in one call', function(done) {
    var notifications = [];
    TestModel.observe('event1', pushAndNext(notifications, 'one'));
    TestModel.observe('event2', pushAndNext(notifications, 'two'));

    TestModel.notifyObserversOf(['event1', 'event2'], {}, function(err) {
      if (err) return done(err);
      notifications.should.eql(['one', 'two']);
      done();
    });
  });

  it('inherits observers from base model', function(done) {
    var notifications = [];
    TestModel.observe('event', pushAndNext(notifications, 'base'));

    var Child = TestModel.extend('Child');
    Child.observe('event', pushAndNext(notifications, 'child'));

    Child.notifyObserversOf('event', {}, function(err) {
      if (err) return done(err);
      notifications.should.eql(['base', 'child']);
      done();
    });
  });

  it('allow multiple operations to be notified with base models', function(done) {
    var notifications = [];
    TestModel.observe('event1', pushAndNext(notifications, 'base1'));
    TestModel.observe('event2', pushAndNext(notifications, 'base2'));

    var Child = TestModel.extend('Child');
    Child.observe('event1', pushAndNext(notifications, 'child1'));
    Child.observe('event2', pushAndNext(notifications, 'child2'));

    Child.notifyObserversOf(['event1', 'event2'], {}, function(err) {
      if (err) return done(err);
      notifications.should.eql(['base1', 'child1', 'base2', 'child2']);
      done();
    });
  });

  it('does not modify observers in the base model', function(done) {
    var notifications = [];
    TestModel.observe('event', pushAndNext(notifications, 'base'));

    var Child = TestModel.extend('Child');
    Child.observe('event', pushAndNext(notifications, 'child'));

    TestModel.notifyObserversOf('event', {}, function(err) {
      if (err) return done(err);
      notifications.should.eql(['base']);
      done();
    });
  });

  it('always calls inherited observers', function(done) {
    var notifications = [];
    TestModel.observe('event', pushAndNext(notifications, 'base'));

    var Child = TestModel.extend('Child');
    // Important: there are no observers on the Child model

    Child.notifyObserversOf('event', {}, function(err) {
      if (err) return done(err);
      notifications.should.eql(['base']);
      done();
    });
  });

  it('can remove observers', function(done) {
    var notifications = [];

    function call(ctx, next) {
      notifications.push('call');
      process.nextTick(next);
    };

    TestModel.observe('event', call);
    TestModel.removeObserver('event', call);

    TestModel.notifyObserversOf('event', {}, function(err) {
      if (err) return done(err);
      notifications.should.eql([]);
      done();
    });
  });

  it('can clear all observers', function(done) {
    var notifications = [];

    function call(ctx, next) {
      notifications.push('call');
      process.nextTick(next);
    };

    TestModel.observe('event', call);
    TestModel.observe('event', call);
    TestModel.observe('event', call);
    TestModel.clearObservers('event');

    TestModel.notifyObserversOf('event', {}, function(err) {
      if (err) return done(err);
      notifications.should.eql([]);
      done();
    });
  });

  it('handles no observers', function(done) {
    TestModel.notifyObserversOf('no-observers', {}, function(err) {
      // the test passes when no error was raised
      done(err);
    });
  });

  it('passes context to final callback', function(done) {
    var context = {};
    TestModel.notifyObserversOf('event', context, function(err, ctx) {
      (ctx || 'null').should.equal(context);
      done();
    });
  });

  describe('notifyObserversAround', function() {
    var notifications;
    beforeEach(function() {
      notifications = [];
      TestModel.observe('before execute',
        pushAndNext(notifications, 'before execute'));
      TestModel.observe('after execute',
        pushAndNext(notifications, 'after execute'));
    });

    it('should notify before/after observers', function(done) {
      var context = {};

      function work(done) {
        process.nextTick(function() {
          done(null, 1);
        });
      }

      TestModel.notifyObserversAround('execute', context, work,
        function(err, result) {
          notifications.should.eql(['before execute', 'after execute']);
          result.should.eql(1);
          done();
        });
    });

    it('should allow work with context', function(done) {
      var context = {};

      function work(context, done) {
        process.nextTick(function() {
          done(null, 1);
        });
      }

      TestModel.notifyObserversAround('execute', context, work,
        function(err, result) {
          notifications.should.eql(['before execute', 'after execute']);
          result.should.eql(1);
          done();
        });
    });

    it('should notify before/after observers with multiple results',
      function(done) {
        var context = {};

        function work(done) {
          process.nextTick(function() {
            done(null, 1, 2);
          });
        }

        TestModel.notifyObserversAround('execute', context, work,
          function(err, r1, r2) {
            r1.should.eql(1);
            r2.should.eql(2);
            notifications.should.eql(['before execute', 'after execute']);
            done();
          });
      });

    it('should allow observers to skip other ones',
      function(done) {
        TestModel.observe('before invoke',
          function(context, next) {
            notifications.push('before invoke');
            context.end(null, 0);
          });
        TestModel.observe('after invoke',
          pushAndNext(notifications, 'after invoke'));

        var context = {};

        function work(done) {
          process.nextTick(function() {
            done(null, 1, 2);
          });
        }

        TestModel.notifyObserversAround('invoke', context, work,
          function(err, r1) {
            r1.should.eql(0);
            notifications.should.eql(['before invoke']);
            done();
          });
      });

    it('should allow observers to tweak results',
      function(done) {
        TestModel.observe('after invoke',
          function(context, next) {
            notifications.push('after invoke');
            context.results = [3];
            next();
          });

        var context = {};

        function work(done) {
          process.nextTick(function() {
            done(null, 1, 2);
          });
        }

        TestModel.notifyObserversAround('invoke', context, work,
          function(err, r1) {
            r1.should.eql(3);
            notifications.should.eql(['after invoke']);
            done();
          });
      });
  });

  it('resolves promises returned by observers', function(done) {
    TestModel.observe('event', function(ctx) {
      return Promise.resolve('value-to-ignore');
    });
    TestModel.notifyObserversOf('event', {}, function(err, ctx) {
      // the test times out when the promises are not supported
      done();
    });
  });

  it('handles rejected promise returned by an observer', function(done) {
    var testError = new Error('expected test error');
    TestModel.observe('event', function(ctx) {
      return Promise.reject(testError);
    });
    TestModel.notifyObserversOf('event', {}, function(err, ctx) {
      err.should.eql(testError);
      done();
    });
  });

  it('returns a promise when no callback is provided', function() {
    var context = {value: 'a-test-context'};
    var p = TestModel.notifyObserversOf('event', context);
    (p !== undefined).should.be.true;
    return p.then(function(result) {
      result.should.eql(context);
    });
  });

  it('returns a rejected promise when no callback is provided', function() {
    var testError = new Error('expected test error');
    TestModel.observe('event', function(ctx, next) { next(testError); });
    var p = TestModel.notifyObserversOf('event', context);
    return p.then(
      function(result) {
        throw new Error('The promise should have been rejected.');
      },
      function(err) {
        err.should.eql(testError);
      }
    );
  });
});

function pushAndNext(array, value) {
  return function(ctx, next) {
    array.push(value);
    process.nextTick(next);
  };
}
