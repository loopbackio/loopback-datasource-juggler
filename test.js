'use strict';
const juggler = require('.');

const ds = new juggler.DataSource('memory');
ds.createModel('MyModel', {'MyProp': String});
