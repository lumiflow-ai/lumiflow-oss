import {
  type ChangeEventHandler,
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";

import { fetchRecordRecipe } from "@/generated/serverEndpoints";
import type { OrganizationID, Recipe } from "@/generated/serverTypes";

import { useStateObject } from "@/library/StateObject";

import type { OnUploadCSVRequest } from "@/components/MetricCreationModal";
import { Button, Color, Font, ModalPanel, Size } from "@/components/ui";

import { RecipeContext } from "../contexts/RecipeContext";

// MARK: - Types

// MARK: - Constants

// MARK: - Contexts

const CreateMetricSetDialogContext = createContext({
  async presentCreateMetricSetDialog({
    orgID,
    isFirstMetricSet = false,
  }: {
    orgID: OrganizationID | undefined;
    isFirstMetricSet?: boolean;
    onUploadCSVRequest?: OnUploadCSVRequest;
  }): Promise<Recipe | null> {
    throw new Error(
      `A CreateMetricSetDialogContext must be defined. orgID: ${orgID}, isFirstMetricSet: ${isFirstMetricSet}`,
    );
  },
});

// MARK: - Hooks

export function usePresentCreateMetricSetDialog() {
  const { presentCreateMetricSetDialog } = useContext(CreateMetricSetDialogContext);
  return presentCreateMetricSetDialog;
}

// MARK: - Styles

const Title = styled.h1`${() => css`
  margin: -2px 0px;
  font-size: ${Size.fontSize.fontSize16};
  color: ${Color.textDark};
  font-weight: 500;
  line-height: 1.1;
`}`;

const Message = styled.p`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.ibmPlexSans};
  color: ${Color.textDark};
  font-weight: 400;
  line-height: 1.2;
`}`;

const Input = styled.input`${() => css`
  background-color: ${Color.surfaceOffWhite};
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 12px;
  border: none;
  border-radius: 12px;
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  color: ${Color.mutedText};
  line-height: 1.1;
  margin-top: 12px;
`}`;

const ButtonsStack = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: end;
  align-items: center;
  margin-top: 12px;
 
`}`;

const Container = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 0px;
  align-items: stretch;
  overflow-y: auto;
  max-width: 520px;
  box-sizing: border-box;
  border-radius: 16px;

`}`;

// MARK: - Components

export const CreateMetricSetDialogProvider = ({ children }: PropsWithChildren) => {
  const { refresh: refreshRecipes } = useContext(RecipeContext);

  const isModalOpenState = useStateObject(false);
  const [metricSetName, setMetricSetName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFirstMetricSet, setIsFirstMetricSet] = useState(false);
  const [uploadCSVCallback, setUploadCSVCallback] = useState<OnUploadCSVRequest | null>(null);
  const shouldShowUploadCSVButton = Boolean(uploadCSVCallback);

  const isCreateEnabled = !!metricSetName && !isProcessing;

  const inputRef = useRef<HTMLInputElement>(null);
  const presentationPromiseRef = useRef<{ resolve?: (value?: undefined) => void; reject?: (reason: unknown) => void }>(
    {},
  );

  //  Focus input when modal opens
  useEffect(() => {
    if (isModalOpenState.wrappedValue) {
      inputRef.current?.focus();
    }
  }, [isModalOpenState.wrappedValue]);

  const presentCreateMetricSetDialog = useCallback(
    async ({
      orgID,
      isFirstMetricSet = false,
      onUploadCSVRequest,
    }: {
      orgID: OrganizationID | undefined;
      isFirstMetricSet?: boolean;
      onUploadCSVRequest?: OnUploadCSVRequest;
    }): Promise<Recipe | null> => {
      if (!orgID) throw new Error("An orgID is required. The dialog will not be shown.");
      setMetricSetName("");
      setIsFirstMetricSet(isFirstMetricSet);
      setUploadCSVCallback(() => onUploadCSVRequest ?? null);
      isModalOpenState.wrappedValue = true;
      const presentationFuture = new Promise((resolve, reject) => {
        presentationPromiseRef.current = { resolve, reject };
      });
      try {
        await presentationFuture;
      } catch {
        isModalOpenState.wrappedValue = false;
        return null;
      } finally {
        presentationPromiseRef.current = {};
        setUploadCSVCallback(null);
      }

      setIsProcessing(true);

      try {
        const now = new Date().toISOString();
        const result = await fetchRecordRecipe({
          orgID,
          recipe: {
            id: crypto.randomUUID(),
            name: inputRef.current?.value ?? "Unnamed Metric Set",
            creationTimestamp: now,
            updateTimestamp: now,
            stepUpdates: [],
            triggerUpdates: [],
          },
        });
        refreshRecipes();
        return result.recipe;
      } finally {
        isModalOpenState.wrappedValue = false;
        setIsProcessing(false);
        setUploadCSVCallback(null);
      }
    },
    [isModalOpenState, refreshRecipes],
  );

  const contextValue = useMemo(() => ({ presentCreateMetricSetDialog }), [presentCreateMetricSetDialog]);

  const updateMetricSetName: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setMetricSetName(event.currentTarget.value);
  }, []);

  const cancelAction = useCallback(() => {
    if (!isModalOpenState.wrappedValue) return;
    presentationPromiseRef.current.reject?.(new Error("Metric Set creation cancelled"));
  }, [isModalOpenState]);

  const createAction = useCallback(() => {
    if (!isModalOpenState.wrappedValue) return;
    presentationPromiseRef.current.resolve?.();
  }, [isModalOpenState]);

  const handleUploadCSV = useCallback(() => {
    if (!isModalOpenState.wrappedValue || isProcessing || !uploadCSVCallback) return;
    const name = inputRef.current?.value ?? "";
    uploadCSVCallback(name);
    cancelAction();
  }, [cancelAction, isModalOpenState, isProcessing, uploadCSVCallback]);

  return (
    <CreateMetricSetDialogContext.Provider value={contextValue}>
      {children}
      <ModalPanel isPresentedState={isModalOpenState} presentation="dialog">
        <Container>
          <Title>{isFirstMetricSet ? "Create Your First Metric Set" : "Create Metric Set"}</Title>
          <Message>
            Metric sets help you group similar metrics so they can be evaluated together. Choose a name for your metric
            set so it can be easily identified.
          </Message>
          {/* TODO: Replace this with TextField. */}
          <Input
            ref={inputRef}
            placeholder="Metric Set Name"
            value={metricSetName}
            onChange={updateMetricSetName}
            disabled={isProcessing}
          />
          <ButtonsStack>
            <Button action={cancelAction} keyEquivalent="Escape">
              Cancel
            </Button>
            {shouldShowUploadCSVButton && (
              <Button action={handleUploadCSV} prominence="secondary" isEnabled={isCreateEnabled}>
                Import Metrics from CSV
              </Button>
            )}
            <Button action={createAction} keyEquivalent="Enter" isEnabled={isCreateEnabled}>
              Create new
            </Button>
          </ButtonsStack>
        </Container>
      </ModalPanel>
    </CreateMetricSetDialogContext.Provider>
  );
};
CreateMetricSetDialogProvider.displayName = "CreateMetricSetDialogProvider";
