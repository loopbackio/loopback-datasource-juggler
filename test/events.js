var should = require('./init.js');

describe('events', function() {
  beforeEach(function(done) {
    var test = this;
    this.db = getSchema();
    this.TestModel = this.db.define('TestModel');
    this.db.automigrate(function(err) {
      if(err) return done(err);
      test.TestModel.create(function(err, inst) {
        if(err) return done(err);
        test.inst = inst;
        done();
      });
    });
    this.shouldEmitEvent = function(eventName, listener, done) {
      var timeout = setTimeout(function() {
        done(new Error('did not emit ' + eventName));
      }, 100);
      this.TestModel.on(eventName, function() {
        clearTimeout(timeout);
        listener.apply(this, arguments);
        done();
      });
    }
  });
  
  describe('changed', function() {
    it('should be emitted after save', function(done) {
      var model = new this.TestModel({name: 'foobar'});
      this.shouldEmitEvent('changed', assertValidChangedArgs, done);
      model.save();
    });
    it('should be emitted after upsert', function(done) {
      this.shouldEmitEvent('changed', assertValidChangedArgs, done);
      this.TestModel.upsert({name: 'batbaz'});
    });
    it('should be emitted after create', function(done) {
      this.shouldEmitEvent('changed', assertValidChangedArgs, done);
      this.TestModel.create({name: '...'});
    });
    it('should be emitted after updateAttributes', function(done) {
      var test = this;
      this.TestModel.create({name: 'bazzy'}, function(err, model) {
        // prevent getting the changed event from "create"
        process.nextTick(function() {
          test.shouldEmitEvent('changed', assertValidChangedArgs, done);
          model.updateAttributes({name: 'foo'});
        });
      });
    });
  });
  
  describe('deleted', function() {
    it('should be emitted after destroy', function(done) {
      this.shouldEmitEvent('deleted', assertValidDeletedArgs, done);
      this.inst.destroy();
    });
    it('should be emitted after deleteById', function(done) {
      this.shouldEmitEvent('deleted', assertValidDeletedArgs, done);
      this.TestModel.deleteById(this.inst.id);
    });
  });
  
  describe('deletedAll', function() {
    it('should be emitted after destroyAll', function(done) {
      this.shouldEmitEvent('deletedAll', function(where) {
        where.name.should.equal('foo');
      }, done);
      this.TestModel.destroyAll({name: 'foo'});
    });
  });
});

function assertValidChangedArgs(obj) {
  obj.should.have.property('id');
}

function assertValidDeletedArgs(id) {
  id.should.be.ok;
}