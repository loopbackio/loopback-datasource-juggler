var should = require('should');

var Guid = require('..').Guid;

describe('Guid', function() {
  it('accepts string value in the UUID format', function() {
    var val = new Guid('88157b51-84c4-4fe4-89e6-7c9acbf23688');
    val.toString().should.equal('88157b51-84c4-4fe4-89e6-7c9acbf23688');
  });

  it('rejects malformed string values', function() {
    should.throws(function() { new Guid('not-a-guid'); });
  });

  it('generates a unique id when the data is empty', function() {
    var val1 = new Guid();
    var val2 = new Guid();
    val1.toString().should.not.equal(val2.toString());
    should.doesNotThrow(function() { return new Guid(val1); });
  });

  it('accepts guid value', function() {
    var val = new Guid();
    var copy = new Guid(val);
    copy.toString().should.equal(val.toString());
  });

  it('generates a unique id when data is "new"', function() {
    var val = new Guid('new');
    should.doesNotThrow(function() { return new Guid(val); });
  });

  it('returns string as the JSON value', function() {
    var val = new Guid();
    JSON.stringify(val).should.equal(JSON.stringify(val.toString()));
  });

  it('returns string as the Object value', function() {
    var val = new Guid();
    val.toObject().should.equal(val.toString());
  });
});
