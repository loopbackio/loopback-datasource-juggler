var should = require('./init.js');
var utils = require('../lib/utils');
var fieldsToArray = utils.fieldsToArray;
var removeUndefined = utils.removeUndefined;
var mergeSettings = utils.mergeSettings;

describe('util.fieldsToArray', function () {
  it('Turn objects and strings into an array of fields to include when finding models', function () {

    function sample(fields) {
      var properties = ['foo', 'bar', 'bat', 'baz'];
      return {
        expect: function (arr) {
          should.deepEqual(fieldsToArray(fields, properties), arr);
        }
      }
    }

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
});

describe('util.removeUndefined', function () {
  it('Remove undefined values from the query object', function () {
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

  });
});

describe('util.parseSettings', function () {
  it('Parse a full url into a settings object', function () {
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

  it('Parse a url without auth into a settings object', function () {
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

  it('Parse a url with complex query into a settings object', function () {
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

  it('Parse a url without auth into a settings object', function () {
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

describe('mergeSettings', function () {
  it('should merge settings correctly', function () {
    var src = { base: 'User',
      relations: { accessTokens: { model: 'accessToken', type: 'hasMany',
        foreignKey: 'userId' },
        account: { model: 'account', type: 'belongsTo' } },
      acls: [
        { accessType: '*',
          permission: 'DENY',
          principalType: 'ROLE',
          principalId: '$everyone' },
        { accessType: '*',
          permission: 'ALLOW',
          principalType: 'ROLE',
          property: 'login',
          principalId: '$everyone' },
        { permission: 'ALLOW',
          property: 'findById',
          principalType: 'ROLE',
          principalId: '$owner' }
      ] };
    var tgt = { strict: false,
      acls: [
        { principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW',
          property: 'create' },
        { principalType: 'ROLE',
          principalId: '$owner',
          permission: 'ALLOW',
          property: 'removeById' }
      ],
      maxTTL: 31556926,
      ttl: 1209600 };

    var dst = mergeSettings(tgt, src);

    var expected = { strict: false,
      acls: [
        { principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW',
          property: 'create' },
        { principalType: 'ROLE',
          principalId: '$owner',
          permission: 'ALLOW',
          property: 'removeById' },
        { accessType: '*',
          permission: 'DENY',
          principalType: 'ROLE',
          principalId: '$everyone' },
        { accessType: '*',
          permission: 'ALLOW',
          principalType: 'ROLE',
          property: 'login',
          principalId: '$everyone' },
        { permission: 'ALLOW',
          property: 'findById',
          principalType: 'ROLE',
          principalId: '$owner' }
      ],
      maxTTL: 31556926,
      ttl: 1209600,
      base: 'User',
      relations: { accessTokens: { model: 'accessToken', type: 'hasMany',
        foreignKey: 'userId' },
        account: { model: 'account', type: 'belongsTo' } } };

    should.deepEqual(dst.acls, expected.acls, 'Merged settings should match the expectation');
  });
});