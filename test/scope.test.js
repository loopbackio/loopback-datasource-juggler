// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false */
const should = require('./init.js');

let db, Railway, Station;

describe('scope', function() {
  before(function() {
    db = getSchema();
    Railway = db.define('Railway', {
      URID: {type: String, index: true},
    }, {
      scopes: {
        highSpeed: {
          where: {
            highSpeed: true,
          },
        },
      },
    });
    Station = db.define('Station', {
      USID: {type: String, index: true},
      capacity: {type: Number, index: true},
      thoughput: {type: Number, index: true},
      isActive: {type: Boolean, index: true},
      isUndeground: {type: Boolean, index: true},
    });
  });

  beforeEach(function(done) {
    Railway.destroyAll(function() {
      Station.destroyAll(done);
    });
  });

  it('should define scope using options.scopes', function() {
    Railway.scopes.should.have.property('highSpeed');
    Railway.highSpeed.should.be.function;
  });

  it('should define scope with query', function(done) {
    Station.scope('active', {where: {isActive: true}});
    Station.scopes.should.have.property('active');
    Station.active.create(function(err, station) {
      if (err) return done(err);
      should.exist(station);
      should.exist(station.isActive);
      station.isActive.should.be.true;
      done();
    });
  });

  it('should allow scope chaining', function(done) {
    Station.scope('active', {where: {isActive: true}});
    Station.scope('subway', {where: {isUndeground: true}});
    Station.active.subway.create(function(err, station) {
      if (err) return done(err);
      should.exist(station);
      station.isActive.should.be.true;
      station.isUndeground.should.be.true;
      done();
    });
  });

  it('should query all', function(done) {
    Station.scope('active', {where: {isActive: true}});
    Station.scope('inactive', {where: {isActive: false}});
    Station.scope('ground', {where: {isUndeground: true}});
    Station.active.ground.create(function() {
      Station.inactive.ground.create(function() {
        Station.ground.inactive(function(err, ss) {
          if (err) return done(err);
          ss.should.have.lengthOf(1);
          done();
        });
      });
    });
  });

  it('should not cache any results', function(done) {
    Station.scope('active', {where: {isActive: true}});
    Station.active.create(function(err, s) {
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

describe('scope - order', function() {
  before(function() {
    db = getSchema();
    Station = db.define('Station', {
      name: {type: String, index: true},
      order: {type: Number, index: true},
    });
    Station.scope('reverse', {order: 'order DESC'});
  });

  beforeEach(function(done) {
    Station.destroyAll(done);
  });

  beforeEach(function(done) {
    Station.create({name: 'a', order: 1}, done);
  });

  beforeEach(function(done) {
    Station.create({name: 'b', order: 2}, done);
  });

  beforeEach(function(done) {
    Station.create({name: 'c', order: 3}, done);
  });

  it('should define scope with default order', function(done) {
    Station.reverse(function(err, stations) {
      if (err) return done(err);
      stations[0].name.should.equal('c');
      stations[0].order.should.equal(3);
      stations[1].name.should.equal('b');
      stations[1].order.should.equal(2);
      stations[2].name.should.equal('a');
      stations[2].order.should.equal(1);
      done();
    });
  });

  it('should override default scope order', function(done) {
    Station.reverse({order: 'order ASC'}, function(err, stations) {
      if (err) return done(err);
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

describe('scope - filtered count, updateAll and destroyAll', function() {
  let stationA;

  before(function() {
    db = getSchema();
    Station = db.define('Station', {
      name: {type: String, index: true},
      order: {type: Number, index: true},
      active: {type: Boolean, index: true, default: true},
      flagged: {type: Boolean, index: true, default: false},
    });
    Station.scope('ordered', {order: 'order'});
    Station.scope('active', {where: {active: true}});
    Station.scope('inactive', {where: {active: false}});
    Station.scope('flagged', {where: {flagged: true}});
  });

  beforeEach(function(done) {
    Station.destroyAll(done);
  });

  beforeEach(function(done) {
    Station.create({name: 'b', order: 2, active: false}, done);
  });

  beforeEach(function(done) {
    Station.create({name: 'a', order: 1}, function(err, inst) {
      if (err) return done(err);
      stationA = inst;
      done();
    });
  });

  beforeEach(function(done) {
    Station.create({name: 'd', order: 4, active: false}, done);
  });

  beforeEach(function(done) {
    Station.create({name: 'c', order: 3}, done);
  });

  it('should find all - verify', function(done) {
    Station.ordered(function(err, stations) {
      if (err) return done(err);
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
      if (err) return done(err);
      station.name.should.equal('a');
      done();
    });
  });

  it('should find one - with filter', function(done) {
    Station.active.findOne({where: {name: 'c'}}, function(err, station) {
      if (err) return done(err);
      station.name.should.equal('c');
      done();
    });
  });

  it('should find by id - match', function(done) {
    Station.active.findById(stationA.id, function(err, station) {
      if (err) return done(err);
      station.name.should.equal('a');
      done();
    });
  });

  it('should find by id - no match', function(done) {
    Station.inactive.findById(stationA.id, function(err, station) {
      if (err) return done(err);
      should.not.exist(station);
      done();
    });
  });

  it('should count all in scope - active', function(done) {
    Station.active.count(function(err, count) {
      if (err) return done(err);
      count.should.equal(2);
      done();
    });
  });

  it('should count all in scope - inactive', function(done) {
    Station.inactive.count(function(err, count) {
      if (err) return done(err);
      count.should.equal(2);
      done();
    });
  });

  it('should count filtered - active', function(done) {
    Station.active.count({order: {gt: 1}}, function(err, count) {
      if (err) return done(err);
      count.should.equal(1);
      done();
    });
  });

  it('should count filtered - inactive', function(done) {
    Station.inactive.count({order: 2}, function(err, count) {
      if (err) return done(err);
      count.should.equal(1);
      done();
    });
  });

  it('should allow updateAll', function(done) {
    Station.inactive.updateAll({flagged: true}, function(err, result) {
      if (err) return done(err);
      result.count.should.equal(2);
      verify();
    });

    function verify() {
      Station.flagged.count(function(err, count) {
        if (err) return done(err);
        count.should.equal(2);
        done();
      });
    }
  });

  it('should allow filtered updateAll', function(done) {
    Station.ordered.updateAll({active: true}, {flagged: true}, function(err, result) {
      if (err) return done(err);
      result.count.should.equal(2);
      verify();
    });

    function verify() {
      Station.flagged.count(function(err, count) {
        if (err) return done(err);
        count.should.equal(2);
        done();
      });
    }
  });

  it('should allow filtered destroyAll', function(done) {
    Station.ordered.destroyAll({active: false}, function(err) {
      if (err) return done(err);
      verify();
    });

    function verify() {
      Station.ordered.count(function(err, count) {
        if (err) return done(err);
        count.should.equal(2);
        Station.inactive.count(function(err, count) {
          if (err) return done(err);
          count.should.equal(0);
          done();
        });
      });
    }
  });
});

describe('scope - dynamic target class', function() {
  let Collection, Image, Video;

  before(function() {
    db = getSchema();
    Image = db.define('Image', {name: String});
    Video = db.define('Video', {name: String});

    Collection = db.define('Collection', {name: String, modelName: String});
    Collection.scope('items', function() {
      return {}; // could return a scope based on `this` (receiver)
    }, null, {}, {isStatic: false, modelTo: function(receiver) {
      return db.models[receiver.modelName];
    }});
  });

  beforeEach(function(done) {
    Collection.destroyAll(function() {
      Image.destroyAll(function() {
        Video.destroyAll(done);
      });
    });
  });

  beforeEach(function(done) {
    Collection.create({name: 'Images', modelName: 'Image'}, done);
  });

  beforeEach(function(done) {
    Collection.create({name: 'Videos', modelName: 'Video'}, done);
  });

  beforeEach(function(done) {
    Collection.create({name: 'Things', modelName: 'Unknown'}, done);
  });

  beforeEach(function(done) {
    Image.create({name: 'Image A'}, done);
  });

  beforeEach(function(done) {
    Video.create({name: 'Video A'}, done);
  });

  it('should deduce modelTo at runtime - Image', function(done) {
    Collection.findOne({where: {modelName: 'Image'}}, function(err, coll) {
      if (err) return done(err);
      coll.name.should.equal('Images');
      coll.items(function(err, items) {
        if (err) return done(err);
        items.length.should.equal(1);
        items[0].name.should.equal('Image A');
        items[0].should.be.instanceof(Image);
        done();
      });
    });
  });

  it('should deduce modelTo at runtime - Video', function(done) {
    Collection.findOne({where: {modelName: 'Video'}}, function(err, coll) {
      if (err) return done(err);
      coll.name.should.equal('Videos');
      coll.items(function(err, items) {
        if (err) return done(err);
        items.length.should.equal(1);
        items[0].name.should.equal('Video A');
        items[0].should.be.instanceof(Video);
        done();
      });
    });
  });

  it('should throw if modelTo is invalid', function(done) {
    Collection.findOne({where: {name: 'Things'}}, function(err, coll) {
      if (err) return done(err);
      coll.modelName.should.equal('Unknown');
      (function() {
        coll.items(function(err, items) {});
      }).should.throw();
      done();
    });
  });
});

describe('scope - dynamic function', function() {
  let Item, seed = 0;

  before(function() {
    db = getSchema();
    Item = db.define('Item', {title: Number, creator: Number});
    Item.scope('dynamicQuery', function() {
      seed++;
      return {where: {creator: seed}};
    });
  });

  beforeEach(function(done) {
    Item.create({title: 1, creator: 1}, function() {
      Item.create({title: 2, creator: 2}, done);
    });
  });

  it('should deduce item by runtime creator', function(done) {
    Item.dynamicQuery.findOne(function(err, firstQuery) {
      if (err) return done(err);
      firstQuery.title.should.equal(1);
      Item.dynamicQuery.findOne(function(err, secondQuery) {
        if (err) return done(err);
        secondQuery.title.should.equal(2);
        done();
      });
    });
  });
});
