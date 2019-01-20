// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';

/* global getSchema:false, connectorCapabilities:false */
const should = require('./init.js');

let db, Model;

describe('nested properties', function() {
  before(function(done) {
    const modelDef = {
      'nested': {
        'duration': Number,
        'happenedOn': Date,
      },
    };

    db = getSchema();
    Model = db.define('Model', modelDef);
    db.automigrate(done);
  });

  describe('find', function() {
    before(function(done) {
      db = getSchema();
      Model.destroyAll(done);
    });

    it('should query by nested Date: found', function() {
      return Model.create({
        nested: {
          duration: 2,
          happenedOn: '2017-10-30T06:07:31.805Z',
        },
      })
        .then(created => {
		  should.exist(created.id);
		  console.log(created);
          return Model.find({
            where: {
              'nested.happenedOn': {
                'gt': new Date('2017-10-20T06:07:31.805Z'),
              },
            },
          });
        })
        .then(found => {
          should.exist(found);
          found.should.not.be.empty();
          found[0].should.be.an.instanceOf(Model);
        });
    });
  });
});
