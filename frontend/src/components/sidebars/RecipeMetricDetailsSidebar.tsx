import { useCallback, useContext, useLayoutEffect, useMemo } from "react";
import styled, { css } from "styled-components";

import { fetchRecordMetricDefinition, fetchRecordRecipe, getBackendURL } from "@/generated/serverEndpoints";
import {
  type CSSColor,
  type OrganizationID,
  type Recipe,
  type RecipeID,
  RecipeStepKind,
  RecipeStepStatus,
} from "@/generated/serverTypes";

import { NamedComponent } from "@/library/NamedComponent";
import { type StateObject, useBinding, useDerivedState, useStateObject } from "@/library/StateObject";

import { decodeArtifactPathPattern } from "@/model/artifactPath";
import { filterItems, type ItemNode, sortItems } from "@/model/keyPath";
import { StandardMetricColors } from "@/model/metrics";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  generateRecipeMetricID,
  isRecipeMetric,
  isRecipeMetricSet,
  RecipeContext,
  type RecipeMetric,
  type RecipeMetricSet,
  recipeMetricSetSortedByName,
  recipeMetricVisibleFilter,
} from "@/components/contexts/RecipeContext";
import { usePresentCreateMetricSetDialog } from "@/components/modals/CreateMetricSetDialog";
import {
  Button,
  Checkbox,
  type CheckboxActionHandler,
  type CheckboxState,
  Color,
  Divider,
  Font,
  Label,
  PopupButton,
  PopupDivider,
  PopupItem,
  type PopupItemActionHandler,
  Sidebar,
  type SidebarState,
  SidebarTitle,
  Size,
  TextField,
  type TextFieldSubmitHandler,
} from "@/components/ui";

// MARK: - Constants and Types

// MARK: - Styles

const Header = styled.div<{ $isToolbarVisible: boolean }>`${({ $isToolbarVisible }) => css`
  position: relative;
  display: flex;
  flex-direction: column;
  background: ${Color.contentSurface};
  padding: 20px 15px;
  gap: 6px;

  h1 {

    padding-right: ${$isToolbarVisible ? 35 : 0}px;
  }
`}`;

const ColorSwatchContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px;
  width: 156px;
`}`;

const Row = styled.div`${() => css`
  position: relative;
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: baseline;
  gap: 8px;
  border-radius: 4px;
  background: ${Color.contentSurface};

  &:has(${ColorSwatchContainer}) {
    align-items: start;

    ${Label} {
      top: 6px;
    }
  }

  ${Label} {
    width: 100px;
    flex-shrink: 0;
  }

  ${TextField} {
    width: 100%;
  }

  ${PopupButton} {
    width: 100%;
  }
`}`;

const Controls = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 15px;
  gap: 15px;
  padding: 8px 0px;
  background: ${Color.contentSurface};
`}`;

const DetailValue = styled.div`${() => css`
  flex-grow: 1;
  font-family: ${Font.ibmPlexSans};
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  color: ${Color.textDark};
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
`}`;

const NoSelectionContainer = styled.div`${() => css`
  display: flex;
  height: auto;
  padding: 40px 6px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: ${Font.inter};
  align-items: center;
  justify-content: center;
  -webkit-user-select: none;
  user-select: none;
  font-size: 17px;
  pointer-events: none;
  background: ${Color.contentSurface};
`}`;

const MetricNameTextField = styled(TextField)`${() => css`
  input,
  textarea {
    min-height: 32px;
    border-radius: 12px;
    border: none;
    background-color: ${Color.surfaceDivider};
    padding: 0px 12px;

    font-family: ${Font.ibmPlexSans};
    font-size: ${Size.fontSize.fontSize14};
    font-weight: 400;
    color: ${Color.textDark};
  }
`}`;

// MARK: - Helper Functions

function isCurrentlyNonNullState<T>(state: StateObject<T | null>): state is StateObject<T | null> & StateObject<T> {
  return state.wrappedValue !== null;
}

// MARK: - Helper Components

const ColorSwatchCheckbox = NamedComponent(
  "ColorSwatchCheckbox",
  ({
    selectedColor,
    color,
    action,
  }: {
    selectedColor: StateObject<CSSColor>;
    color: CSSColor;
    action: (newValue: CSSColor) => void;
  }) => {
    const selectionState = useDerivedState(
      selectedColor,
      {
        get(existingValue): CheckboxState {
          return existingValue === color ? "on" : "off";
        },
        set(oldValue, newValue) {
          return newValue === "on" ? color : oldValue;
        },
      },
      [color],
    );

    const checkboxAction: CheckboxActionHandler = useCallback(
      (_default, newValue) => {
        if (newValue !== "on") return;
        action(color);
      },
      [action, color],
    );

    return <Checkbox selectionState={selectionState} action={checkboxAction} color={color} showsColorWhenOff />;
  },
);

const ColorPicker = NamedComponent(
  "ColorPicker",
  ({ selectedColor, action }: { selectedColor: StateObject<CSSColor>; action: (newValue: CSSColor) => void }) => {
    return (
      <ColorSwatchContainer>
        {StandardMetricColors.map((color) => (
          <ColorSwatchCheckbox key={color} action={action} selectedColor={selectedColor} color={color} />
        ))}
      </ColorSwatchContainer>
    );
  },
);

export const NoSelectionContents = () => {
  return <NoSelectionContainer>No Row Selected</NoSelectionContainer>;
};
NoSelectionContents.displayName = "NoSelectionContents";

const RecipeMetricSetContents = ({
  recipeMetricSetSelectionState,
}: {
  recipeMetricSetSelectionState: StateObject<ItemNode<RecipeMetricSet>>;
}) => {
  /// Context

  const { currentOrganization } = useContext(OrganizationContext);
  const { refresh } = useContext(RecipeContext);

  /// State

  const [recipeMetricSetNode] = useBinding(recipeMetricSetSelectionState);
  const recipeMetricSet = recipeMetricSetNode.item;

  const metricSetNameState = useStateObject(recipeMetricSet.recipe.name);

  /// Update the controls when the metric changes externally.
  useLayoutEffect(() => {
    metricSetNameState.wrappedValue = recipeMetricSet.recipe.name;
  }, [recipeMetricSet, metricSetNameState]);

  /// Derived State

  /// Actions

  const recordMetricSetName: TextFieldSubmitHandler = useCallback(
    async (oldValue, newValue) => {
      if (!currentOrganization) return false;
      const trimmedValue = newValue.trim();
      if (oldValue === trimmedValue) return true;
      if (!trimmedValue) {
        metricSetNameState.wrappedValue = oldValue;
        return false;
      }

      await fetchRecordRecipe({
        orgID: currentOrganization.id,
        recipe: {
          id: recipeMetricSet.id,
          name: trimmedValue,
        },
      });
      await refresh();
      return true;
    },
    [currentOrganization, metricSetNameState, recipeMetricSet.id, refresh],
  );

  const handleExport = useCallback(() => {
    if (!currentOrganization?.id) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("orgID", currentOrganization.id);
    params.set("metricSetID", recipeMetricSet.id);
    window.location.assign(getBackendURL("v0.1/org/metrics/export", params));
  }, [currentOrganization?.id, recipeMetricSet.id]);

  return (
    <Controls>
      <Row>
        <Label>Display Name</Label>
        <TextField valueState={metricSetNameState} submitHandler={recordMetricSetName} />
      </Row>
      {currentOrganization && (
        <Button size="regular" action={handleExport} style={{ marginTop: "12px" }}>
          Download
        </Button>
      )}
    </Controls>
  );
};
RecipeMetricSetContents.displayName = "RecipeMetricSetContents";

const RecipeMetricContents = ({
  recipeMetricSelectionState,
}: {
  recipeMetricSelectionState: StateObject<ItemNode<RecipeMetric>>;
}) => {
  /// Context

  const { currentOrganization, kindConfigurationForPattern } = useContext(OrganizationContext);
  const { recipeMetricSetNodes, recipeMetricSetForID, recipeMetricForID, refresh } = useContext(RecipeContext);
  const presentCreateMetricSetDialog = usePresentCreateMetricSetDialog();

  /// State

  const [recipeMetricNode] = useBinding(recipeMetricSelectionState);
  const recipeMetric = recipeMetricNode.item;

  const recipeMetricSetIDSelectionState = useStateObject<RecipeID>(recipeMetric.recipe.id);
  const [recipeMetricSetIDSelection] = useBinding(recipeMetricSetIDSelectionState);
  const recipeMetricSetSelection = useMemo(
    () => recipeMetricSetForID({ recipeID: recipeMetricSetIDSelection }),
    [recipeMetricSetForID, recipeMetricSetIDSelection],
  );

  const metricNameState = useStateObject(recipeMetric.metricDefinition?.name ?? "");

  const metricColorState = useStateObject(recipeMetric.color);

  /// Update the controls when the metric changes externally.
  useLayoutEffect(() => {
    recipeMetricSetIDSelectionState.wrappedValue = recipeMetric.recipe.id;
    metricNameState.wrappedValue = recipeMetric.metricDefinition?.name ?? "";
    metricColorState.wrappedValue = recipeMetric.color;
  }, [recipeMetric, recipeMetricSetIDSelectionState, metricNameState, metricColorState]);

  /// Derived State

  const visibleRecipeMetricSets = useMemo(
    () => filterItems({ items: recipeMetricSetNodes, filter: recipeMetricVisibleFilter }),
    [recipeMetricSetNodes],
  );

  const sortedRecipeMetricSets = useMemo(
    () => sortItems({ items: visibleRecipeMetricSets, sortDescriptors: [recipeMetricSetSortedByName] }),
    [visibleRecipeMetricSets],
  );

  const affectedArtifactNames = useMemo(() => {
    return Array.from(
      new Set(
        Object.entries(recipeMetric.evaluationPaths ?? {}).flatMap(([encodedPath, isSelected]) => {
          if (!isSelected) return [];
          const artifactPattern = decodeArtifactPathPattern(`dataset:/artifact:/${encodedPath}`);
          const kindConfiguration = kindConfigurationForPattern(artifactPattern, "other");
          return [kindConfiguration.displayName];
        }),
      ),
    );
  }, [recipeMetric.evaluationPaths, kindConfigurationForPattern]);

  /// Actions

  const migrateRecipeMetric = useCallback(
    async ({
      orgID,
      sourceRecipeMetric,
      destinationRecipe,
    }: {
      orgID: OrganizationID;
      sourceRecipeMetric: RecipeMetric;
      destinationRecipe: Recipe | undefined;
    }) => {
      const newSteps = Array.from(sourceRecipeMetric.steps);
      const usedStepIDs = new Set(newSteps.map(({ id }) => id));

      const now = new Date().toISOString();
      if (destinationRecipe) {
        /// If the user chose a metric set, copy the steps to it first.
        await fetchRecordRecipe({
          orgID,
          recipe: {
            id: destinationRecipe.id,
            stepUpdates: destinationRecipe.steps.filter(({ id }) => !usedStepIDs.has(id)).concat(newSteps),
            updateTimestamp: now,
          },
        });

        await fetchRecordMetricDefinition({
          orgID,
          metricDefinition: {
            id: recipeMetric.metricID,
            group: destinationRecipe.name,
          },
        });

        /// Since the identify of the item is changing, update the ID so they match when the new value comes in from the final refresh.
        recipeMetricSelectionState.wrappedValue.id = generateRecipeMetricID({
          recipeID: destinationRecipe.id,
          metricID: sourceRecipeMetric.metricID,
        });
      } else {
        /// If the user chose None, copy the steps to a new, empty metric set first.
        const newRecipeID = crypto.randomUUID();

        await fetchRecordRecipe({
          orgID,
          recipe: {
            id: newRecipeID,
            name: "",
            creationTimestamp: now,
            updateTimestamp: now,
            stepUpdates: newSteps,
            triggerUpdates: [],
          },
        });

        await fetchRecordMetricDefinition({
          orgID,
          metricDefinition: {
            id: recipeMetric.metricID,
            group: "",
          },
        });

        /// Since the identify of the item is changing, update the ID so they match when the new value comes in from the final refresh.
        recipeMetricSelectionState.wrappedValue.id = generateRecipeMetricID({
          recipeID: newRecipeID,
          metricID: sourceRecipeMetric.metricID,
        });
      }

      /// Next, update the source metric set
      const migratedSteps = sourceRecipeMetric.recipe.steps.map((step) => {
        if (!usedStepIDs.has(step.id)) return step;
        if (step.kind !== RecipeStepKind.evaluate) return step;
        return {
          ...step,
          status: RecipeStepStatus.migrated,
        };
      });
      await fetchRecordRecipe({
        orgID,
        recipe: {
          id: sourceRecipeMetric.recipe.id,
          stepUpdates: migratedSteps,
          /// Mark the metric set as deleted
          isDeleted:
            sourceRecipeMetric.recipe.isDeleted ||
            (sourceRecipeMetric.recipe.name === "" &&
              migratedSteps.every(
                ({ status }) => status === RecipeStepStatus.migrated || status === RecipeStepStatus.hidden,
              )) ||
            undefined,
          updateTimestamp: now,
        },
      });
      await refresh();
    },
    [recipeMetric.metricID, refresh, recipeMetricSelectionState],
  );

  const recordMetricSet: PopupItemActionHandler = useCallback(
    async (oldValue, newValue) => {
      if (!currentOrganization) return;
      if (oldValue === newValue) return;
      if (newValue === null) return;

      const sourceRecipeMetric = recipeMetricForID({ recipeID: oldValue, metricID: recipeMetric.metricID });
      if (!sourceRecipeMetric) return;
      const destinationRecipeMetricSet = recipeMetricSetForID({ recipeID: newValue });

      await migrateRecipeMetric({
        orgID: currentOrganization.id,
        sourceRecipeMetric,
        destinationRecipe: destinationRecipeMetricSet?.recipe,
      });
    },
    [currentOrganization, recipeMetric.metricID, recipeMetricSetForID, recipeMetricForID, migrateRecipeMetric],
  );

  const createMetricSet: PopupItemActionHandler = useCallback(
    async (oldRecipeID) => {
      if (!currentOrganization?.id) return;
      const recipe = await presentCreateMetricSetDialog({ orgID: currentOrganization.id });
      if (!recipe) {
        recipeMetricSetIDSelectionState.wrappedValue = oldRecipeID;
        return;
      }
      recipeMetricSetIDSelectionState.wrappedValue = recipe.id;

      const sourceRecipeMetric = recipeMetricForID({ recipeID: oldRecipeID, metricID: recipeMetric.metricID });
      if (!sourceRecipeMetric) return;
      await migrateRecipeMetric({ orgID: currentOrganization.id, sourceRecipeMetric, destinationRecipe: recipe });
    },
    [
      currentOrganization,
      presentCreateMetricSetDialog,
      recipeMetricSetIDSelectionState,
      recipeMetricForID,
      recipeMetric.metricID,
      migrateRecipeMetric,
    ],
  );

  const recordMetricName: TextFieldSubmitHandler = useCallback(
    async (oldValue, newValue) => {
      if (!currentOrganization) return false;
      const trimmedValue = newValue.trim();
      if (oldValue === trimmedValue) return true;
      if (!trimmedValue) {
        metricNameState.wrappedValue = oldValue;
        return false;
      }
      metricNameState.wrappedValue = trimmedValue;

      await fetchRecordMetricDefinition({
        orgID: currentOrganization.id,
        metricDefinition: {
          id: recipeMetric.metricID,
          name: newValue,
        },
      });
      await refresh();
      return true;
    },
    [currentOrganization, metricNameState, recipeMetric.metricID, refresh],
  );

  const recordMetricColor = useCallback(
    async (newValue: CSSColor) => {
      if (!currentOrganization) return false;

      await fetchRecordMetricDefinition({
        orgID: currentOrganization.id,
        metricDefinition: {
          id: recipeMetric.metricID,
          color: newValue,
        },
      });
      await refresh();
      return true;
    },
    [currentOrganization, recipeMetric.metricID, refresh],
  );

  return (
    <Controls>
      <Row>
        <Label>Metric Set</Label>
        <PopupButton selectionState={recipeMetricSetIDSelectionState} size="regular">
          <PopupItem
            title="None"
            value={!recipeMetricSetSelection?.isVisible ? recipeMetricSetIDSelection : ""}
            action={recordMetricSet}
          />
          {sortedRecipeMetricSets.length > 0 && <PopupDivider />}
          {sortedRecipeMetricSets.map((node) => (
            <PopupItem
              key={node.id}
              value={node.item.recipe.id}
              title={node.item.recipe.name}
              action={recordMetricSet}
            />
          ))}
          <PopupDivider />
          <PopupItem title="Create Metric Set…" action={createMetricSet} />
        </PopupButton>
      </Row>
      <Row>
        <Label>Display Name</Label>
        <MetricNameTextField valueState={metricNameState} submitHandler={recordMetricName} />
      </Row>
      <Row>
        <Label>Color</Label>
        <ColorPicker selectedColor={metricColorState} action={recordMetricColor} />
      </Row>
      <Divider />
      <Row>
        <Label style={{ fontWeight: "500" }}>Evaluation Criteria</Label>
        <DetailValue>{recipeMetric.userPrompt?.trim() || "None"}</DetailValue>
      </Row>
      <Row>
        <Label>Evaluated</Label>
        <DetailValue>{affectedArtifactNames.length > 0 ? affectedArtifactNames.join(", ") : "None"}</DetailValue>
      </Row>
    </Controls>
  );
};
RecipeMetricContents.displayName = "RecipeMetricContents";

// MARK: - Component

export const RecipeMetricDetailsSidebar = ({
  resizeIdentifier,
  selectionState,
  sidebarState,
  closesOnCollapse,
}: {
  resizeIdentifier: string;
  selectionState: StateObject<ItemNode<RecipeMetric> | ItemNode<RecipeMetricSet> | null>;
  sidebarState?: StateObject<SidebarState>;
  closesOnCollapse?: boolean;
}) => {
  /// Since we allow either node type, merge them here into a single read-only binding for determining which inspector to show.
  const [selection] = useBinding(selectionState);
  const recipeMetricState = useDerivedState(selectionState, {
    get: (existingValue) => (isRecipeMetric(existingValue) ? existingValue : null),
    set: (_, newValue) => newValue,
  });
  const recipeMetricSetState = useDerivedState(selectionState, {
    get: (existingValue) => (isRecipeMetricSet(existingValue) ? existingValue : null),
    set: (_, newValue) => newValue,
  });

  return (
    <Sidebar
      resizeIdentifier={resizeIdentifier}
      position="trailing"
      style="content"
      defaultWidth={360}
      minimumWidth={304}
      maximumWidth={600}
      sidebarState={sidebarState}
      closesOnCollapse={closesOnCollapse}
    >
      {isCurrentlyNonNullState(recipeMetricState) && (
        <Header $isToolbarVisible={isCurrentlyNonNullState(recipeMetricState)}>
          <SidebarTitle>Metric Details</SidebarTitle>
          <RecipeMetricContents recipeMetricSelectionState={recipeMetricState} />
        </Header>
      )}
      {isCurrentlyNonNullState(recipeMetricSetState) && (
        <Header $isToolbarVisible={isCurrentlyNonNullState(recipeMetricSetState)}>
          <SidebarTitle>Metrics Set Details</SidebarTitle>
          <RecipeMetricSetContents recipeMetricSetSelectionState={recipeMetricSetState} />
        </Header>
      )}
      {!selection && <NoSelectionContents />}
    </Sidebar>
  );
};
RecipeMetricDetailsSidebar.displayName = "RecipeMetricDetailsSidebar";
