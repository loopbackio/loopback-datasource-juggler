"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const date_string_1 = require("../date-string");
let stringTypeGuard;
const dateString = new date_string_1.DateString('2020-01-01');
date_string_1.DateString('2020-01-01');
date_string_1.DateString(dateString);
stringTypeGuard = dateString.toJSON().when;
stringTypeGuard = dateString.toString();
stringTypeGuard = dateString.inspect();
stringTypeGuard = dateString[util_1.inspect.custom]();
//# sourceMappingURL=date-string.spec.js.map