// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var assert = require('assert');

/*!
 * Get a near filter from a given where object. For connector use only.
 */

exports.nearFilter = function nearFilter(where) {
  var result = false;

  if (where && typeof where === 'object') {
    Object.keys(where).forEach(function(key) {
      var ex = where[key];

      if (ex && ex.near) {
        result = {
          near: ex.near,
          maxDistance: ex.maxDistance,
          unit: ex.unit,
          key: key,
        };
      }
    });
  }

  return result;
};

/*!
 * Filter a set of objects using the given `nearFilter`.
 */

exports.filter = function(arr, filter) {
  var origin = filter.near;
  var max = filter.maxDistance > 0 ? filter.maxDistance : false;
  var unit = filter.unit;
  var key = filter.key;

  // create distance index
  var distances = {};
  var result = [];

  arr.forEach(function(obj) {
    var loc = obj[key];

    // filter out objects without locations
    if (!loc) return;

    if (!(loc instanceof GeoPoint)) {
      loc = GeoPoint(loc);
    }

    if (typeof loc.lat !== 'number') return;
    if (typeof loc.lng !== 'number') return;

    var d = GeoPoint.distanceBetween(origin, loc, { type: unit });

    if (max && d > max) {
      // dont add
    } else {
      distances[obj.id] = d;
      result.push(obj);
    }
  });

  return result.sort(function(objA, objB) {
    var a = objA[key];
    var b = objB[key];

    if (a && b) {
      var da = distances[objA.id];
      var db = distances[objB.id];

      if (db === da) return 0;
      return da > db ? 1 : -1;
    } else {
      return 0;
    }
  });
};

exports.GeoPoint = GeoPoint;

/**
 * The GeoPoint object represents a physical location.
 *
 * For example:
 *
 * ```js
 * var loopback = require(‘loopback’);
 * var here = new loopback.GeoPoint({lat: 10.32424, lng: 5.84978});
 * ```
 *
 * Embed a latitude / longitude point in a model.
 *
 * ```js
 * var CoffeeShop = loopback.createModel('coffee-shop', {
 *   location: 'GeoPoint'
 * });
 * ```
 *
 * You can query LoopBack models with a GeoPoint property and an attached data source using geo-spatial filters and
 * sorting. For example, the following code finds the three nearest coffee shops.
 *
 * ```js
 * CoffeeShop.attachTo(oracle);
 * var here = new GeoPoint({lat: 10.32424, lng: 5.84978});
 * CoffeeShop.find( {where: {location: {near: here}}, limit:3}, function(err, nearbyShops) {
 *   console.info(nearbyShops); // [CoffeeShop, ...]
 * });
 * ```
 * @class GeoPoint
 * @property {Number} lat The latitude in degrees.
 * @property {Number} lng The longitude in degrees.
 *
 * @options {Object} Options Object with two Number properties: lat and long.
 * @property {Number} lat The latitude point in degrees. Range: -90 to 90.
 * @property {Number} lng The longitude point in degrees. Range: -180 to 180.
 *
 * @options {Array} Options Array with two Number entries: [lat,long].
 * @property {Number} lat The latitude point in degrees. Range: -90 to 90.
 * @property {Number} lng The longitude point in degrees. Range: -180 to 180.
 */

function GeoPoint(data) {
  if (!(this instanceof GeoPoint)) {
    return new GeoPoint(data);
  }

  if (arguments.length === 2) {
    data = {
      lat: arguments[0],
      lng: arguments[1],
    };
  }

  assert(
    Array.isArray(data) ||
      typeof data === 'object' ||
      typeof data === 'string',
    'must provide valid geo-coordinates array [lat, lng] or object or a ' +
      '"lat, lng" string');

  if (typeof data === 'string') {
    data = data.split(/,\s*/);
    assert(data.length === 2, 'must provide a string "lat,lng" creating a ' +
      'GeoPoint with a string');
  }
  if (Array.isArray(data)) {
    data = {
      lat: Number(data[0]),
      lng: Number(data[1]),
    };
  } else {
    data.lng = Number(data.lng);
    data.lat = Number(data.lat);
  }

  assert(typeof data === 'object', 'must provide a lat and lng object when creating a GeoPoint');
  assert(typeof data.lat === 'number' && !isNaN(data.lat), 'lat must be a number when creating a GeoPoint');
  assert(typeof data.lng === 'number' && !isNaN(data.lng), 'lng must be a number when creating a GeoPoint');
  assert(data.lng <= 180, 'lng must be <= 180');
  assert(data.lng >= -180, 'lng must be >= -180');
  assert(data.lat <= 90, 'lat must be <= 90');
  assert(data.lat >= -90, 'lat must be >= -90');

  this.lat = data.lat;
  this.lng = data.lng;
}

/**
 * Determine the spherical distance between two GeoPoints.
 *
 * @param  {GeoPoint} pointA Point A
 * @param  {GeoPoint} pointB Point B
 * @options  {Object} options Options object with one key, 'type'.  See below.
 * @property {String} type Unit of measurement, one of:
 *
 * - `miles` (default)
 * - `radians`
 * - `kilometers`
 * - `meters`
 * - `miles`
 * - `feet`
 * - `degrees`
 */

GeoPoint.distanceBetween = function distanceBetween(a, b, options) {
  if (!(a instanceof GeoPoint)) {
    a = GeoPoint(a);
  }
  if (!(b instanceof GeoPoint)) {
    b = GeoPoint(b);
  }

  var x1 = a.lat;
  var y1 = a.lng;

  var x2 = b.lat;
  var y2 = b.lng;

  return geoDistance(x1, y1, x2, y2, options);
};

/**
 * Determine the spherical distance to the given point.
 * Example:
 * ```js
 * var loopback = require(‘loopback’);
 *
 * var here = new loopback.GeoPoint({lat: 10, lng: 10});
 * var there = new loopback.GeoPoint({lat: 5, lng: 5});
 *
 * loopback.GeoPoint.distanceBetween(here, there, {type: 'miles'}) // 438
 * ```
 * @param {Object} point GeoPoint object to which to measure distance.
 * @options  {Object} options Options object with one key, 'type'.  See below.
 * @property {String} type Unit of measurement, one of:
 *
 * - `miles` (default)
 * - `radians`
 * - `kilometers`
 * - `meters`
 * - `miles`
 * - `feet`
 * - `degrees`
 */

GeoPoint.prototype.distanceTo = function(point, options) {
  return GeoPoint.distanceBetween(this, point, options);
};

/**
 * Simple serialization.
 */

GeoPoint.prototype.toString = function() {
  return this.lat + ',' + this.lng;
};

/**
 * @property {Number} DEG2RAD - Factor to convert degrees to radians.
 * @property {Number} RAD2DEG - Factor to convert radians to degrees.
 * @property {Object} EARTH_RADIUS - Radius of the earth.
*/

// factor to convert degrees to radians
var DEG2RAD = 0.01745329252;

// factor to convert radians degrees to degrees
var RAD2DEG = 57.29577951308;

// radius of the earth
var EARTH_RADIUS = {
  kilometers: 6370.99056,
  meters: 6370990.56,
  miles: 3958.75,
  feet: 20902200,
  radians: 1,
  degrees: RAD2DEG,
};

function geoDistance(x1, y1, x2, y2, options) {
  var type = (options && options.type) || 'miles';

  // Convert to radians
  x1 = x1 * DEG2RAD;
  y1 = y1 * DEG2RAD;
  x2 = x2 * DEG2RAD;
  y2 = y2 * DEG2RAD;

  // use the haversine formula to calculate distance for any 2 points on a sphere.
  // ref http://en.wikipedia.org/wiki/Haversine_formula
  var haversine = function(a) {
    return Math.pow(Math.sin(a / 2.0), 2);
  };

  var f = Math.sqrt(haversine(x2 - x1) + Math.cos(x2) * Math.cos(x1) * haversine(y2 - y1));

  return 2 * Math.asin(f) * EARTH_RADIUS[type];
}

