import fs from "node:fs";

import { ZodEnum, ZodType } from "zod";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";

import * as types from "@/definitions";

// USAGE: tsx src/scripts/generate-types.ts <output file>
const outputFile = process.argv[2];

const results = ["// This file is generated. Do not edit."];
const zodTypes = types as unknown as Record<string, ZodType>;
for (const key of Object.keys(zodTypes)) {
  const schema = zodTypes[key];
  if (!(schema instanceof ZodType)) continue;

  let generatedType: string;
  if (schema instanceof ZodEnum) {
    const typeName = `${schema._def.typeName ?? key}`;
    const enumEntries = Object.entries(schema.enum);
    generatedType = `export const ${typeName} = {`;
    for (const [enumKey, enumValue] of enumEntries) {
      generatedType += `\n  ${enumKey}: "${enumValue}",`;
    }
    if (enumEntries.length > 0) {
      generatedType += "\n";
    }
    generatedType += "} as const;\n";
    generatedType += `export type ${typeName} = typeof ${typeName}[keyof typeof ${typeName}];`;
  } else {
    // Check for the original type if immediately available, otherwise just a type name may be emitted.
    const { node } = zodToTs(schema._def.originalAPIType ?? schema, key);
    const typeAlias = createTypeAlias(node, schema._def.typeName ?? key);
    generatedType = `export ${printNode(typeAlias).replace(/ {4}/g, "  ")}`;
  }

  results.push(generatedType);
}

fs.writeFile(outputFile, `${results.join("\n\n")}\n`, (error) => {
  if (error) {
    console.error(`Could not write to ${outputFile} (${error})`);
    process.exit(1);
  } else {
    console.log(`Successfully wrote to ${outputFile}`);
  }
});
