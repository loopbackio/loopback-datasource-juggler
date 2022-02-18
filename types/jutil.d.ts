export type InheritsOptions = {
    staticProperties?: boolean,
    override?: boolean,
}

export type MixinOptions = InheritsOptions & {
    instanceProperties?: boolean,
    proxyFunctions?: boolean,
}

export function inherits<T extends object>(newClass: T, baseClass: object, options: InheritsOptions): T;

export function mixin<T extends object>(newClass: T, mixinClass: object, options: MixinOptions): T;
