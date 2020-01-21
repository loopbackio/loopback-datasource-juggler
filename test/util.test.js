// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const should = require('./init.js');
const utils = require('../lib/utils');
const ObjectID = require('bson').ObjectID;
const fieldsToArray = utils.fieldsToArray;
const sanitizeQuery = utils.sanitizeQuery;
const deepMerge = utils.deepMerge;
const rankArrayElements = utils.rankArrayElements;
const mergeIncludes = utils.mergeIncludes;
const sortObjectsByIds = utils.sortObjectsByIds;
const uniq = utils.uniq;

describe('util.fieldsToArray', function() {
  function sample(fields, excludeUnknown) {
    const properties = ['foo', 'bar', 'bat', 'baz'];
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

describe('util.sanitizeQuery', function() {
  it('Remove undefined values from the query object', function() {
    const q1 = {where: {x: 1, y: undefined}};
    should.deepEqual(sanitizeQuery(q1), {where: {x: 1}});

    const q2 = {where: {x: 1, y: 2}};
    should.deepEqual(sanitizeQuery(q2), {where: {x: 1, y: 2}});

    const q3 = {where: {x: 1, y: {in: [2, undefined]}}};
    should.deepEqual(sanitizeQuery(q3), {where: {x: 1, y: {in: [2]}}});

    should.equal(sanitizeQuery(null), null);

    should.equal(sanitizeQuery(undefined), undefined);

    should.equal(sanitizeQuery('x'), 'x');

    const date = new Date();
    const q4 = {where: {x: 1, y: date}};
    should.deepEqual(sanitizeQuery(q4), {where: {x: 1, y: date}});

    // test handling of undefined
    let q5 = {where: {x: 1, y: undefined}};
    should.deepEqual(sanitizeQuery(q5, 'nullify'), {where: {x: 1, y: null}});

    q5 = {where: {x: 1, y: undefined}};
    should.deepEqual(sanitizeQuery(q5, {normalizeUndefinedInQuery: 'nullify'}), {where: {x: 1, y: null}});

    const q6 = {where: {x: 1, y: undefined}};
    (function() { sanitizeQuery(q6, 'throw'); }).should.throw(/`undefined` in query/);
  });

  it('Report errors for circular or deep query objects', function() {
    const q7 = {where: {x: 1}};
    q7.where.y = q7;
    (function() { sanitizeQuery(q7); }).should.throw(
      /The query object is circular/,
    );

    const q8 = {where: {and: [{and: [{and: [{and: [{and: [{and:
      [{and: [{and: [{and: [{x: 1}]}]}]}]}]}]}]}]}]}};
    (function() { sanitizeQuery(q8, {maxDepth: 12}); }).should.throw(
      /The query object exceeds maximum depth 12/,
    );

    // maxDepth is default to maximum integer
    sanitizeQuery(q8).should.eql(q8);

    const q9 = {where: {and: [{and: [{and: [{and: [{x: 1}]}]}]}]}};
    (function() { sanitizeQuery(q8, {maxDepth: 4}); }).should.throw(
      /The query object exceeds maximum depth 4/,
    );
  });

  it('Removed prohibited properties in query objects', function() {
    const q1 = {where: {secret: 'guess'}};
    sanitizeQuery(q1, {prohibitedKeys: ['secret']});
    q1.where.should.eql({});

    const q2 = {and: [{secret: 'guess'}, {x: 1}]};
    sanitizeQuery(q2, {prohibitedKeys: ['secret']});
    q2.should.eql({and: [{}, {x: 1}]});
  });

  it('should allow proper structured regexp string', () => {
    const q1 = {where: {name: {like: '^J'}}};
    sanitizeQuery(q1).should.eql({where: {name: {like: '^J'}}});
  });

  it('should properly sanitize regexp string operators', () => {
    const q1 = {where: {name: {like: '['}}};
    sanitizeQuery(q1).should.eql({where: {name: {like: '\\['}}});

    const q2 = {where: {name: {nlike: '['}}};
    sanitizeQuery(q2).should.eql({where: {name: {nlike: '\\['}}});

    const q3 = {where: {name: {ilike: '['}}};
    sanitizeQuery(q3).should.eql({where: {name: {ilike: '\\['}}});

    const q4 = {where: {name: {nilike: '['}}};
    sanitizeQuery(q4).should.eql({where: {name: {nilike: '\\['}}});

    const q5 = {where: {name: {regexp: '['}}};
    sanitizeQuery(q5).should.eql({where: {name: {regexp: '\\['}}});
  });
});

describe('util.parseSettings', function() {
  it('Parse a full url into a settings object', function() {
    const url = 'mongodb://x:y@localhost:27017/mydb?w=2';
    const settings = utils.parseSettings(url);
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
    const url = 'mongodb://localhost:27017/mydb/abc?w=2';
    const settings = utils.parseSettings(url);
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
    const url = 'mysql://127.0.0.1:3306/mydb?x[a]=1&x[b]=2&engine=InnoDB';
    const settings = utils.parseSettings(url);
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

  it('Parse a Memory url without auth into a settings object', function() {
    const url = 'memory://?x=1';
    const settings = utils.parseSettings(url);
    should.equal(settings.hostname, '');
    should.equal(settings.user, undefined);
    should.equal(settings.password, undefined);
    should.equal(settings.database, undefined);
    should.equal(settings.connector, 'memory');
    should.equal(settings.x, '1');
    should.equal(settings.url, 'memory://?x=1');
  });
});

describe('util.deepMerge', function() {
  it('should deep merge objects', function() {
    const extras = {base: 'User',
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
    const base = {strict: false,
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

    const merged = deepMerge(base, extras);

    const expected = {strict: false,
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

    should.deepEqual(merged, expected, 'Merged objects should match the expectation');
  });
});

describe('util.rankArrayElements', function() {
  it('should add property \'__rank\' to array elements of type object {}', function() {
    const acls = [
      {accessType: '*',
        permission: 'DENY',
        principalType: 'ROLE',
        principalId: '$everyone'},
    ];

    const rankedAcls = rankArrayElements(acls, 2);

    should.equal(rankedAcls[0].__rank, 2);
  });

  it('should not replace existing \'__rank\' property of array elements', function() {
    const acls = [
      {accessType: '*',
        permission: 'DENY',
        principalType: 'ROLE',
        principalId: '$everyone',
        __rank: 1,
      },
    ];

    const rankedAcls = rankArrayElements(acls, 2);

    should.equal(rankedAcls[0].__rank, 1);
  });
});

describe('util.sortObjectsByIds', function() {
  const items = [
    {id: 1, name: 'a'},
    {id: 2, name: 'b'},
    {id: 3, name: 'c'},
    {id: 4, name: 'd'},
    {id: 5, name: 'e'},
    {id: 6, name: 'f'},
  ];

  it('should sort', function() {
    const sorted = sortObjectsByIds('id', [6, 5, 4, 3, 2, 1], items);
    const names = sorted.map(function(u) { return u.name; });
    should.deepEqual(names, ['f', 'e', 'd', 'c', 'b', 'a']);
  });

  it('should sort - partial ids', function() {
    const sorted = sortObjectsByIds('id', [5, 3, 2], items);
    const names = sorted.map(function(u) { return u.name; });
    should.deepEqual(names, ['e', 'c', 'b', 'a', 'd', 'f']);
  });

  it('should sort - strict', function() {
    const sorted = sortObjectsByIds('id', [5, 3, 2], items, true);
    const names = sorted.map(function(u) { return u.name; });
    should.deepEqual(names, ['e', 'c', 'b']);
  });
});

describe('util.mergeIncludes', function() {
  function checkInputOutput(baseInclude, updateInclude, expectedInclude) {
    const mergedInclude = mergeIncludes(baseInclude, updateInclude);
    should.deepEqual(mergedInclude, expectedInclude,
      'Merged include should match the expectation');
  }

  it('Merge string values to object', function() {
    const baseInclude = 'relation1';
    const updateInclude = 'relation2';
    const expectedInclude = [
      {relation2: true},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge string & array values to object', function() {
    const baseInclude = 'relation1';
    const updateInclude = ['relation2'];
    const expectedInclude = [
      {relation2: true},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge string & object values to object', function() {
    const baseInclude = ['relation1'];
    const updateInclude = {relation2: 'relation2Include'};
    const expectedInclude = [
      {relation2: 'relation2Include'},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge array & array values to object', function() {
    const baseInclude = ['relation1'];
    const updateInclude = ['relation2'];
    const expectedInclude = [
      {relation2: true},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge array & object values to object', function() {
    const baseInclude = ['relation1'];
    const updateInclude = {relation2: 'relation2Include'};
    const expectedInclude = [
      {relation2: 'relation2Include'},
      {relation1: true},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge object & object values to object', function() {
    const baseInclude = {relation1: 'relation1Include'};
    const updateInclude = {relation2: 'relation2Include'};
    const expectedInclude = [
      {relation2: 'relation2Include'},
      {relation1: 'relation1Include'},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Override property collision with update value', function() {
    const baseInclude = {relation1: 'baseValue'};
    const updateInclude = {relation1: 'updateValue'};
    const expectedInclude = [
      {relation1: 'updateValue'},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge string includes & include with relation syntax properly',
    function() {
      const baseInclude = 'relation1';
      const updateInclude = {relation: 'relation1'};
      const expectedInclude = [
        {relation: 'relation1'},
      ];
      checkInputOutput(baseInclude, updateInclude, expectedInclude);
    });

  it('Merge string includes & include with scope properly', function() {
    const baseInclude = 'relation1';
    const updateInclude = {
      relation: 'relation1',
      scope: {include: 'relation2'},
    };
    const expectedInclude = [
      {relation: 'relation1', scope: {include: 'relation2'}},
    ];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });

  it('Merge includes with and without relation syntax properly',
    function() {
      // w & w/o relation syntax - no collision
      let baseInclude = ['relation2'];
      let updateInclude = {
        relation: 'relation1',
        scope: {include: 'relation2'},
      };
      let expectedInclude = [{
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
    const baseInclude = ['relation1', {relation2: true},
      {relation: 'relation3', scope: {where: {id: 'some id'}}},
      {relation: 'relation5', scope: {where: {id: 'some id'}}},
    ];
    const updateInclude = ['relation4', {relation3: true},
      {relation: 'relation2', scope: {where: {id: 'some id'}}}];
    const expectedInclude = [{relation4: true}, {relation3: true},
      {relation: 'relation2', scope: {where: {id: 'some id'}}},
      {relation1: true},
      {relation: 'relation5', scope: {where: {id: 'some id'}}}];
    checkInputOutput(baseInclude, updateInclude, expectedInclude);
  });
});

describe('util.uniq', function() {
  it('should dedupe an array with duplicate number entries', function() {
    const a = [1, 2, 1, 3];
    const b = uniq(a);
    b.should.eql([1, 2, 3]);
  });

  it('should dedupe an array with duplicate string entries', function() {
    const a = ['a', 'a', 'b', 'a'];
    const b = uniq(a);
    b.should.eql(['a', 'b']);
  });

  it('should dedupe an array with duplicate bson entries', function() {
    const idOne = new ObjectID('59f9ec5dc7d59a00042f7c62');
    const idTwo = new ObjectID('59f9ec5dc7d59a00042f7c63');
    const a = [idOne, idTwo, new ObjectID('59f9ec5dc7d59a00042f7c62'),
      new ObjectID('59f9ec5dc7d59a00042f7c62')];
    const b = uniq(a);
    b.should.eql([idOne, idTwo]);
  });

  it('should dedupe an array without duplicate number entries', function() {
    const a = [1, 3, 2];
    const b = uniq(a);
    b.should.eql([1, 3, 2]);
  });

  it('should dedupe an array without duplicate string entries', function() {
    const a = ['a', 'c', 'b'];
    const b = uniq(a);
    b.should.eql(['a', 'c', 'b']);
  });

  it('should dedupe an array without duplicate bson entries', function() {
    const idOne = new ObjectID('59f9ec5dc7d59a00042f7c62');
    const idTwo = new ObjectID('59f9ec5dc7d59a00042f7c63');
    const idThree = new ObjectID('59f9ec5dc7d59a00042f7c64');
    const a = [idOne, idTwo, idThree];
    const b = uniq(a);
    b.should.eql([idOne, idTwo, idThree]);
  });

  it('should allow null/undefined array', function() {
    const a = null;
    const b = uniq(a);
    b.should.eql([]);
  });

  it('should report error for non-array arg', function() {
    const a = '1';
    try {
      const b = uniq(a);
      throw new Error('The test should have thrown an error');
    } catch (err) {
      err.should.be.instanceof(Error);
    }
  });
});

describe('util.toRegExp', function() {
  let invalidDataTypes;
  let validDataTypes;

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

describe('util.idsHaveDuplicates', function() {
  context('with string IDs', function() {
    it('should be true with a duplicate present', function() {
      utils.idsHaveDuplicates(['a', 'b', 'a']).should.be.ok;
    });

    it('should be false when no duplicates are present', function() {
      utils.idsHaveDuplicates(['a', 'b', 'c']).should.not.be.ok;
    });
  });

  context('with numeric IDs', function() {
    it('should be true with a duplicate present', function() {
      utils.idsHaveDuplicates([1, 2, 1]).should.be.ok;
    });

    it('should be false when no duplicates are present', function() {
      utils.idsHaveDuplicates([1, 2, 3]).should.not.be.ok;
    });
  });

  context('with complex IDs', function() {
    it('should be true with a duplicate present', function() {
      utils.idsHaveDuplicates(['a', 'b', 'a'].map(id => ({id}))).should.be.ok;
    });

    it('should be false when no duplicates are present', function() {
      utils.idsHaveDuplicates(['a', 'b', 'c'].map(id => ({id}))).should.not.be.ok;
    });
  });
});
