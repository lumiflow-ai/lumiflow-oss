import { useContext, useMemo } from "react";

import { sortItems } from "@/model/keyPath";

import { ArtifactContext } from "@/app/navigator/_shared/context";

export const useDatasets = () => {
  const context = useContext(ArtifactContext);
  if (!context) throw new Error("useDatasets must be used within an ArtifactContextProvider");
  const { nodesByKind } = context;

  return useMemo(() => {
    return sortItems({
      items: nodesByKind.get("dataset:") ?? [],
      sortDescriptors: [{ keyPaths: ["metadata.name", "id"], order: "ascending" }],
    }).map((node) => ({
      encodedArtifactPath: node.id,
      name: `${node.valueForKeyPaths(["metadata.name", "id"]).raw}`,
      children: node.children.size,
    }));
  }, [nodesByKind]);
};
