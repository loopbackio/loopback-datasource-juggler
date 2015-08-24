var assert = require("assert");
var should = require("should");

var includeUtils = require("../lib/include_utils");

describe('include_util', function(){
  describe('#buildOneToOneIdentityMap', function(){
    it('should return an object with keys', function(){
      var objs = [
          {id: 11, letter: "A"},
          {id: 22, letter: "B"}
      ];
      var result = includeUtils.buildOneToOneIdentityMap(objs, "id");
      result.should.be.an.instanceOf(Object);
      result.should.have.property("11");
      result.should.have.property("22");
    });

    it('should overwrite keys in case of collision', function(){
        var objs = [
            {id: 11, letter: "A"},
            {id: 22, letter: "B"},
            {id: 33, letter: "C"},
            {id: 11, letter: "HA!"}
        ];

        var result = includeUtils.buildOneToOneIdentityMap(objs, "id");
        result.should.be.an.instanceOf(Object);
        result.should.have.keys("11", "22", "33");
        result["11"]["letter"].should.equal("HA!");
        result["33"]["letter"].should.equal("C");
    });
  });

    describe('#buildOneToManyIdentityMap', function(){
        it('should return an object with keys', function(){
            var objs = [
                {id: 11, letter: "A"},
                {id: 22, letter: "B"}
            ];
            var result = includeUtils.buildOneToManyIdentityMap(objs, "id");
            result.should.be.an.instanceOf(Object);
            result.should.have.keys("11", "22");
        });

        it('should collect keys in case of collision', function(){
            var objs = [
                {fk_id: 11, letter: "A"},
                {fk_id: 22, letter: "B"},
                {fk_id: 33, letter: "C"},
                {fk_id: 11, letter: "HA!"}
            ];

            var result = includeUtils.buildOneToManyIdentityMap(objs, "fk_id");
            result.should.be.an.instanceOf(Object);
            result.should.have.keys("11", "22", "33");
            result["11"][0]["letter"].should.equal("A");
            result["11"][1]["letter"].should.equal("HA!");
            result["33"][0]["letter"].should.equal("C");
        });
    });
});
