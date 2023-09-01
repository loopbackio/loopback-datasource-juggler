"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = __importDefault(require("../types"));
let stringTypeGuard;
let voidTypeGuard;
let jsonTypeGuard;
stringTypeGuard = types_1.Types.JSON('arbitrary value');
voidTypeGuard = types_1.Types.JSON(new types_1.Types.JSON('test'));
jsonTypeGuard = new types_1.Types.JSON('test');
const modelTypes = {};
types_1.default(modelTypes);
voidTypeGuard = modelTypes.registerType({});
voidTypeGuard = modelTypes.registerType({}, ['custom name 1']);
modelTypes.schemaTypes;
//# sourceMappingURL=types.spec.js.map