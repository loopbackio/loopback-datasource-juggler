import { ModelBuilder } from "../model-builder";
import {BuiltModelTypes} from '../types';

let modelBuilderTypeGuard: typeof ModelBuilder = ModelBuilder;
let typesTypeGuard: BuiltModelTypes;

// Test: Ensure that ModelBuilder is compliant with Types interface as
//       ...ModelBuilder inherits from Types. This is to workaround TypeScript's
//       ...inability to represent unorthodox "extending" from multiple classes.
typesTypeGuard = modelBuilderTypeGuard;
