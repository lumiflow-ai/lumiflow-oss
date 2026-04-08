import { extendZodWithOpenApi, type ZodOpenAPIMetadata } from "@asteasolutions/zod-to-openapi";
import lodash from "lodash";
import { ZodEnum, ZodObject, type ZodTypeAny, z } from "zod";
import { withGetType } from "zod-to-ts";

declare module "zod" {
  interface ZodTypeDef {
    /** The original type without a reference, if available. */
    originalAPIType?: ZodType;
  }
  // biome-ignore lint/suspicious/noExplicitAny: This any must match the definition Zod uses
  // biome-ignore lint/correctness/noUnusedVariables: These need to match the actual type.
  interface ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {
    /** Annotate an API type that will emit to both OpenAPI and Zod-TS type generation. */
    api<T extends ZodTypeAny>(this: T, refID: string, metadata?: Partial<ZodOpenAPIMetadata<z.input<T>>>): T;

    /** Generate an API-referenced object that generates as a named type rather than a deconstructed one. */
    apiRef<T extends ZodTypeAny>(this: T): T;

    /** Create a copy of a zod type so the original is not modified when tinkering with internals. */
    copy<T extends ZodTypeAny>(this: T): T;

    /** Get the reference ID of a type, if available, or an empty string otherwise */
    getRefID(): string;
  }
}

let didInstall = false;

/** Install extensions to zod for OpenAPI and type generation. */
export function installOpenAPIExtensions() {
  if (didInstall) return;
  didInstall = true;

  extendZodWithOpenApi(z);

  z.ZodType.prototype.api = function <T extends ZodTypeAny>(
    this: T,
    refID: string,
    metadata?: Partial<ZodOpenAPIMetadata<z.input<T>>>,
  ): T {
    return this.openapi(refID, metadata).apiRef();
  };

  z.ZodType.prototype.apiRef = function <T extends ZodTypeAny>(this: T): T {
    // Grab the type name from OpenAPI if available, or stop here.
    const typeName = this._def.openapi?._internal?.refId;
    if (!typeName) return this.copy();

    // Generate a new copy with simplified export annotations
    const result = withGetType(this.copy(), (ts) => ts.factory.createIdentifier(typeName));

    // Save the original type before adding identifiers to it. Our script will check for this before generating types.
    result._def.originalAPIType = this;

    return result;
  };

  z.ZodType.prototype.copy = function <T extends ZodTypeAny>(this: T): T {
    // If we are dealing with an object or enum, clone it.
    // TODO: Check if we can get away with ZodType for all zod types.
    if (this instanceof ZodObject || this instanceof ZodEnum) {
      return lodash.cloneDeep(this);
    }

    // Otherwise transform it. Other types may need more specific copy strategies.
    return this.transform((type) => type) as unknown as T;
  };

  z.ZodType.prototype.getRefID = function (this: ZodTypeAny): string {
    return this._def.openapi?._internal?.refId ?? "";
  };
}
