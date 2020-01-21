// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = HookMonitor;

function HookMonitor(opts) {
  if (!(this instanceof HookMonitor)) {
    return new HookMonitor();
  }

  this.options = opts || {};
  this.names = [];
}

HookMonitor.prototype.install = function(ObservedModel, hookNames) {
  const monitor = this;
  this.names = [];
  ObservedModel._notify = ObservedModel.notifyObserversOf;
  ObservedModel.notifyObserversOf = function(operation, context, callback) {
    if (!Array.isArray(hookNames) || hookNames.indexOf(operation) !== -1) {
      const item = monitor.options.includeModelName ?
        ObservedModel.modelName + ':' + operation :
        operation;
      monitor.names.push(item);
    }
    this._notify.apply(this, arguments);
  };
};

HookMonitor.prototype.resetNames = function() {
  this.names = [];
};
