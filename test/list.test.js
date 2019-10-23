// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('./init.js');
const List = require('../lib/list');
const parentRefHelper = require('./helpers/setup-parent-ref');
const {ModelBuilder} = require('../lib/model-builder');

const builder = new ModelBuilder(); // dummy builder instance for tests

/**
 * Phone as a class
 */
class Phone {
  constructor(label, num) {
    this.label = label;
    this.num = num;
  }

  toJSON() {
    return {
      label: this.label,
      num: this.num,
    };
  }
}

/**
 * Dummy property for testing parent reference
 * @type {ModelBuilder}
 */
Phone.modelBuilder = builder;

/**
 * Phone as a constructor function
 * @param {string} label
 * @param {number} num
 */
function PhoneCtor(label, num) {
  if (!(this instanceof PhoneCtor)) {
    return new PhoneCtor(label, num);
  }
  this.label = label;
  this.num = num;
}

/**
 * Dummy property for testing parent reference
 * @type {ModelBuilder}
 */
PhoneCtor.modelBuilder = builder;

describe('Does not break default Array functionality', function() {
  it('allows creating an empty length with a specified length', function() {
    const list = new List(4);
    list.should.be.an.instanceOf(Array);
    list.length.should.be.eql(4);
    should.not.exist(list.itemType);
    list.toJSON().should.eql([undefined, undefined, undefined, undefined]);
  });
});

describe('list of items typed by a class', function() {
  parentRefHelper(() => builder);
  it('allows itemType to be a class', function() {
    const phones = givenPhones();

    const list = new List(phones, Phone);
    list.should.be.an.instanceOf(Array);
    list.toJSON().should.be.eql(phones);
  });

  it('converts items of plain json to the itemType', function() {
    const phones = givenPhonesAsJSON();

    const list = new List(phones, Phone);
    list[0].should.be.an.instanceOf(Phone);
  });

  it('converts stringified items to the itemType', function() {
    const phones = givenPhonesAsJSON();

    const list = new List(JSON.stringify(phones), Phone);
    list[0].should.be.an.instanceOf(Phone);
  });

  it('converts items of plain json to the itemType with push', function() {
    const phones = givenPhonesAsJSON();

    const list = new List([], Phone);
    list.push(phones[0]);
    list[0].should.be.an.instanceOf(Phone);
  });

  it('should assign the list\'s parent as parent to every child element', () => {
    const phones = givenPhones();
    const listParent = {name: 'PhoneBook'};
    const list = new List(phones, Phone, listParent);
    list.forEach((listItem) => {
      listItem.should.have.property('__parent').which.equals(listParent);
    });
  });

  it('should assign the list\'s parent as element parent with push', () => {
    const phones = givenPhonesAsJSON();
    const listParent = {name: 'PhoneBook'};
    const list = new List([], Phone, listParent);
    list.push(phones[0], phones[1]);
    list.forEach((listItem) => {
      listItem.should.have.property('__parent').which.equals(listParent);
    });
  });
});

describe('list of items typed by a ctor', function() {
  parentRefHelper(() => builder);
  it('allows itemType to be a ctor', function() {
    const phones = givenPhonesWithCtor();

    const list = new List(phones, PhoneCtor);
    list.should.be.an.instanceOf(Array);
    list.toJSON().should.be.eql(phones);
  });

  it('converts items of plain json to the itemType', function() {
    const phones = givenPhonesAsJSON();

    const list = new List(phones, PhoneCtor);
    list[0].should.be.an.instanceOf(PhoneCtor);
  });

  it('converts stringified items to the itemType', function() {
    const phones = givenPhonesAsJSON();

    const list = new List(JSON.stringify(phones), PhoneCtor);
    list[0].should.be.an.instanceOf(PhoneCtor);
  });

  it('converts items of plain json to the itemType with push', function() {
    const phones = givenPhonesAsJSON();

    const list = new List([], PhoneCtor);
    list.push(phones[0]);
    list[0].should.be.an.instanceOf(PhoneCtor);
  });

  it('should assign the list\'s parent as parent to every child element', () => {
    const phones = givenPhones();
    const listParent = {name: 'PhoneBook'};
    const list = new List(phones, PhoneCtor, listParent);
    list.forEach((listItem) => {
      listItem.should.have.property('__parent').which.equals(listParent);
    });
  });

  it('should assign the list\'s parent as element parent with push', () => {
    const phones = givenPhonesAsJSON();
    const listParent = {name: 'PhoneBook'};
    const list = new List([], PhoneCtor, listParent);
    list.push(phones[0], phones[1]);
    list.forEach((listItem) => {
      listItem.should.have.property('__parent').which.equals(listParent);
    });
  });
});

function givenPhones() {
  return [
    new Phone('home', '111-222-3333'),
    new Phone('work', '111-222-5555'),
  ];
}

function givenPhonesWithCtor() {
  return [
    new PhoneCtor('home', '111-222-3333'),
    PhoneCtor('work', '111-222-5555'),
  ];
}

function givenPhonesAsJSON() {
  return [
    {label: 'home', num: '111-222-3333'},
    {label: 'work', num: '111-222-5555'},
  ];
}
