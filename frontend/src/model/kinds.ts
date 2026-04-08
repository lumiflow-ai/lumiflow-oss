import { ArtifactNode } from "@/model/artifactNode";

function groupNodesByKindIntoMap(
  rootNode: ArtifactNode,
  children: ArtifactNode[] | IterableIterator<ArtifactNode>,
  map: Map<string, ArtifactNode>,
) {
  for (const child of children) {
    const artifactPath = child.artifact?.artifactPath;
    const localID = artifactPath?.at(-1);
    const type = localID?.kind ?? localID?.id;
    if (type) {
      const group =
        map.get(type) ??
        new ArtifactNode({
          id: type,
          parent: rootNode,
        });

      group.children.set(child._localID, child.childlessCopy);

      map.set(type, group);
    }
    groupNodesByKindIntoMap(rootNode, child.children.values(), map);
  }
}

/**
 * Group a node and its children into one sectioned by type. Note the caller must sort the results using ``orderChildren()``.
 */
export function groupNodesByKind(rootNodeOrNodes: ArtifactNode | ArtifactNode[]) {
  const rootNode = Array.isArray(rootNodeOrNodes) ? new ArtifactNode({ id: [] }) : rootNodeOrNodes.childlessCopy;
  groupNodesByKindIntoMap(
    rootNode,
    Array.isArray(rootNodeOrNodes) ? rootNodeOrNodes : rootNodeOrNodes.children.values(),
    rootNode.children,
  );
  return rootNode;
}
