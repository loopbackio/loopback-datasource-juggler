import registerModelTypes, {ModelTypes, Type, Types} from '../types';

let stringTypeGuard: string;
let voidTypeGuard: void;
let jsonTypeGuard: Types.JSON;

stringTypeGuard = Types.JSON('arbitrary value');
voidTypeGuard = Types.JSON(new Types.JSON('test'));
jsonTypeGuard = new Types.JSON('test');
const modelTypes: ModelTypes = {} as ModelTypes;
registerModelTypes(modelTypes);
voidTypeGuard = modelTypes.registerType({} as Type);
voidTypeGuard = modelTypes.registerType({} as Type, ['custom name 1']);
modelTypes.schemaTypes;
