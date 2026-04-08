import type { RenderedContent } from "@/generated/serverTypes";

import { isPrimitiveValue, type KeyPathValuePair } from "@/model/keyPath";

function enumerateContentRecursively(
  startIndex: number,
  prefix: string | null,
  content: RenderedContent,
): KeyPathValuePair[] {
  let index = startIndex;
  if (isPrimitiveValue(content)) return [{ index, key: prefix, value: content }];

  if (prefix) {
    return Object.entries(content).flatMap(([key, value]) => {
      const children = enumerateContentRecursively(index, `${prefix}.${key}`, value);
      index += children.length;
      return children;
    });
  }
  return Object.entries(content).flatMap(([key, value]) => {
    const children = enumerateContentRecursively(index, `${key}`, value);
    index += children.length;
    return children;
  });
}

export function enumerateContent(content: RenderedContent): KeyPathValuePair[] {
  return enumerateContentRecursively(0, null, content);
}
