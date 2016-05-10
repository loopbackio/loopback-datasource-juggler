// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/*global describe,it*/
/*jshint expr:true */

require('should');

var GeoPoint = require('../lib/geo').GeoPoint;
var DELTA = 0.0000001;

describe('GeoPoint', function() {
  describe('constructor', function() {
    it('should support a valid array', function() {
      var point = new GeoPoint([-34, 150]);

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should support a valid object', function() {
      var point = new GeoPoint({ lat: -34, lng: 150 });

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should support valid string geo coordinates', function() {
      var point = new GeoPoint('-34,150');

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should support coordinates as inline parameters', function() {
      var point = new GeoPoint(-34, 150);

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should reject invalid parameters', function() {
      /*jshint -W024 */
      var fn = function() {
        new GeoPoint('150,-34');
      };
      fn.should.throw();

      fn = function() {
        new GeoPoint('invalid_string');
      };
      fn.should.throw();

      fn = function() {
        new GeoPoint([150, -34]);
      };
      fn.should.throw();

      fn = function() {
        new GeoPoint({
          lat: 150,
          lng: null,
        });
      };
      fn.should.throw();

      fn = function() {
        new GeoPoint(150, -34);
      };
      fn.should.throw();

      fn = function() {
        new GeoPoint();
      };
      fn.should.throw();
    });
  });

  describe('toString()', function() {
    it('should return a string in the form "lat,lng"', function() {
      var point = new GeoPoint({ lat: -34, lng: 150 });
      point.toString().should.equal('-34,150');
    });
  });

  describe('distance calculation between two points', function() {
    var here = new GeoPoint({ lat: 40.77492964101182, lng: -73.90950187151662 });
    var there = new GeoPoint({ lat: 40.7753227, lng: -73.909217 });

    it('should return value in miles by default', function() {
      var distance = GeoPoint.distanceBetween(here, there);
      distance.should.be.a.Number;
      distance.should.be.approximately(0.03097916611592679, DELTA);
    });

    it('should return value using specified unit', function() {
      /* Supported units:
       * - `radians`
       * - `kilometers`
       * - `meters`
       * - `miles`
       * - `feet`
       * - `degrees`
       */

      var distance = here.distanceTo(there, { type: 'radians' });
      distance.should.be.a.Number;
      distance.should.be.approximately(0.000007825491914348416, DELTA);

      distance = here.distanceTo(there, { type: 'kilometers' });
      distance.should.be.a.Number;
      distance.should.be.approximately(0.04985613511367009, DELTA);

      distance = here.distanceTo(there, { type: 'meters' });
      distance.should.be.a.Number;
      distance.should.be.approximately(49.856135113670085, DELTA);

      distance = here.distanceTo(there, { type: 'miles' });
      distance.should.be.a.Number;
      distance.should.be.approximately(0.03097916611592679, DELTA);

      distance = here.distanceTo(there, { type: 'feet' });
      distance.should.be.a.Number;
      distance.should.be.approximately(163.56999709209347, DELTA);

      distance = here.distanceTo(there, { type: 'degrees' });
      distance.should.be.a.Number;
      distance.should.be.approximately(0.0004483676593058972, DELTA);
    });
  });
});
