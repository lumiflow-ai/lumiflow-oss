import { useMemo } from "react";

import { type StateObject, useDerivedState } from "@/library/StateObject";

import { useDatasets } from "@/model/datasets";

import { Label, LabeledControl, PopupButton, PopupDivider, PopupItem } from "@/components/ui";

type DatasetSelectProps = {
  selectionState: StateObject<DatasetSelectState>;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
  isEnabled?: boolean;
};

export type DatasetSelectState =
  | { kind: "placeholder"; value: null; artifactCount: 0 }
  | { kind: "valid"; value: string; artifactCount: number };

const placeholderState: DatasetSelectState = { kind: "placeholder", value: null, artifactCount: 0 };

function decodeComponentSafely(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export const DatasetSelect = ({
  selectionState,
  label = "Dataset",
  placeholder = "Choose a Dataset",
  showLabel = true,
  isEnabled = true,
}: DatasetSelectProps) => {
  const datasets = useDatasets();
  const datasetArtifactCountMap = useMemo(() => {
    const artifactCountMap = new Map<string, number>();
    for (const { encodedArtifactPath, children } of datasets) {
      artifactCountMap.set(encodedArtifactPath, children);
      artifactCountMap.set(decodeComponentSafely(encodedArtifactPath), children);
    }
    return artifactCountMap;
  }, [datasets]);

  const popupSelectionState = useDerivedState<string, DatasetSelectState>(
    selectionState,
    {
      get: (selection) => selection.value ?? "",
      set: (_, newValue): DatasetSelectState => {
        if (newValue === "") {
          return placeholderState;
        }

        const artifactCount =
          datasetArtifactCountMap.get(newValue) ?? datasetArtifactCountMap.get(decodeComponentSafely(newValue));
        if (artifactCount === undefined) {
          return placeholderState;
        }

        return { kind: "valid", value: newValue, artifactCount };
      },
    },
    [datasetArtifactCountMap],
  );

  const popup = (
    <PopupButton size="large" selectionState={popupSelectionState} isEnabled={isEnabled}>
      <PopupItem title={placeholder} value="" />
      {datasets.length > 0 && <PopupDivider />}
      {datasets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ encodedArtifactPath, name }) => (
          <PopupItem key={encodedArtifactPath} value={encodedArtifactPath} title={name} />
        ))}
    </PopupButton>
  );

  if (!showLabel) {
    return popup;
  }

  return (
    <LabeledControl>
      <Label>{label}</Label>
      {popup}
    </LabeledControl>
  );
};
