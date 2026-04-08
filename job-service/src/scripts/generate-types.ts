import path from "node:path";

import { ZodType } from "zod";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";

import * as defs from "@/definitions";

import { typeDefFilename, typeDefPaths } from "./defs";
import { createOutputPathOrExitProcess, writeToFileOrExitProcess } from "./fileCreators";

for (const typeDefPath of typeDefPaths) {
  createOutputPathOrExitProcess(typeDefPath);
}

const results = ["// This file is generated. Do not edit. "];
const types = defs as unknown as Record<string, ZodType>;
for (const key of Object.keys(defs)) {
  const value = types[key];
  if (value instanceof ZodType) {
    const typeName = value.getRefID() || key;
    // Check for the original type if immediately available, otherwise just a type name may be emitted.
    const { node } = zodToTs(value._def.originalAPIType ?? value, key, {
      nativeEnums: "union",
    });
    const typeAlias = createTypeAlias(node, typeName);
    results.push(`export ${printNode(typeAlias)}`);
  }
}

for (const typeDefPath of typeDefPaths) {
  writeToFileOrExitProcess(path.join(typeDefPath, typeDefFilename), results.join("\n\n"));
}
