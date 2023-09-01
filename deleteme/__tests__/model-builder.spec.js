"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const model_builder_1 = require("../model-builder");
let modelBuilderTypeGuard = model_builder_1.ModelBuilder;
let typesTypeGuard;
// Test: Ensure that ModelBuilder is compliant with Types interface as
//       ...ModelBuilder inherits from Types. This is to workaround TypeScript's
//       ...inability to represent unorthodox "extending" from multiple classes.
typesTypeGuard = modelBuilderTypeGuard;
//# sourceMappingURL=model-builder.spec.js.map