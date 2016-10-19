// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

/*!
 * Dependencies
 */
var relation = require('./relation-definition');
var RelationDefinition = relation.RelationDefinition;

module.exports = RelationMixin;

/**
 * RelationMixin class.  Use to define relationships between models.
 *
 * @class RelationMixin
 */
function RelationMixin() {
}

/**
 * Define a "one to many" relationship by specifying the model name
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
 *  // this callback is optional
 *  });
 *
 *   // Query chapters for the book
 *   book.chapters(function(err, chapters) {  // all chapters with bookId = book.id
 *     console.log(chapters);
 *   });
 *
 *   book.chapters({where: {name: 'test'}, function(err, chapters) {
 *    // All chapters with bookId = book.id and name = 'test'
 *     console.log(chapters);
 *   });
 * });
 *```
 * @param {Object|String} modelTo Model object (or String name of model) to which you are creating the relationship.
 * @options {Object} parameters Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
RelationMixin.hasMany = function hasMany(modelTo, params) {
  return RelationDefinition.hasMany(this, modelTo, params);
};

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
 * @property {String} foreignKey Name of foreign key property.
 *
 */
RelationMixin.belongsTo = function(modelTo, params) {
  return RelationDefinition.belongsTo(this, modelTo, params);
};

/**
 * A hasAndBelongsToMany relation creates a direct many-to-many connection with another model, with no intervening model.
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
 * the relation
 * @options {Object} params Configuration parameters; see below.
 * @property {String} as Name of the property in the referring model that corresponds to the foreign key field in the related model.
 * @property {String} foreignKey Property name of foreign key field.
 * @property {Object} model Model object
 */
RelationMixin.hasAndBelongsToMany = function hasAndBelongsToMany(modelTo, params) {
  return RelationDefinition.hasAndBelongsToMany(this, modelTo, params);
};

RelationMixin.hasOne = function hasOne(modelTo, params) {
  return RelationDefinition.hasOne(this, modelTo, params);
};

RelationMixin.referencesMany = function referencesMany(modelTo, params) {
  return RelationDefinition.referencesMany(this, modelTo, params);
};

RelationMixin.embedsOne = function embedsOne(modelTo, params) {
  return RelationDefinition.embedsOne(this, modelTo, params);
};

RelationMixin.embedsMany = function embedsMany(modelTo, params) {
  return RelationDefinition.embedsMany(this, modelTo, params);
};
