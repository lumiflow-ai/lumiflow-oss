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

import { fetchCreateSnapshots } from "@/generated/serverEndpoints";
import type { ArtifactPath, OrganizationID } from "@/generated/serverTypes";

import { useStateObject } from "@/library/StateObject";

import { Button, Color, Font, ModalPanel, Size } from "@/components/ui";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";

// MARK: - Types

// MARK: - Constants

// MARK: - Contexts

const CreateDatasetDialogContext = createContext({
  async presentCreateDatasetDialog({
    orgID,
    isFirstDataset = false,
  }: {
    orgID: OrganizationID | undefined;
    isFirstDataset?: boolean;
    onUploadCSVRequest?: (datasetName: string) => void;
  }): Promise<ArtifactPath | null> {
    throw new Error(`A CreateDatasetDialogContext must be defined. orgID: ${orgID}, isFirstDataset: ${isFirstDataset}`);
  },
});

// MARK: - Hooks

export function usePresentCreateDatasetDialog() {
  const { presentCreateDatasetDialog } = useContext(CreateDatasetDialogContext);
  return presentCreateDatasetDialog;
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
  border:none;
  border-radius: 12px;
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  color: ${Color.mutedText};
  line-height: 1.1;
  margin-top: 12px;
`}`;

const ButtonsOuterStack = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 18px;
  justify-content: space-between;
  margin-top: 12px;
  align-items: center;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
`}`;
const ButtonsInnerRightStack = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: end;
  align-items: center;
  
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }
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

  @media (max-width: 480px) {
    button {
      width: 100%;
    }
  }
`}`;

// MARK: - Components

export const CreateDatasetDialogProvider = ({ children }: {} & PropsWithChildren) => {
  const isModalOpenState = useStateObject(false);
  const [datasetName, setDatasetName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFirstDataset, setIsFirstDataset] = useState(false);
  const [uploadCSVCallback, setUploadCSVCallback] = useState<((datasetName: string) => void) | null>(null);
  const shouldShowUploadCSVButton = Boolean(uploadCSVCallback);

  const isCreateEnabled = !!datasetName && !isProcessing;

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

  const presentCreateDatasetDialog = useCallback(
    async ({
      orgID,
      isFirstDataset = false,
      onUploadCSVRequest,
    }: {
      orgID: OrganizationID | undefined;
      isFirstDataset?: boolean;
      onUploadCSVRequest?: (datasetName: string) => void;
    }): Promise<ArtifactPath | null> => {
      if (!orgID) throw new Error("An orgID is required. The dialog will not be shown.");
      setDatasetName("");
      setIsFirstDataset(isFirstDataset);
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
        const artifactPath = [{ kind: "dataset", id: crypto.randomUUID() }];
        await fetchCreateSnapshots({
          orgID,
          snapshots: [
            {
              artifactPath,
              sourceArtifactSelectors: [],
              eventSummaryID: crypto.randomUUID(),
              tags: {},
              metadata: { name: inputRef.current?.value ?? "" },
              metrics: [],
              generations: [],
              timestamp: new Date().toISOString(),
              content: null,
              annotations: {},
              reviews: {},
              dueDates: {},
            },
          ],
        });
        await invalidateContentArtifacts(orgID);

        return artifactPath;
      } finally {
        isModalOpenState.wrappedValue = false;
        setIsProcessing(false);
        setUploadCSVCallback(null);
      }
    },
    [isModalOpenState],
  );

  const contextValue = useMemo(() => ({ presentCreateDatasetDialog }), [presentCreateDatasetDialog]);

  const updateDatasetName: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setDatasetName(event.currentTarget.value);
  }, []);

  const cancelAction = useCallback(() => {
    if (!isModalOpenState.wrappedValue) return;
    presentationPromiseRef.current.reject?.(new Error("Dataset Creation Cancelled"));
  }, [isModalOpenState]);

  const createAction = useCallback(() => {
    if (!isModalOpenState.wrappedValue) return;
    presentationPromiseRef.current.resolve?.();
  }, [isModalOpenState]);

  const handleUploadCSV = useCallback(() => {
    if (!isModalOpenState.wrappedValue || !isCreateEnabled || !uploadCSVCallback) return;
    const name = inputRef.current?.value ?? "";
    uploadCSVCallback(name);
    cancelAction();
  }, [cancelAction, isModalOpenState, isCreateEnabled, uploadCSVCallback]);

  return (
    <CreateDatasetDialogContext.Provider value={contextValue}>
      {children}
      <ModalPanel isPresentedState={isModalOpenState} presentation="dialog">
        <Container>
          <Title>{isFirstDataset ? "Create Your First Dataset" : "Create Dataset"}</Title>
          <Message>
            {isFirstDataset && "To upload artifacts, you need a dataset. "}
            Datasets help you group artifacts for evaluation. Choose a name for your dataset so it can be easily
            identified.
          </Message>
          <Input
            ref={inputRef}
            placeholder="Dataset Name"
            value={datasetName}
            onChange={updateDatasetName}
            disabled={isProcessing}
          />
          <ButtonsOuterStack>
            <Button action={cancelAction} keyEquivalent="Escape">
              Cancel
            </Button>
            <ButtonsInnerRightStack>
              {shouldShowUploadCSVButton && (
                <Button action={handleUploadCSV} prominence="secondary" isEnabled={isCreateEnabled}>
                  Upload Data from CSV
                </Button>
              )}
              <Button action={createAction} keyEquivalent="Enter" isEnabled={isCreateEnabled}>
                Create new
              </Button>
            </ButtonsInnerRightStack>
          </ButtonsOuterStack>
        </Container>
      </ModalPanel>
    </CreateDatasetDialogContext.Provider>
  );
};
CreateDatasetDialogProvider.displayName = "CreateDatasetDialogProvider";
