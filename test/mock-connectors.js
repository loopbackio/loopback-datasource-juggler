// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
module.exports = {

  // connector which uses custom field settings
  customFieldSettings: {
    initialize: function(ds, done) {
      ds.connector = {
        name: 'custom',
        discoverModelProperties: function(resource, options, done) {
          done(null, [
            {
              owner: 'public',
              columnName: 'name',
              type: 'String',
              required: false,

              // custom properties listed under a key matching the connector name
              custom: {storage: 'quantum'},
            },
          ]);
        },
      };
      ds.connector.dataSource = ds;
    },
  },

};
