'use strict';
let db;

describe('model-utils', () => {
  context('coerce', () => {
    before(() => {
      // eslint-disable-next-line no-undef
      db = getSchema();
    });
    it('coerces nested properties', () => {
      const nestedModel = db.define('nestedModel', {
        rootProp: {
          numProp: Number,
          dateProp: Date,
          nestedArray: [{
            numProp: Number,
            dateProp: Date,
            arrayWithinArray: [{
              numProp: Number,
              dateProp: Date,
            }],
            objectWithinArray: {
              numProp: Number,
              dateProp: Date,
            },
          }],
          nestedObject: {
            numProp: Number,
            dateProp: Date,
            arrayWithinObject: [{
              numProp: Number,
              dateProp: Date,
            }],
            objectWithinObject: {
              numProp: Number,
              dateProp: Date,
            },
          },
        },
      });
      const dateVal = new Date().toString();
      const data = {
        rootProp: {
          numProp: '0',
          dateProp: dateVal,
          nestedArray: [{
            numProp: '1',
            dateProp: dateVal,
            arrayWithinArray: [
              {
                numProp: '2',
                dateProp: dateVal,
              },
            ],
            objectWithinArray: {
              numProp: '3',
              dateProp: dateVal,
            },
          }],
          nestedObject: {
            numProp: '5',
            dateProp: dateVal,
            arrayWithinObject: [{
              numProp: '6',
              dateProp: dateVal,
            }],
            objectWithinObject: {
              numProp: '7',
              dateProp: dateVal,
            },
          },
        },
      };
      const coercedData = nestedModel._coerce(data, {});
      assertInstanceOf(coercedData.rootProp.numProp, Number);
      assertInstanceOf(coercedData.rootProp.dateProp, Date);
      assertInstanceOf(coercedData.rootProp.nestedArray[0].numProp, Number);
      assertInstanceOf(coercedData.rootProp.nestedArray[0].dateProp, Date);
      assertInstanceOf(coercedData.rootProp.nestedArray[0].arrayWithinArray[0].numProp, Number);
      assertInstanceOf(coercedData.rootProp.nestedArray[0].arrayWithinArray[0].dateProp, Date);
      assertInstanceOf(coercedData.rootProp.nestedArray[0].objectWithinArray.numProp, Number);
      assertInstanceOf(coercedData.rootProp.nestedArray[0].objectWithinArray.dateProp, Date);
      assertInstanceOf(coercedData.rootProp.nestedObject.numProp, Number);
      assertInstanceOf(coercedData.rootProp.nestedObject.dateProp, Date);
      assertInstanceOf(coercedData.rootProp.nestedObject.objectWithinObject.numProp, Number);
      assertInstanceOf(coercedData.rootProp.nestedObject.objectWithinObject.dateProp, Date);
      assertInstanceOf(coercedData.rootProp.nestedObject.arrayWithinObject[0].numProp, Number);
      assertInstanceOf(coercedData.rootProp.nestedObject.arrayWithinObject[0].dateProp, Date);
    });
    function assertInstanceOf(val, type) {
      val.should.be.instanceOf(type);
    }
  });
});
