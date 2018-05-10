// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Options} from './common';
import {RelationDefinition} from './relation';
import {PersistedModelClass} from './persisted-model';

/**
 * Methods defined on this interface are mixed into a model class so that they
 * can be used to set up relations between models programmatically.
 */
export interface RelationMixin {
  /**
   * Define a "one to many" relationship by specifying the model name.
   *
   * Examples:
   * ```
   * User.hasMany(Post, {as: 'posts', foreignKey: 'authorId'});
   * ```
   *
   * ```
   * Book.hasMany(Chapter);
   * ```
   * Or, equivalently:
   * ```
   * Book.hasMany('chapters', {model: Chapter});
   * ```
   *
   * Query and create related models:
   *
   * ```js
   * Book.create(function(err, book) {
   *
   *   // Create a chapter instance ready to be saved in the data source.
   *   var chapter = book.chapters.build({name: 'Chapter 1'});
   *
   *   // Save the new chapter
   *   chapter.save();
   *
   *  // you can also call the Chapter.create method with the `chapters` property which will build a chapter
   *  // instance and save the it in the data source.
   *  book.chapters.create({name: 'Chapter 2'}, function(err, savedChapter) {
   *    // this callback is optional
   *  });
   *
   *   // Query chapters for the book
   *   book.chapters(function(err, chapters) {
   *     // all chapters with bookId = book.id
   *     console.log(chapters);
   *   });
   *
   *   // Query chapters for the book with a filter
   *   book.chapters({where: {name: 'test'}, function(err, chapters) {
   *    // All chapters with bookId = book.id and name = 'test'
   *     console.log(chapters);
   *   });
   * });
   * ```
   *
   * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
   * @options {Object} params Configuration parameters; see below.
   * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
   * @property {String} foreignKey Property name of foreign key field.
   * @property {String} polymorphic Define a polymorphic relation name.
   * @property {String} through Name of the through model.
   * @property {String} keyThrough Property name of the foreign key in the through model.
   * @property {Object|Function} scope Explicitly define additional scopes.
   * @property {Boolean} invert Specify if the relation is inverted.
   * @property {Object} model The model object.
   */
  hasMany(modelTo: PersistedModelClass, params?: Options): RelationDefinition;

  /**
   * Declare "belongsTo" relation that sets up a one-to-one connection with another model, such that each
   * instance of the declaring model "belongs to" one instance of the other model.
   *
   * For example, if an application includes users and posts, and each post can be written by exactly one user.
   * The following code specifies that `Post` has a reference called `author` to the `User` model via the `userId` property of `Post`
   * as the foreign key.
   * ```
   * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
   * ```
   * You can then access the author in one of the following styles.
   * Get the User object for the post author asynchronously:
   * ```
   * post.author(callback);
   * ```
   * Get the User object for the post author synchronously:
   * ```
   * post.author();
   * ```
   * Set the author to be the given user:
   * ```
   * post.author(user)
   * ```
   * Examples:
   *
   * Suppose the model Post has a *belongsTo* relationship with User (the author of the post). You could declare it this way:
   * ```js
   * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
   * ```
   *
   * When a post is loaded, you can load the related author with:
   * ```js
   * post.author(function(err, user) {
   *     // the user variable is your user object
   * });
   * ```
   *
   * The related object is cached, so if later you try to get again the author, no additional request will be made.
   * But there is an optional boolean parameter in first position that set whether or not you want to reload the cache:
   * ```js
   * post.author(true, function(err, user) {
   *     // The user is reloaded, even if it was already cached.
   * });
   * ```
   * This optional parameter default value is false, so the related object will be loaded from cache if available.
   *
   * @param {Class|String} modelTo Model object (or String name of model) to which you are creating the relationship.
   * @options {Object} params Configuration parameters; see below.
   * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
   * @property {String} primaryKey Property name of primary key field.
   * @property {String} foreignKey Name of foreign key property.
   * @property {Object|Function} scope Explicitly define additional scopes.
   * @property {Object} properties Properties inherited from the parent object.
   * @property {Object} options Property level options.
   * @property {Boolean} options.invertProperties Specify if the properties should be inverted.
   */
  belongsTo(modelTo: PersistedModelClass, params?: Options): RelationDefinition;

  /**
   * A hasAndBelongsToMany relation creates a direct many-to-many connection with another model, with no intervening model.
   *
   * For example, if your application includes users and groups, with each group having many users and each user appearing
   * in many groups, you could declare the models this way:
   * ```
   *  User.hasAndBelongsToMany('groups', {model: Group, foreignKey: 'groupId'});
   * ```
   *  Then, to get the groups to which the user belongs:
   * ```
   *  user.groups(callback);
   * ```
   *  Create a new group and connect it with the user:
   * ```
   *  user.groups.create(data, callback);
   * ```
   *  Connect an existing group with the user:
   * ```
   *  user.groups.add(group, callback);
   * ```
   *  Remove the user from the group:
   * ```
   *  user.groups.remove(group, callback);
   * ```
   *
   * @param {String|Object} modelTo Model object (or String name of model) to which you are creating the relationship.
   * @options {Object} params Configuration parameters; see below.
   * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
   * @property {String} foreignKey Property name of foreign key field.
   * @property {String} throughTable The table name of the through model.
   * @property {String} through Name of the through model.
   * @property {String} polymorphic Define a polymorphic relation name.
   * @property {Object|Function} scope Explicitly define additional scopes.
   * @property {Object} model The model object.
   */
  hasAndBelongsToMany(
    modelTo: PersistedModelClass,
    params?: Options,
  ): RelationDefinition;
  /**
   * Define a "one to one" relationship by specifying the model name.
   *
   * Examples:
   * ```
   * Supplier.hasOne(Account, {as: 'account', foreignKey: 'supplierId'});
   * ```
   *
   * If the target model doesn’t have a foreign key property, LoopBack will add a property with the same name.
   *
   * The type of the property will be the same as the type of the target model’s id property.
   *
   * Please note the foreign key property is defined on the target model (in this example, Account).
   *
   * If you don’t specify them, then LoopBack derives the relation name and foreign key as follows:
   *  - Relation name: Camel case of the model name, for example, for the “supplier” model the relation is “supplier”.
   *  - Foreign key: The relation name appended with Id, for example, for relation name “supplier” the default foreign key is “supplierId”.
   *
   * Build a new account for the supplier with the supplierId to be set to the id of the supplier.
   * ```js
   *  var supplier = supplier.account.build(data);
   * ```
   *
   * Create a new account for the supplier. If there is already an account, an error will be reported.
   * ```js
   * supplier.account.create(data, function(err, account) {
   *  ...
   * });
   * ```
   *
   * Find the supplier's account model.
   * ```js
   * supplier.account(function(err, account) {
   *  ...
   * });
   * ```
   *
   * Update the associated account.
   * ```js
   * supplier.account.update({balance: 100}, function(err, account) {
   *  ...
   * });
   * ```
   *
   * Remove the account for the supplier.
   * ```js
   * supplier.account.destroy(function(err) {
   *  ...
   * });
   * ```
   *
   * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
   * @options {Object} params Configuration parameters; see below.
   * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
   * @property {String} primaryKey Property name of primary key field.
   * @property {String} foreignKey Property name of foreign key field.
   * @property {String} polymorphic Define a polymorphic relation name.
   * @property {Object|Function} scope Explicitly define additional scopes.
   * @property {Object} model The model object.
   * @property {Object} properties Properties inherited from the parent object.
   * @property {Function} methods Scoped methods for the given relation.
   */
  hasOne(modelTo: PersistedModelClass, params?: Options): RelationDefinition;

  /**
 * References one or more instances of the target model.
 *
 * For example, a Customer model references one or more instances of the Account model.
 *
 * Define the relation in the model definition:
 *
 * - Definition of Customer model:
 * ```json
 * {
  "name": "Customer",
  "base": "PersistedModel",
  "idInjection": true,
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "number"
    }
  },
  "validations": [],
  "relations": {
    "accounts": {
      "type": "referencesMany",
      "model": "Account",
      "foreignKey": "accountIds",
      "options": {
        "validate": true,
        "forceId": false
      }
    }
  },
  "acls": [],
  "methods": {}
}
 * ```
 *
 * - Definition of Account model:
 * ```json
 * {
  "name": "Account",
  "base": "PersistedModel",
  "idInjection": true,
  "properties": {
    "name": {
      "type": "string"
    },
    "balance": {
      "type": "number"
    }
  },
  "validations": [],
  "relations": {},
  "acls": [],
  "methods": {}
}
 * ```
 *
 * On the bootscript, create a customer instance and for that customer instance reference many account instances.
 *
 * For example:
 * ```javascript
 * var Customer = app.models.Customer;
  var accounts = [
    {
      name: 'Checking',
      balance: 5000
    },
    {
      name: 'Saving',
      balance: 2000
    }
  ];
  Customer.create({name: 'Mary Smith'}, function(err, customer) {
    console.log('Customer:', customer);
    async.each(accounts, function(account, done) {
      customer.accounts.create(account, done);
    }, function(err) {
      console.log('Customer with accounts:', customer);
      customer.accounts(console.log);
      cb(err);
    });
  });
 * ```
 *
 * Sample referencesMany model data:
 * ```javascript
 * {
  id: 1,
  name: 'John Smith',
  accounts: [
    "saving-01", "checking-01",
  ]
}
 * ```
 *
 * Supported helper methods:
 * - customer.accounts()
 * - customer.accounts.create()
 * - customer.accounts.build()
 * - customer.accounts.findById()
 * - customer.accounts.destroy()
 * - customer.accounts.updateById()
 * - customer.accounts.exists()
 * - customer.accounts.add()
 * - customer.accounts.remove()
 * - customer.accounts.at()
 *
 * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {Any} default The default value.
 * @property {Object} options Options to specify for the relationship.
 * @property {Boolean} options.forceId Force generation of id for embedded items. Default is false.
 * @property {Boolean} options.validate Denote if the embedded items should be validated. Default is true.
 * @property {Boolean} options.persistent Denote if the embedded items should be persisted. Default is false.
 * @property {Object|Function} scope Explicitly define additional scopes.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} properties Properties inherited from the parent object.
 * @property {Function} methods Scoped methods for the given relation.
 */
  referencesMany(
    modelTo: PersistedModelClass,
    params?: Options,
  ): RelationDefinition;

  /**
 * Represent a model that embeds another model.
 *
 * For example, a Customer embeds one billingAddress from the Address model.
 *
 * - Define the relation in bootscript:
 * ```js
 * Customer.embedsOne(Address, {
 *  as: 'address', // default to the relation name - address
 *  property: 'billingAddress' // default to addressItem
 * });
 * ```
 *
 * OR, define the relation in the model definition:
 *
 * - Definition of Customer model:
 * ```json
 * {
  "name": "Customer",
  "base": "PersistedModel",
  "idInjection": true,
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "number"
    }
  },
  "validations": [],
  "relations": {
    "address": {
      "type": "embedsOne",
      "model": "Address",
      "property": "billingAddress",
      "options": {
        "validate": true,
        "forceId": false
      }
    }
  },
  "acls": [],
  "methods": {}
}
 * ```
 *
 * - Definition of Address model:
 * ```json
 * {
  "name": "Address",
  "base": "Model",
  "idInjection": true,
  "properties": {
    "street": {
      "type": "string"
    },
    "city": {
      "type": "string"
    },
    "state": {
      "type": "string"
    },
    "zipCode": {
      "type": "string"
    }
  },
  "validations": [],
  "relations": {},
  "acls": [],
  "methods": {}
}
 * ```
 *
 * Sample embedded model data:
 * ```javascript
 * {
  id: 1,
  name: 'John Smith',
  billingAddress: {
    street: '123 Main St',
    city: 'San Jose',
    state: 'CA',
    zipCode: '95124'
  }
}
 * ```
 *
 * Supported helper methods:
 * - customer.address()
 * - customer.address.build()
 * - customer.address.create()
 * - customer.address.update()
 * - customer.address.destroy()
 * - customer.address.value()
 *
 * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} property Name of the property for the embedded item.
 * @property {Any} default The default value.
 * @property {Object} options Options to specify for the relationship.
 * @property {Boolean} options.forceId Force generation of id for embedded items. Default is false.
 * @property {Boolean} options.validate Denote if the embedded items should be validated. Default is true.
 * @property {Boolean} options.persistent Denote if the embedded items should be persisted. Default is false.
 * @property {Object|Function} scope Explicitly define additional scopes.
 * @property {Object} properties Properties inherited from the parent object.
 * @property {Function} methods Scoped methods for the given relation.
 */
  embedsOne(modelTo: PersistedModelClass, params?: Options): RelationDefinition;

  /**
 * Represent a model that can embed many instances of another model.
 *
 * For example, a Customer can have multiple email addresses and each email address is a complex object that contains label and address.
 *
 * Define the relation code in bootscript:
 * ```javascript
  Customer.embedsMany(EmailAddress, {
    as: 'emails', // default to the relation name - emailAddresses
    property: 'emailList' // default to emailAddressItems
  });
 * ```
 *
 * OR, define the relation in the model definition:
 *
 * - Definition of Customer model:
 * ```json
 * {
  "name": "Customer",
  "base": "PersistedModel",
  "idInjection": true,
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "number"
    }
  },
  "validations": [],
  "relations": {
    "emails": {
      "type": "embedsMany",
      "model": "EmailAddress",
      "property": "emailList",
      "options": {
        "validate": true,
        "forceId": false
      }
    }
  },
  "acls": [],
  "methods": {}
}
 * ```
 *
 * - Definition of EmailAddress model:
 * ```json
 * {
  "name": "EmailAddress",
  "base": "Model",
  "idInjection": true,
  "properties": {
    "label": {
      "type": "string"
    },
    "address": {
      "type": "string"
    }
  },
  "validations": [],
  "relations": {},
  "acls": [],
  "methods": {}
}
 * ```
 *
 * Sample embedded model data:
 * ```javascript
 * {
  id: 1,
  name: 'John Smith',
  emails: [{
    label: 'work',
    address: 'john@xyz.com'
  }, {
    label: 'home',
    address: 'john@gmail.com'
  }]
}
 * ```
 *
 * Supported helper methods:
 * - customer.emails()
 * - customer.emails.create()
 * - customer.emails.build()
 * - customer.emails.findById()
 * - customer.emails.destroyById()
 * - customer.emails.updateById()
 * - customer.emails.exists()
 * - customer.emails.add()
 * - customer.emails.remove()
 * - customer.emails.at()
 * - customer.emails.value()
 *
 * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} property Name of the property for the embedded item.
 * @property {Any} default The default value.
 * @property {Object} options Options to specify for the relationship.
 * @property {Boolean} options.forceId Force generation of id for embedded items. Default is false.
 * @property {Boolean} options.validate Denote if the embedded items should be validated. Default is true.
 * @property {Boolean} options.persistent Denote if the embedded items should be persisted. Default is false.
 * @property {String} polymorphic Define a polymorphic relation name.
 * @property {Object|Function} scope Explicitly define additional scopes.
 * @property {Object} properties Properties inherited from the parent object.
 * @property {Function} methods Scoped methods for the given relation.
 */
  embedsMany(
    modelTo: PersistedModelClass,
    params?: Options,
  ): RelationDefinition;
}
