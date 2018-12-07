// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('./init.js');
const List = require('../lib/list');

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

describe('list of items typed by a class', function() {
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
});

describe('list of items typed by a ctor', function() {
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
