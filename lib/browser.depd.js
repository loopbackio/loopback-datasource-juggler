// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// A lightweight alternative to "depd" that works in the browser
module.exports = function depd(namespace) {
  var warned = {};
  return function deprecate(message) {
    if (warned[message]) return;
    warned[message] = true;

    if (process.noDeprecation) {
      return;
    } else if (process.traceDeprecation) {
      console.trace(namespace, 'deprecated', message);
    } else {
      console.warn(namespace, 'deprecated', message);
    }
  };
};
