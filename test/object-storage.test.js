'use strict';
var assert = require('assert');
var DataSource = require('..').DataSource;

describe('object-storage connector', function() {
  it('should be set up properly', function() {
    var ds = new DataSource({connector: 'object-storage'});
    assert.equal(ds.name, 'loopback-component-storage');
    assert.equal(ds.settings.connector, 'loopback-component-storage');
    assert.equal(ds.settings.provider, 'openstack');
    assert.equal(ds.settings.useServiceCatalog, true);
    assert.equal(ds.settings.useInternal, false);
    assert.equal(ds.settings.keystoneAuthVersion, 'v3');
  });
});
