// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
var should = require('./init.js');
var utils = require('../lib/utils');
var fieldsToArray = utils.fieldsToArray;
var removeUndefined = utils.removeUndefined;
var mergeSettings = utils.mergeSettings;
var mergeIncludes = utils.mergeIncludes;
var sortObjectsByIds = utils.sortObjectsByIds;
var uniq = utils.uniq;

describe('util.fieldsToArray', function() {
  function sample(fields, excludeUnknown) {
    var properties = ['foo', 'bar', 'bat', 'baz'];
    return {
      expect: function(arr) {
        should.deepEqual(fieldsToArray(fields, properties, excludeUnknown), arr);
      },
    };
  }

  it('Turn objects and strings into an array of fields' +
    ' to include when finding models', function() {
    sample(false).expect(undefined);
    sample(null).expect(undefined);
    sample({}).expect(undefined);
    sample('foo').expect(['foo']);
    sample(['foo']).expect(['foo']);
    sample({'foo': 1}).expect(['foo']);
    sample({'bat': true}).expect(['bat']);
    sample({'bat': 0}).expect(['foo', 'bar', 'baz']);
    sample({'bat': false}).expect(['foo', 'bar', 'baz']);
  });

  it('should exclude unknown properties', function() {
    sample(false, true).expect(undefined);
    sample(null, true).expect(undefined);
    sample({}, true).expect(undefined);
    sample('foo', true).expect(['foo']);
    sample(['foo', 'unknown'], true).expect(['foo']);
    sample({'foo': 1, unknown: 1}, true).expect(['foo']);
    sample({'bat': true, unknown: true}, true).expect(['bat']);
    sample({'bat': 0}, true).expect(['foo', 'bar', 'baz']);
    sample({'bat': false}, true).expect(['foo', 'bar', 'baz']);
    sample({'other': false}, true).expect(['foo', 'bar', 'bat', 'baz']);
  });
});

describe('util.removeUndefined', function() {
  it('Remove undefined values from the query object', function() {
    var q1 = {where: {x: 1, y: undefined}};
    should.deepEqual(removeUndefined(q1), {where: {x: 1}});

    var q2 = {where: {x: 1, y: 2}};
    should.deepEqual(removeUndefined(q2), {where: {x: 1, y: 2}});

    var q3 = {where: {x: 1, y: {in: [2, undefined]}}};
    should.deepEqual(removeUndefined(q3), {where: {x: 1, y: {in: [2]}}});

    should.equal(removeUndefined(null), null);

    should.equal(removeUndefined(undefined), undefined);

    should.equal(removeUndefined('x'), 'x');

    var date = new Date();
    var q4 = {where: {x: 1, y: date}};
    should.deepEqual(removeUndefined(q4), {where: {x: 1, y: date}});

    // test handling of undefined
    var q5 = {where: {x: 1, y: undefined}};
    should.deepEqual(removeUndefined(q5, 'nullify'), {where: {x: 1, y: null}});

    var q6 = {where: {x: 1, y: undefined}};
    (function() { removeUndefined(q6, 'throw'); }).should.throw(/`undefined` in query/);
  });
});

describe('util.parseSettings', function() {
  it('Parse a full url into a settings object', function() {
    var url = 'mongodb://x:y@localhost:27017/mydb?w=2';
    var settings = utils.parseSettings(url);
    should.equal(settings.hostname, 'localhost');
    should.equal(settings.port, 27017);
    should.equal(settings.host, 'localhost');
    should.equal(settings.user, 'x');
    should.equal(settings.password, 'y');
    should.equal(settings.database, 'mydb');
    should.equal(settings.connector, 'mongodb');
    should.equal(settings.w, '2');
    should.equal(settings.url, 'mongodb://x:y@localhost:27017/mydb?w=2');
  });

  it('Parse a url without auth into a settings object', function() {
    var url = 'mongodb://localhost:27017/mydb/abc?w=2';
    var settings = utils.parseSettings(url);
    should.equal(settings.hostname, 'localhost');
    should.equal(settings.port, 27017);
    should.equal(settings.host, 'localhost');
    should.equal(settings.user, undefined);
    should.equal(settings.password, undefined);
    should.equal(settings.database, 'mydb');
    should.equal(settings.connector, 'mongodb');
    should.equal(settings.w, '2');
    should.equal(settings.url, 'mongodb://localhost:27017/mydb/abc?w=2');
  });

  it('Parse a url with complex query into a settings object', function() {
    var url = 'mysql://127.0.0.1:3306/mydb?x[a]=1&x[b]=2&engine=InnoDB';
    var settings = utils.parseSettings(url);
    should.equal(settings.hostname, '127.0.0.1');
    should.equal(settings.port, 3306);
    should.equal(settings.host, '127.0.0.1');
    should.equal(settings.user, undefined);
    should.equal(settings.password, undefined);
    should.equal(settings.database, 'mydb');
    should.equal(settings.connector, 'mysql');
    should.equal(settings.x.a, '1');
    should.equal(settings.x.b, '2');
    should.equal(settings.engine, 'InnoDB');
    should.equal(settings.url, 'mysql://127.0.0.1:3306/mydb?x[a]=1&x[b]=2&engine=InnoDB');
  });

  it('Parse a url without auth into a settings object', function() {
    var url = 'memory://?x=1';
    var settings = utils.parseSettings(url);
    should.equal(settings.hostname, '');
    should.equal(settings.user, undefined);
    should.equal(settings.password, undefined);
    should.equal(settings.database, undefined);
    should.equal(settings.connector, 'memory');
    should.equal(settings.x, '1');
    should.equal(settings.url, 'memory://?x=1');
  });
});

describe('mergeSettings', function() {
  it('should merge settings correctly', function() {
    var src = {base: 'User',
      relations: {accessTokens: {model: 'accessToken', type: 'hasMany',
        foreignKey: 'userId'},
        account: {model: 'account', type: 'belongsTo'}},
      acls: [
        {accessType: '*',
          permission: 'DENY',
          principalType: 'ROLE',
          principalId: '$everyone'},
        {accessType: '*',
          permission: 'ALLOW',
          principalType: 'ROLE',
          property: 'login',
          principalId: '$everyone'},
        {permission: 'ALLOW',
          property: 'findById',
          principalType: 'ROLE',
          principalId: '$owner'},
      ]};
    var tgt = {strict: false,
      acls: [
        {principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW',
          property: 'create'},
        {principalType: 'ROLE',
          principalId: '$owner',
          permission: 'ALLOW',
          property: 'removeById'},
      ],
      maxTTL: 31556926,
      ttl: 1209600};

    var dst = mergeSettings(tgt, src);

    var expected = {strict: false,
      acls: [
        {principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW',
          property: 'create'},
        {principalType: 'ROLE',
          principalId: '$owner',
          permission: 'ALLOW',
          property: 'removeById'},
        {accessType: '*',
          permission: 'DENY',
          principalType: 'ROLE',
          principalId: '$everyone'},
        {accessType: '*',
          permission: 'ALLOW',
          principalType: 'ROLE',
          property: 'login',
          principalId: '$everyone'},
        {permission: 'ALLOW',
          property: 'findById',
          principalType: 'ROLE',
          principalId: '$owner'},
      ],
      maxTTL: 31556926,
      ttl: 1209600,
      base: 'User',
      relations: {accessTokens: {model: 'accessToken', type: 'hasMany',
        foreignKey: 'userId'},
        account: {model: 'account', type: 'belongsTo'}}};

    should.deepEqual(dst.acls, expected.acls, 'Merged settings should match the expectation');
  });
});

describe('sortObjectsByIds', function() {
  var items = [
    {id: 1, name: 'a'},
    {id: 2, name: 'b'},
    {id: 3, name: 'c'},
    {id: 4, name: 'd'},
    {id: 5, name: 'e'},
    {id: 6, name: 'f'},
  ];

  it('should sort', function() {
    var sorted = sortObjectsByIds('id', [6, 5, 4, 3, 2, 1], items);
    var names = sorted.map(function(u) { return u.name; });
    should.deepEqual(names, ['f', 'e', 'd', 'c', 'b', 'a']);
  });

  it('should sort - partial ids', function() {
    var sorted = sortObjectsByIds('id', [5, 3, 2], items);
    var names = sorted.map(function(u) { return u.name; });
    should.deepEqual(names, ['e', 'c', 'b', 'a', 'd', 'f']);
  });

  it('should sort - strict', function() {
    var sorted = sortObjectsByIds('id', [5, 3, 2], items, true);
    var names = sorted.map(function(u) { return u.name; });
    should.deepEqual(names, ['e', 'c', 'b']);
  });
});

describe('util.mergeIncludes', function() {
  function checkInputOutput(baseInclude, updateInclude, expectedInclude) {
    var mergedInclude = mergeIncludes(baseInclude, updateInclude);
    should.deepEqual(mergedInclude, expectedInclude,
      'Merged include should match the expectation');
  }

  it('Merge string values to object', function() {
    var baseInclude = 'relation1';
    var updateInclude = 'relation2';
    var expectedInclude = [
      {relation2: true},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge string & array values to object', function() {
    var baseInclude = 'relation1';
    var updateInclude = ['relation2'];
    var expectedInclude = [
      {relation2: true},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge string & object values to object', function() {
    var baseInclude = ['relation1'];
    var updateInclude = {relation2: 'relation2Include'};
    var expectedInclude = [
      {relation2: 'relation2Include'},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge array & array values to object', function() {
    var baseInclude = ['relation1'];
    var updateInclude = ['relation2'];
    var expectedInclude = [
      {relation2: true},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge array & object values to object', function() {
    var baseInclude = ['relation1'];
    var updateInclude = {relation2: 'relation2Include'};
    var expectedInclude = [
      {relation2: 'relation2Include'},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge object & object values to object', function() {
    var baseInclude = {relation1: 'relation1Include'};
    var updateInclude = {relation2: 'relation2Include'};
    var expectedInclude = [
      {relation2: 'relation2Include'},
      {relation1: 'relation1Include'},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Override property collision with update value', function() {
    var baseInclude = {relation1: 'baseValue'};
    var updateInclude = {relation1: 'updateValue'};
    var expectedInclude = [
      {relation1: 'updateValue'},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge string includes & include with relation syntax properly',
    function() {
      var baseInclude = 'relation1';
      var updateInclude = {relation: 'relation1'};
      var expectedInclude = [
        {relation: 'relation1'},
      ];
      checkInputOutput(baseInclude, updateInclude, expectedInclude);
    });

  it('Merge string includes & include with scope properly', function() {
    var baseInclude = 'relation1';
    var updateInclude = {
      relation: 'relation1',
      scope: {include: 'relation2'},
    };
    var expectedInclude = [
      {relation: 'relation1', scope: {include: 'relation2'}},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge includes with and without relation syntax properly',
    function() {
      // w & w/o relation syntax - no collision
      var baseInclude = ['relation2'];
      var updateInclude = {
        relation: 'relation1',
        scope: {include: 'relation2'},
      };
      var expectedInclude = [{
        relation: 'relation1',
        scope: {include: 'relation2'},
      }, {relation2: true}];
      checkInputOutput(baseInclude, updateInclude, expectedInclude);

      // w & w/o relation syntax - collision
      baseInclude = ['relation1'];
      updateInclude = {relation: 'relation1', scope: {include: 'relation2'}};
      expectedInclude =
        [{relation: 'relation1', scope: {include: 'relation2'}}];
      checkInputOutput(baseInclude, updateInclude, expectedInclude);

      // w & w/o relation syntax - collision
      baseInclude = {relation: 'relation1', scope: {include: 'relation2'}};
      updateInclude = ['relation1'];
      expectedInclude = [{relation1: true}];
      checkInputOutput(baseInclude, updateInclude, expectedInclude);
    });

  it('Merge includes with mixture of strings, arrays & objects properly', function() {
    var baseInclude = ['relation1', {relation2: true},
      {relation: 'relation3', scope: {where: {id: 'some id'}}},
      {relation: 'relation5', scope: {where: {id: 'some id'}}},
    ];
    var updateInclude = ['relation4', {relation3: true},
      {relation: 'relation2', scope: {where: {id: 'some id'}}}];
    var expectedInclude = [{relation4: true}, {relation3: true},
      {relation: 'relation2', scope: {where: {id: 'some id'}}},
      {relation1: true},
      {relation: 'relation5', scope: {where: {id: 'some id'}}}];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });
});

describe('util.uniq', function() {
  it('should dedupe an array with duplicate number entries', function() {
    var a = [1, 2, 1, 3];
    var b = uniq(a);
    b.should.eql([1, 2, 3]);
  });

  it('should dedupe an array with duplicate string entries', function() {
    var a = ['a', 'a', 'b', 'a'];
    var b = uniq(a);
    b.should.eql(['a', 'b']);
  });

  it('should dedupe an array without duplicate number entries', function() {
    var a = [1, 3, 2];
    var b = uniq(a);
    b.should.eql([1, 3, 2]);
  });

  it('should dedupe an array without duplicate string entries', function() {
    var a = ['a', 'c', 'b'];
    var b = uniq(a);
    b.should.eql(['a', 'c', 'b']);
  });

  it('should allow null/undefined array', function() {
    var a = null;
    var b = uniq(a);
    b.should.eql([]);
  });

  it('should report error for non-array arg', function() {
    var a = '1';
    try {
      var b = uniq(a);
      throw new Error('The test should have thrown an error');
    } catch (err) {
      err.should.be.instanceof(Error);
    }
  });
});

describe('util.toRegExp', function() {
  var invalidDataTypes;
  var validDataTypes;

  before(function() {
    invalidDataTypes = [0, true, {}, [], Function, null];
    validDataTypes = ['string', /^regex/, new RegExp(/^regex/)];
  });

  it('should not accept invalid data types', function() {
    invalidDataTypes.forEach(function(invalid) {
      utils.toRegExp(invalid).should.be.an.Error;
    });
  });

  it('should accept valid data types', function() {
    validDataTypes.forEach(function(valid) {
      utils.toRegExp(valid).should.not.be.an.Error;
    });
  });

  context('with a regex string', function() {
    it('should return a RegExp object when no regex flags are provided',
        function() {
          utils.toRegExp('^regex$').should.be.an.instanceOf(RegExp);
        });

    it('should throw an error when invalid regex flags are provided',
        function() {
          utils.toRegExp('^regex$/abc').should.be.an.Error;
        });

    it('should return a RegExp object when valid flags are provided',
        function() {
          utils.toRegExp('regex/igm').should.be.an.instanceOf(RegExp);
        });
  });

  context('with a regex literal', function() {
    it('should return a RegExp object', function() {
      utils.toRegExp(/^regex$/igm).should.be.an.instanceOf(RegExp);
    });
  });

  context('with a regex object', function() {
    it('should return a RegExp object', function() {
      utils.toRegExp(new RegExp('^regex$', 'igm')).should.be.an.instanceOf(RegExp);
    });
  });
});

describe('util.hasRegExpFlags', function() {
  context('with a regex string', function() {
    it('should be true when the regex has invalid flags', function() {
      utils.hasRegExpFlags('^regex$/abc').should.be.ok;
    });

    it('should be true when the regex has valid flags', function() {
      utils.hasRegExpFlags('^regex$/igm').should.be.ok;
    });

    it('should be false when the regex has no flags', function() {
      utils.hasRegExpFlags('^regex$').should.not.be.ok;
      utils.hasRegExpFlags('^regex$/').should.not.be.ok;
    });
  });

  context('with a regex literal', function() {
    it('should be true when the regex has valid flags', function() {
      utils.hasRegExpFlags(/^regex$/igm).should.be.ok;
    });

    it('should be false when the regex has no flags', function() {
      utils.hasRegExpFlags(/^regex$/).should.not.be.ok;
    });
  });

  context('with a regex object', function() {
    it('should be true when the regex has valid flags', function() {
      utils.hasRegExpFlags(new RegExp(/^regex$/igm)).should.be.ok;
    });

    it('should be false when the regex has no flags', function() {
      utils.hasRegExpFlags(new RegExp(/^regex$/)).should.not.be.ok;
    });
  });
});
