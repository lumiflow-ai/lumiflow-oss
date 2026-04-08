import { isEqual } from "lodash";
import {
  createContext,
  type Dispatch,
  type MouseEventHandler,
  type SetStateAction,
  useCallback,
  useContext,
} from "react";

import useLocalStorage from "@/library/useLocalStorage";

import type { ArtifactNode } from "@/model/artifactNode";
import type { SortDescriptor } from "@/model/keyPath";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";

import { useContentArtifacts, useContentArtifactTree, useOrderedContentArtifactTree } from "./artifacts";

type ArtifactContextType = {
  handleSortingChange: MouseEventHandler<HTMLElement>;
  tree: Map<string, ArtifactNode>;
  nodesByID: Map<string, ArtifactNode[]>;
  nodesByKind: Map<string, ArtifactNode[]>;
  rootNodes: ArtifactNode[];
  orderedTree: ArtifactNode[];
  sortDescriptors: SortDescriptor[];
  setSortDescriptors: Dispatch<SetStateAction<SortDescriptor[]>>;
  isLoading: boolean;
};

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined);

export const ArtifactContextProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    currentOrganization,
    isLoading: isLoadingOrnanizations,
    kindConfigurationForPattern,
    metricDefinitionForID,
  } = useContext(OrganizationContext);

  const contentArtifacts = useContentArtifacts(currentOrganization?.id);
  const { tree, nodesByID, nodesByKind, rootNodes } = useContentArtifactTree(contentArtifacts.response);

  const [sortDescriptors, setSortDescriptors] = useLocalStorage<SortDescriptor[]>("sortDescriptors", [
    { keyPaths: ["id"], order: "ascending" },
  ]);

  const handleSortingChange: MouseEventHandler<HTMLElement> = useCallback(
    (event) => {
      const keyPaths = (JSON.parse(event.currentTarget.dataset.sortKey ?? "") as string[]) ?? ["id"];

      setSortDescriptors((previous) => {
        const currentSortDescriptor = previous[0];
        let order = currentSortDescriptor.order;
        if (isEqual(keyPaths, currentSortDescriptor.keyPaths)) {
          order = order === "ascending" ? "descending" : "ascending";
        }

        const newDescriptors: SortDescriptor[] = [{ keyPaths, order }];
        for (const previousDescriptor of previous) {
          /// If the sort descriptor is a legacy one, ignore it.
          if (!previousDescriptor.keyPaths) continue;

          /// Skip any descriptors that match the current one.
          if (isEqual(previousDescriptor.keyPaths, keyPaths)) continue;

          newDescriptors.push(previousDescriptor);
        }

        return newDescriptors;
      });
    },
    [setSortDescriptors],
  );

  const orderedTree = useOrderedContentArtifactTree({
    tree,
    sortDescriptors,
    activeEventSummaryID: null,
    metricDefinitionForID,
    kindConfigurationForPattern,
  });

  return (
    <ArtifactContext.Provider
      value={{
        isLoading: isLoadingOrnanizations || contentArtifacts.isLoading,
        handleSortingChange,
        tree,
        orderedTree,
        sortDescriptors,
        setSortDescriptors,
        nodesByID,
        nodesByKind,
        rootNodes,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  );
};
