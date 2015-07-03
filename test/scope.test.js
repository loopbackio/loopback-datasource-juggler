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
  
  it('should not cache any results', function (done) {
    Station.scope('active', {where: {isActive: true}});
    Station.active.create(function (err, s) {
      if (err) return done(err);
      s.isActive.should.be.true;
      Station.active(function(err, ss) {
        if (err) return done(err);
        ss.should.have.lengthOf(1);
        ss[0].id.should.eql(s.id);
        s.updateAttribute('isActive', false, function(err, s) {
          if (err) return done(err);
          s.isActive.should.be.false;
          Station.active(function(err, ss) {
            if (err) return done(err);
            ss.should.have.lengthOf(0);
            done();
          });
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

describe('scope - filtered count, updateAll and destroyAll', function () {

  var stationA;

  before(function () {
    db = getSchema();
    Station = db.define('Station', {
      name: {type: String, index: true},
      order: {type: Number, index: true},
      active: {type: Boolean, index: true, default: true},
      flagged: {type: Boolean, index: true, default: false}
    });
    Station.scope('ordered', {order: 'order'});
    Station.scope('active', {where: { active: true}});
    Station.scope('inactive', {where: { active: false}});
    Station.scope('flagged', {where: { flagged: true}});
  });

  beforeEach(function (done) {
    Station.destroyAll(done);
  });

  beforeEach(function (done) {
    Station.create({ name: 'b', order: 2, active: false }, done);
  });

  beforeEach(function (done) {
    Station.create({ name: 'a', order: 1 }, function(err, inst) {
      stationA = inst;
      done();
    });
  });

  beforeEach(function (done) {
    Station.create({ name: 'd', order: 4, active: false }, done);
  });

  beforeEach(function (done) {
    Station.create({ name: 'c', order: 3 }, done);
  });

  it('should find all - verify', function(done) {
    Station.ordered(function(err, stations) {
        should.not.exist(err);
        stations.should.have.length(4);
        stations[0].name.should.equal('a');
        stations[1].name.should.equal('b');
        stations[2].name.should.equal('c');
        stations[3].name.should.equal('d');
        done();
    });
  });

  it('should find one', function(done) {
    Station.active.findOne(function(err, station) {
        should.not.exist(err);
        station.name.should.equal('a');
        done();
    });
  });

  it('should find one - with filter', function(done) {
    Station.active.findOne({ where: { name: 'c' } }, function(err, station) {
        should.not.exist(err);
        station.name.should.equal('c');
        done();
    });
  });

  it('should find by id - match', function(done) {
    Station.active.findById(stationA.id, function(err, station) {
        should.not.exist(err);
        station.name.should.equal('a');
        done();
    });
  });

  it('should find by id - no match', function(done) {
    Station.inactive.findById(stationA.id, function(err, station) {
        should.not.exist(err);
        should.not.exist(station);
        done();
    });
  });

  it('should count all in scope - active', function(done) {
    Station.active.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(2);
        done();
    });
  });

  it('should count all in scope - inactive', function(done) {
    Station.inactive.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(2);
        done();
    });
  });

  it('should count filtered - active', function(done) {
    Station.active.count({ order: { gt: 1 } }, function(err, count) {
        should.not.exist(err);
        count.should.equal(1);
        done();
    });
  });

  it('should count filtered - inactive', function(done) {
    Station.inactive.count({ order: 2 }, function(err, count) {
        should.not.exist(err);
        count.should.equal(1);
        done();
    });
  });

  it('should allow updateAll', function(done) {
    Station.inactive.updateAll({ flagged: true }, function(err, result) {
        should.not.exist(err);
        result.count.should.equal(2);
        verify();
    });

    var verify = function() {
      Station.flagged.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(2);
        done();
      });
    };
  });

  it('should allow filtered updateAll', function(done) {
    Station.ordered.updateAll({ active: true }, { flagged: true }, function(err, result) {
        should.not.exist(err);
        result.count.should.equal(2);
        verify();
    });

    var verify = function() {
      Station.flagged.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(2);
        done();
      });
    };
  });

  it('should allow filtered destroyAll', function(done) {
    Station.ordered.destroyAll({ active: false }, function(err) {
        should.not.exist(err);
        verify();
    });

    var verify = function() {
      Station.ordered.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(2);
        Station.inactive.count(function(err, count) {
            should.not.exist(err);
            count.should.equal(0);
            done();
        });
      });
    };
  });

});

describe('scope - dynamic target class', function () {

  var Collection, Media, Image, Video;


  before(function () {
    db = getSchema();
    Image = db.define('Image', {name: String});
    Video = db.define('Video', {name: String});

    Collection = db.define('Collection', {name: String, modelName: String});
    Collection.scope('items', function() {
      return {}; // could return a scope based on `this` (receiver)
    }, null, {}, { isStatic: false, modelTo: function(receiver) {
      return db.models[receiver.modelName];
    } });
  });

  beforeEach(function (done) {
    Collection.destroyAll(function() {
      Image.destroyAll(function() {
        Video.destroyAll(done);
      })
    });
  });

  beforeEach(function (done) {
    Collection.create({ name: 'Images', modelName: 'Image' }, done);
  });

  beforeEach(function (done) {
    Collection.create({ name: 'Videos', modelName: 'Video' }, done);
  });

  beforeEach(function (done) {
    Collection.create({ name: 'Things', modelName: 'Unknown' }, done);
  });

  beforeEach(function (done) {
    Image.create({ name: 'Image A' }, done);
  });

  beforeEach(function (done) {
    Video.create({ name: 'Video A' }, done);
  });

  it('should deduce modelTo at runtime - Image', function(done) {
    Collection.findOne({ where: { modelName: 'Image' } }, function(err, coll) {
      should.not.exist(err);
      coll.name.should.equal('Images');
      coll.items(function(err, items) {
        should.not.exist(err);
        items.length.should.equal(1);
        items[0].name.should.equal('Image A');
        items[0].should.be.instanceof(Image);
        done();
      });
    });
  });

  it('should deduce modelTo at runtime - Video', function(done) {
    Collection.findOne({ where: { modelName: 'Video' } }, function(err, coll) {
      should.not.exist(err);
      coll.name.should.equal('Videos');
      coll.items(function(err, items) {
        should.not.exist(err);
        items.length.should.equal(1);
        items[0].name.should.equal('Video A');
        items[0].should.be.instanceof(Video);
        done();
      });
    });
  });

  it('should throw if modelTo is invalid', function(done) {
    Collection.findOne({ where: { name: 'Things' } }, function(err, coll) {
      should.not.exist(err);
      coll.modelName.should.equal('Unknown');
      (function () {
        coll.items(function(err, items) {});
      }).should.throw();
      done();
    });
  });

});

describe('scope - dynamic function', function () {

  var Item,seed=0;

  before(function () {
    db = getSchema();
    Item = db.define('Item', {title: Number,creator:Number});
    Item.scope('dynamicQuery', function () {
      seed++;
      return {where:{creator:seed}};
    })
  });

  beforeEach(function (done) {
    Item.create({ title:1,creator:1 }, function () {
      Item.create({ title:2,creator:2 },done)
    })
  });

  it('should deduce item by runtime creator', function (done) {
    Item.dynamicQuery.findOne(function (err,firstQuery) {
      should.not.exist(err);
      firstQuery.title.should.equal(1);
      Item.dynamicQuery.findOne(function (err,secondQuery) {
        should.not.exist(err);
        secondQuery.title.should.equal(2);
        done();
      })
    })
  })
});
