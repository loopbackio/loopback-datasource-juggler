// Copyright IBM Corp. 2014,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

require('should');

const GeoPoint = require('../lib/geo').GeoPoint;
const nearFilter = require('../lib/geo').nearFilter;
const geoFilter = require('../lib/geo').filter;
const DELTA = 0.0000001;

describe('GeoPoint', function() {
  describe('constructor', function() {
    it('should support a valid array', function() {
      const point = new GeoPoint([-34, 150]);

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should support a valid object', function() {
      const point = new GeoPoint({lat: -34, lng: 150});

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should support valid string geo coordinates', function() {
      const point = new GeoPoint('-34,150');

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should support coordinates as inline parameters', function() {
      const point = new GeoPoint(-34, 150);

      point.lat.should.equal(-34);
      point.lng.should.equal(150);
    });

    it('should reject invalid parameters', function() {
      /* jshint -W024 */
      let fn = function() {
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
      const point = new GeoPoint({lat: -34, lng: 150});
      point.toString().should.equal('-34,150');
    });
  });

  describe('distance calculation between two points', function() {
    const here = new GeoPoint({lat: 40.77492964101182, lng: -73.90950187151662});
    const there = new GeoPoint({lat: 40.7753227, lng: -73.909217});

    it('should return value in miles by default', function() {
      const distance = GeoPoint.distanceBetween(here, there);
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

      let distance = here.distanceTo(there, {type: 'radians'});
      distance.should.be.a.Number;
      distance.should.be.approximately(0.000007825491914348416, DELTA);

      distance = here.distanceTo(there, {type: 'kilometers'});
      distance.should.be.a.Number;
      distance.should.be.approximately(0.04985613511367009, DELTA);

      distance = here.distanceTo(there, {type: 'meters'});
      distance.should.be.a.Number;
      distance.should.be.approximately(49.856135113670085, DELTA);

      distance = here.distanceTo(there, {type: 'miles'});
      distance.should.be.a.Number;
      distance.should.be.approximately(0.03097916611592679, DELTA);

      distance = here.distanceTo(there, {type: 'feet'});
      distance.should.be.a.Number;
      distance.should.be.approximately(163.56999709209347, DELTA);

      distance = here.distanceTo(there, {type: 'degrees'});
      distance.should.be.a.Number;
      distance.should.be.approximately(0.0004483676593058972, DELTA);
    });
  });

  describe('nearFilter()', function() {
    it('should return a filter includes minDistance if where contains minDistance option', function() {
      const where = {
        location: {
          near: {
            lat: 40.77492964101182,
            lng: -73.90950187151662,
          },
          minDistance: 100,
        },
      };
      const filter = nearFilter(where);
      filter[0].key.should.equal('location');
      filter[0].should.have.properties({
        key: 'location',
        near: {
          lat: 40.77492964101182,
          lng: -73.90950187151662,
        },
        minDistance: 100,
      });
    });
  });

  describe('filter()', function() {
    it('should be able to filter geo points via minDistance', function() {
      const points = [{
        location: {
          lat: 30.283552,
          lng: 120.126048,
        },
      }, {
        location: {
          lat: 30.380307,
          lng: 119.979445,
        },
      }, {
        location: {
          lat: 30.229896,
          lng: 119.744592,
        },
      }, {
        location: {
          lat: 30.250863,
          lng: 120.129498,
        },
      }, {
        location: {
          lat: 31.244209,
          lng: 121.483687,
        },
      }];
      const filter = [{
        key: 'location',
        near: {
          lat: 30.278562,
          lng: 120.139846,
        },
        unit: 'meters',
        minDistance: 10000,
      }];
      const results = geoFilter(points, filter);
      results.length.should.be.equal(3);
    });
  });
});
