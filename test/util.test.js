var should = require('./init.js');
var utils = require('../lib/utils');
var fieldsToArray = utils.fieldsToArray;
var removeUndefined = utils.removeUndefined;


describe('util.fieldsToArray', function(){
  it('Turn objects and strings into an array of fields to include when finding models', function() {
    
    
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

describe('util.removeUndefined', function(){
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

    });
});