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
    if(typeof loc.lat !== 'number') return;
    if(typeof loc.lng !== 'number') return;
    
    var d = distanceBetween(origin, loc);
    
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
      return da > db ? -1 : 1;
    } else {
      return 0;
    }
  });
}

var distanceBetween = exports.distanceBetween = function distanceBetween(a, b) {
  var xs = 0;
  var ys = 0;
  xs = a.lat - b.lat;
  xs = xs * xs;
  ys = a.lng - b.lng;
  ys = ys * ys;
  
  return Math.sqrt( xs + ys );
}