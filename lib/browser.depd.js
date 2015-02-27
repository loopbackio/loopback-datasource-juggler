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
