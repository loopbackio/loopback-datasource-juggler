var jdb = require('../');
var DataSource = jdb.DataSource;
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var async = require('async');

describe('Memory connector', function () {
  var file = path.join(__dirname, 'memory.json');

  function readModels(done) {
    fs.readFile(file, function (err, data) {
      var json = JSON.parse(data.toString());
      assert(json.models);
      assert(json.ids.User);
      done(err, json);
    });
  }

  before(function (done) {
    fs.unlink(file, function (err) {
      if (!err || err.code === 'ENOENT') {
        done();
      }
    });
  });

  it('should save to a json file', function (done) {
    var ds = new DataSource({
      connector: 'memory',
      file: file
    });

    var User = ds.createModel('User', {
      name: String,
      bio: String,
      approved: Boolean,
      joinedAt: Date,
      age: Number
    });

    var count = 0;
    var id = 1;
    async.eachSeries(['John1', 'John2', 'John3'], function (item, cb) {
      User.create({name: item}, function (err, result) {
        id = result.id;
        count++;
        readModels(function (err, json) {
          assert.equal(Object.keys(json.models.User).length, count);
          cb(err);
        });
      });
    }, function (err, results) {
      // Now try to delete one
      User.deleteById(id, function (err) {
        readModels(function (err, json) {
          assert.equal(Object.keys(json.models.User).length, 2);
          done();
        });
      });
    });

  });

  // The saved memory.json from previous test should be loaded
  it('should load from the json file', function (done) {
    var ds = new DataSource({
      connector: 'memory',
      file: file
    });

    var User = ds.createModel('User', {
      name: String,
      bio: String,
      approved: Boolean,
      joinedAt: Date,
      age: Number
    });

    User.find(function (err, users) {
      // There should be 2 records
      assert.equal(users.length, 2);
      done(err);
    });

  });
});

