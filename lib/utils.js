exports.safeRequire = safeRequire;
exports.fieldsToArray = fieldsToArray;
exports.selectFields = selectFields;
exports.removeUndefined = removeUndefined;
exports.parseSettings = parseSettings;

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
    // WARNING: [rfeng] Use map() will cause mongodb to produce invalid BSON
    return traverse(query).forEach(function (x) {
        if(x === undefined) {
            this.remove();
        }
        return x;
    });
}

var url = require('url');
var qs = require('qs');

/**
 * Parse a URL into a settings object
 * @param {String} urlStr The URL for connector settings
 * @returns {Object} The settings object
 */
function parseSettings(urlStr) {
    if(!urlStr) {
        return {};
    }
    var uri = url.parse(urlStr, false);
    var settings = {};
    settings.connector = uri.protocol && uri.protocol.split(':')[0]; // Remove the trailing :
    settings.host = settings.hostname = uri.hostname;
    settings.port = uri.port && Number(uri.port); // port is a string
    settings.user = settings.username = uri.auth && uri.auth.split(':')[0]; // <username>:<password>
    settings.password = uri.auth && uri.auth.split(':')[1];
    settings.database = uri.pathname && uri.pathname.split('/')[1];  // remove the leading /
    settings.url = urlStr;
    if(uri.query) {
        var params = qs.parse(uri.query);
        for(var p in params) {
            settings[p] = params[p];
        }
    }
    return settings;
}
