'use strict';

const assert = require('assert');

/**
 * Helper function that when called should return the current instance of the modelBuilder
 * @param {function: ModelBuilder} getBuilder
 */
const createTestSetupForParentRef = (getBuilder) => {
  assert.strictEqual(typeof getBuilder, 'function', 'Missing getter function for model builder');
  const settingProperty = 'parentRef';
  beforeEach('enabling parentRef for given modelBuilder', () => {
    const modelBuilder = getBuilder();
    assert(modelBuilder && typeof modelBuilder === 'object', 'Invalid modelBuilder instance');
    modelBuilder.settings[settingProperty] = true;
  });
  afterEach('Disabling parentRef for given modelBuilder', () => {
    const modelBuilder = getBuilder();
    assert(modelBuilder && typeof modelBuilder === 'object', 'Invalid modelBuilder instance');
    modelBuilder.settings[settingProperty] = false;
  });
};

module.exports = createTestSetupForParentRef;
