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
});

function pushAndNext(array, value) {
  return function(ctx, next) {
    array.push(value);
    process.nextTick(next);
  };
}
