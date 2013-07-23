/**
 * Dependencies.
 */

var assert = require('assert');

/*!
 * Get a near filter from a given where object. For connector use only.
 */

exports.nearFilter = function nearFilter(where) {
  var result = false;
  
  if(where && typeof where === 'object') {
    Object.keys(where).forEach(function (key) {
      var ex = where[key];
      
      if(ex && ex.near) {
        result = {
          near: ex.near,
          maxDistance: ex.maxDistance,
          key: key
        };
      }
    });
  }
  
  return result;
}

/*!
 * Filter a set of objects using the given `nearFilter`.
 */

exports.filter = function (arr, filter) {
  var origin = filter.near;
  var max = filter.maxDistance > 0 ? filter.maxDistance : false;
  var key = filter.key;
  
  // create distance index
  var distances = {};
  var result = [];
  
  arr.forEach(function (obj) {
    var loc = obj[key];
    
    // filter out objects without locations
    if(!loc) return;
    
    if(!(loc instanceof GeoPoint)) {
      loc = GeoPoint(loc);
    }
    
    if(typeof loc.lat !== 'number') return;
    if(typeof loc.lng !== 'number') return;
    
    var d = GeoPoint.distanceBetween(origin, loc);
    
    if(max && d > max) {
      // dont add
    } else {
      distances[obj.id] = d;
      result.push(obj);
    }
  });
  
  return result.sort(function (objA, objB) {
    var a = objB[key];
    var b = objB[key];
    
    if(a && b) {
      var da = distances[objA.id];
      var db = distances[objB.id];
      
      if(db === da) return 0;
      return da > db ? 1 : -1;
    } else {
      return 0;
    }
  });
}

/**
 * Export the `GeoPoint` class.
 */

exports.GeoPoint = GeoPoint;

function GeoPoint(data) {
  if(!(this instanceof GeoPoint)) {
    return new GeoPoint(data);
  }
  
  if(typeof data === 'string') {
    data = data.split(/,\s*/);
    assert(data.length === 2, 'must provide a string "lng,lat" creating a GeoPoint with a string');
  }
  if(Array.isArray(data)) {
    data = {
      lng: Number(data[0]),
      lat: Number(data[1])
    };
  } else {
    data.lng = Number(data.lng);
    data.lat = Number(data.lat);
  }
  
  assert(typeof data === 'object', 'must provide a lat and lng object when creating a GeoPoint');
  assert(typeof data.lat === 'number', 'lat must be a number when creating a GeoPoint');
  assert(typeof data.lng === 'number', 'lng must be a number when creating a GeoPoint');
  assert(data.lng <= 180, 'lng must be <= 180');
  assert(data.lng >= -180, 'lng must be >= -180');
  assert(data.lat <= 90, 'lat must be <= 90');
  assert(data.lat >= -90, 'lat must be >= -90');
  
  this.lat = data.lat;
  this.lng = data.lng;
}

/**
 * Determine the spherical distance between two geo points.
 */

GeoPoint.distanceBetween = function distanceBetween(a, b, options) {
  if(!(a instanceof GeoPoint)) {
    a = GeoPoint(a);
  }
  if(!(b instanceof GeoPoint)) {
    b = GeoPoint(b);
  }
  
  var x1 = a.lat;
  var y1 = a.lng;
  
  var x2 = b.lat;
  var y2 = b.lng;
  
  return geoDistance(x1, y1, x2, y2, options);
}

/**
 * Determine the spherical distance to the given point.
 */

GeoPoint.prototype.distanceTo = function (point, options) {
  return GeoPoint.distanceBetween(this, point, options);
}

/**
 * Simple serialization.
 */

GeoPoint.prototype.toString = function () {
  return this.lng + ',' + this.lat;
}

/**
 * Si
 */

// ratio of a circle's circumference to its diameter
var PI = 3.1415926535897932384626433832795;

// factor to convert decimal degrees to radians
var DEG2RAD =  0.01745329252;

// factor to convert decimal degrees to radians
var RAD2DEG = 57.29577951308;

// radius of the earth
var EARTH_RADIUS = {
  kilometers: 6370.99056,
  meters: 6370990.56,
  miles: 3958.75,
  feet: 20902200,
  radians: 1,
  degrees: RAD2DEG
};

function geoDistance(x1, y1, x2, y2, options) {
  // Convert to radians
  x1 = x1 * DEG2RAD;
  y1 = y1 * DEG2RAD;
  x2 = x2 * DEG2RAD;
  y2 = y2 * DEG2RAD;

  var a = Math.pow(Math.sin(( y2-y1 ) / 2.0 ), 2);
  var b = Math.pow(Math.sin(( x2-x1 ) / 2.0 ), 2);
  var c = Math.sqrt( a + Math.cos( y2 ) * Math.cos( y1 ) * b );

  var type = (options && options.type) || 'miles';

  return 2 * Math.asin( c ) * EARTH_RADIUS[type];
}

