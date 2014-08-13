// This test written in mocha+should.js
var should = require('./init.js');

var db, Railway, Station;

describe('scope', function () {

  before(function () {
    db = getSchema();
    Railway = db.define('Railway', {
      URID: {type: String, index: true}
    }, {
      scopes: {
        highSpeed: {
          where: {
            highSpeed: true
          }
        }
      }
    });
    Station = db.define('Station', {
      USID: {type: String, index: true},
      capacity: {type: Number, index: true},
      thoughput: {type: Number, index: true},
      isActive: {type: Boolean, index: true},
      isUndeground: {type: Boolean, index: true}
    });
  });

  beforeEach(function (done) {
    Railway.destroyAll(function () {
      Station.destroyAll(done);
    });
  });
  
  it('should define scope using options.scopes', function () {
    Railway.scopes.should.have.property('highSpeed');
    Railway.highSpeed.should.be.function;
  });

  it('should define scope with query', function (done) {
    Station.scope('active', {where: {isActive: true}});
    Station.scopes.should.have.property('active');
    Station.active.create(function (err, station) {
      should.not.exist(err);
      should.exist(station);
      should.exist(station.isActive);
      station.isActive.should.be.true;
      done();
    });
  });

  it('should allow scope chaining', function (done) {
    Station.scope('active', {where: {isActive: true}});
    Station.scope('subway', {where: {isUndeground: true}});
    Station.active.subway.create(function (err, station) {
      should.not.exist(err);
      should.exist(station);
      station.isActive.should.be.true;
      station.isUndeground.should.be.true;
      done();
    })
  });

  it('should query all', function (done) {
    Station.scope('active', {where: {isActive: true}});
    Station.scope('inactive', {where: {isActive: false}});
    Station.scope('ground', {where: {isUndeground: true}});
    Station.active.ground.create(function () {
      Station.inactive.ground.create(function () {
        Station.ground.inactive(function (err, ss) {
          ss.should.have.lengthOf(1);
          done();
        });
      });
    });
  });
});

describe('scope - order', function () {

  before(function () {
    db = getSchema();
    Station = db.define('Station', {
      name: {type: String, index: true},
      order: {type: Number, index: true}
    });
    Station.scope('reverse', {order: 'order DESC'});
  });

  beforeEach(function (done) {
    Station.destroyAll(done);
  });
  
  beforeEach(function (done) {
    Station.create({ name: 'a', order: 1 }, done);
  });
  
  beforeEach(function (done) {
    Station.create({ name: 'b', order: 2 }, done);
  });
    
  beforeEach(function (done) {
    Station.create({ name: 'c', order: 3 }, done);
  });
  
  it('should define scope with default order', function (done) {
    Station.reverse(function(err, stations) {
      stations[0].name.should.equal('c');
      stations[0].order.should.equal(3);
      stations[1].name.should.equal('b');
      stations[1].order.should.equal(2);
      stations[2].name.should.equal('a');
      stations[2].order.should.equal(1);
      done();
    });
  });
  
  it('should override default scope order', function (done) {
    Station.reverse({order: 'order ASC'}, function(err, stations) {
      stations[0].name.should.equal('a');
      stations[0].order.should.equal(1);
      stations[1].name.should.equal('b');
      stations[1].order.should.equal(2);
      stations[2].name.should.equal('c');
      stations[2].order.should.equal(3);
      done();
    });
  });
  
});

