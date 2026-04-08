import lodash from "lodash";
import { ZodEnum, type ZodEnumDef, ZodLazy, ZodLiteral, ZodObject, type ZodTypeAny, ZodUnion, z } from "zod";
import { withGetType } from "zod-to-ts";

declare module "zod" {
  interface ZodTypeDef {
    /** The original type without a reference, if available. */
    originalAPIType?: ZodType;
    typeName?: string;
  }
  // biome-ignore lint/suspicious/noExplicitAny: This any must match the definition Zod uses
  // biome-ignore lint/correctness/noUnusedVariables: These need to match the actual type.
  interface ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
    /** Generate an API-referenced object that generates as a named type rather than a deconstructed one. */
    api<T extends ZodTypeAny>(this: T, typeName: string): T;

    /** Create a copy of a zod type so the original is not modified when tinkering with internals. */
    copy<T extends ZodTypeAny>(this: T): T;
  }

  interface ZodEnum<T extends [string, ...string[]]> extends ZodType<T[number], ZodEnumDef<T>, T[number]> {
    constants(this: ZodEnum<T>): { [k in T[number]]: ZodLiteral<k> };
  }
}

let didInstall = false;

/** Install extensions to zod for OpenAPI and type generation. */
export function installAPIExtensions() {
  if (didInstall) return;
  didInstall = true;

  z.ZodType.prototype.api = function <T extends ZodTypeAny>(this: T, typeName: string): T {
    // Generate a new copy with simplified export annotations
    const result = withGetType(this.copy(), (ts) => ts.factory.createIdentifier(typeName));

    // Save the original type before adding identifiers to it. Our script will check for this before generating types.
    result._def.typeName = typeName;
    result._def.originalAPIType = this;

    return result;
  };

  z.ZodType.prototype.copy = function <T extends ZodTypeAny>(this: T): T {
    // Use different strategies to clone the zod type.
    // TODO: Check if we can get away with ZodType for all zod types.
    if (this instanceof ZodObject) return z.object(this.shape) as unknown as T;
    if (this instanceof ZodEnum) return z.enum(this.options) as unknown as T;
    if (this instanceof ZodLiteral) return z.literal(this.value) as unknown as T;
    if (this instanceof ZodLazy) return lodash.cloneDeep(this);
    if (this instanceof ZodUnion && this.options.every((option: unknown) => option instanceof ZodObject)) {
      return z.union(this.options) as unknown as T;
    }

    // Otherwise transform it. Other types may need more specific copy strategies.
    return this.transform((type) => type) as unknown as T;
  };

  z.ZodEnum.prototype.constants = function <T extends [string, ...string[]]>(
    this: ZodEnum<T>,
  ): { [k in T[number]]: ZodLiteral<string> } {
    const typeName = this._def.typeName;
    if (typeName) {
      return Object.fromEntries(
        Object.keys(this.enum).map((key) => [key as unknown, z.literal(key).api(`typeof ${typeName}.${key}`)]),
      );
    }

    return Object.fromEntries(Object.keys(this.enum).map((key) => [key as unknown, z.literal(key)]));
  };
}
