var should = require('./init.js');
var fieldsToArray = require('../lib/utils').fieldsToArray;

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