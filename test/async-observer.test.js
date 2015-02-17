var ModelBuilder = require('../').ModelBuilder;
var should = require('./init');

describe('async observer', function() {
  var TestModel;
  beforeEach(function defineTestModel() {
    var modelBuilder = new ModelBuilder();
    TestModel = modelBuilder.define('TestModel', { name: String });
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

  it('handles no observers', function(done) {
    TestModel.notifyObserversOf('no-observers', {}, function(err) {
      // the test passes when no error was raised
      done(err);
    });
  });

  it('passes context to final callback', function(done) {
    var context = {};
    TestModel.notifyObserversOf('event', context, function(err, ctx) {
      (ctx || "null").should.equal(context);
      done();
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
    var context = { value: 'a-test-context' };
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
      });
  });
});

function pushAndNext(array, value) {
  return function(ctx, next) {
    array.push(value);
    process.nextTick(next);
  };
}
