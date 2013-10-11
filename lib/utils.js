exports.safeRequire = safeRequire;
exports.fieldsToArray = fieldsToArray;
exports.selectFields = selectFields;
exports.removeUndefined = removeUndefined;

var traverse = require('traverse');

function safeRequire(module) {
    try {
        return require(module);
    } catch (e) {
        console.log('Run "npm install loopback-datasource-juggler ' + module + '" command to use loopback-datasource-juggler using ' + module + ' database engine');
        process.exit(1);
    }
}

function fieldsToArray(fields, properties) {
    if(!fields) return;
  
    // include all properties by default
    var result = properties;
  
    if(typeof fields === 'string') {
      return [fields];
    }
  
    if (Array.isArray(fields) && fields.length > 0) {
        // No empty array, including all the fields
        return fields;
    }
  
    if ('object' === typeof fields) {
        // { field1: boolean, field2: boolean ... }
        var included = [];
        var excluded = [];
        var keys = Object.keys(fields);
        if(!keys.length) return;
        
        keys.forEach(function (k) {
            if (fields[k]) {
                included.push(k);
            } else if ((k in fields) && !fields[k]) {
                excluded.push(k);
            }
        });
        if (included.length > 0) {
            result = included;
        } else if (excluded.length > 0) {
            excluded.forEach(function (e) {
                var index = result.indexOf(e);
                result.splice(index, 1);
            });
        }
    }
    
    return result;
}

function selectFields(fields) {
  // map function
  return function (obj) {
    var result = {};
    var key;
    
    for (var i = 0; i < fields.length; i++) {
      key = fields[i];
      
      result[key] = obj[key];
    }
    return result;
  }
}

/**
 * Remove undefined values from the queury object
 * @param query
 * @returns {exports.map|*}
 */
function removeUndefined(query) {
    if(typeof query !== 'object' || query === null) {
        return query;
    }
    return traverse(query).map(function (x) {
        if(x === undefined) {
            this.remove();
        }
        return x;
    });
}
