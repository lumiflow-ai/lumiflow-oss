"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";

import { fetchCreateArtifact } from "@/generated/serverEndpoints";
import type { ArtifactPathPattern } from "@/generated/serverTypes";

import { useBinding, useStateObject } from "@/library/StateObject";

import { decodeArtifactSelector, encodeArtifactPath } from "@/model/artifactPath";
import { useDatasets } from "@/model/datasets";

import { ContentHeader } from "@/components/ContentHeader";
import { usePresentCreateDatasetDialog } from "@/components/CreateDatasetDialog";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  type CSVColumnDefinition,
  UploadCSVModal,
  type UploadCSVModalOnUpload,
} from "@/components/modals/UploadCSVModal";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import {
  Button,
  CheckboxButton,
  type CheckboxState,
  Color,
  ControlContainer,
  ControlCSSMetrics,
  Font,
  isValidISOTimestamp,
  Label,
  LabeledControl,
  NavigationContent,
  NavigationStack,
  PopupButton,
  PopupDivider,
  PopupItem,
  type PopupItemActionHandler,
  type ScrollHandler,
  type SidebarState,
  Size,
  TextField,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";
import { ArtifactContext } from "@/app/navigator/_shared/context";
import { createArtifactUploadHandler, getArtifactCSVColumnDefinitions } from "@/lib/artifactCsvUpload";
import { parseCSV } from "@/lib/csvUpload";

// MARK: - Styles

const PathComponent = styled.div`${() => css`
  position: relative;
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  font-family: ${Font.ibmPlexSans};
  color: ${Color.mutedText};

  a {
    text-decoration: none;
    line-clamp: 1;
    color: ${Color.mutedText};

    &:hover {
      color: ${Color.mutedText};
    }

    &:active:hover {
      color: ${Color.mutedText};
    }
  }

  span {
    line-clamp: 1;
  }
`}`;

const LastPathComponent = styled(PathComponent)`${() => css`
  top: 28px;
  opacity: 0;
`}`;

const PathContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: ${Size.fontSize.fontSize14};
  color: black;
  padding-left: 4px;
`}`;

const Container = styled(ControlContainer)`${() => css`
  position: relative;
  box-sizing: content-box;
  display: flex;
  gap: 8px;
  flex-grow: 0.9;
  flex-direction: column;
  inset: 10px 0px 30px 0px;
  font-family: ${Font.inter};
`}`;

const HelpIcon = styled.span`${() => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  top: -1px;
  padding-top: 1px;
  margin-left: 4px;
  border-radius: 50%;
  background-color: ${Color.line};
  color: ${Color.mutedText};
  font-size: ${Size.fontSize.fontSize12};
  -webkit-user-select: none;
  position: relative;

  &::before {
    content: "?";
  }

  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 20px;
    color: ${Color.mutedText};
    outline: ${Size.line.thickness} solid ${Color.line};
    background-color: ${Color.contentSurface};
    border-radius: 4px;
    padding: 2px 8px 1px;
    font-size: ${Size.fontSize.fontSize12};
    font-weight: 400;
    white-space: nowrap;
    z-index: 1;
    pointer-events: none;
  }
`}`;

const Row = styled.div`${() => css`
  position: relative;
  display: flex;
  gap: 18px;
  padding: 0px 10px;
  flex-direction: row;
  align-items: center;
  justify-items: stretch;
  justify-content: end;

  &:has(textarea) {
    align-items: stretch;
    flex-grow: 1;
  }

  ${LabeledControl} {
    flex-grow: 1;
    flex-basis: 0px;
  }
`}`;

const DisclosureTriangle = styled.div<{ $state: "open" | "closed" }>`${({ $state }) => css`
  position: absolute;
  display: block;
  width: 16px;
  height: 16px;
  top: -1px;
  left: -8px;
  padding: 6px;
  margin: -6px;
  mask-size: 12px 12px;
  mask-position: center center;
  mask-repeat: no-repeat;
  background-color: currentcolor;
  mask-image: url(/assets/disclosure-${$state}.svg);
  cursor: pointer;

  &:hover {
    opacity: 0.7;
  }
`}`;

const DisclosureSection = styled.div<{ $isOpen: boolean }>`${({ $isOpen }) => css`
  overflow: hidden;
  transition: opacity 200ms;
  opacity: ${$isOpen ? 1 : 0};
  height: ${$isOpen ? "auto" : 0};
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  margin: -12px;

  ${
    !$isOpen &&
    css`
      visibility: hidden;
    `
  }
`}`;

const DisclosureHeader = styled.div<{ $isOpen: boolean }>`${({ $isOpen }) => css`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: ${$isOpen ? "0px 0px -4px 0px" : "5px 0px -45px 0px"};
  cursor: pointer;
  user-select: none;
  z-index: 1;

  ${Label} {
    cursor: pointer;
    padding: 0px calc(${ControlCSSMetrics.regular.controlPadding} + 1px);

    &:hover {
      color: rgba(0, 0, 0, 0.9);
    }
  }
`}`;

const CreatePage = (props: { params: Promise<{ artifactPathComponents: string[] | undefined }> }) => {
  /// Context

  const searchParams = useSearchParams();

  const { artifactPathComponents } = use(props.params);

  const { currentOrganization, kindConfigurationForPattern, genericArtifactName, organizationSlug } =
    useContext(OrganizationContext);

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { nodesByID, isLoading } = context;

  const presentCreateDatasetDialog = usePresentCreateDatasetDialog();

  const datasetPattern: ArtifactPathPattern = [{ kind: "dataset" }];
  const artifactPattern = datasetPattern.concat([{ kind: "artifact" }]);
  const inputPattern = artifactPattern.concat([{ id: "input" }]);
  const outputPattern = artifactPattern.concat([{ id: "output" }]);
  const datasetKindDisplayName = kindConfigurationForPattern(datasetPattern, "one").otherNames;
  const artifactKindDisplayName = kindConfigurationForPattern(artifactPattern, "one").otherNames;
  const inputKindDisplayName = kindConfigurationForPattern(inputPattern, "one").otherNames;
  const outputKindDisplayName = kindConfigurationForPattern(outputPattern, "one").otherNames;

  const uploadCSVColumnDefinitions = useMemo<CSVColumnDefinition[]>(
    () => getArtifactCSVColumnDefinitions({ kindConfigurationForPattern, genericArtifactName }),
    [kindConfigurationForPattern, genericArtifactName],
  );

  const suggestedParentArtifactPath = useMemo(
    () => decodeArtifactSelector(artifactPathComponents ?? []).artifactPath,
    [artifactPathComponents],
  );

  const [isWorking, setIsWorking] = useState(false);
  const createMoreState = useStateObject<CheckboxState>("off");
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const showMetadata = useMemo(() => {
    return !!searchParams.get("showMetadata");
  }, [searchParams]);

  const [defaultArtifactName, setDefaultArtifactName] = useState("");
  const [defaultArtifactID, setDefaultArtifactID] = useState(() => crypto.randomUUID());
  const [defaultArtifactTimestamp, setDefaultArtifactTimestamp] = useState(() => new Date().toISOString());

  const datasetSelectionState = useStateObject(() => encodeArtifactPath(suggestedParentArtifactPath));
  const [datasetSelection] = useBinding(datasetSelectionState);
  const artifactNameState = useStateObject("");
  const artifactInputState = useStateObject("");
  const artifactOutputState = useStateObject("");
  const artifactIDState = useStateObject(defaultArtifactID);
  const artifactTimestampState = useStateObject(defaultArtifactTimestamp);
  const artifactVariationState = useStateObject("");
  const uploadModalState = useStateObject(false);
  const [pendingDatasetName, setPendingDatasetName] = useState<string | null>(null);

  useLayoutEffect(() => {
    const datasetNode = nodesByID.get(datasetSelection)?.at(0);
    if (!datasetNode) {
      setDefaultArtifactName("");
      return;
    }
    const name = `${datasetNode.valueForKeyPaths(["metadata.name", "id"]).raw}`;

    setDefaultArtifactName(`${name} - ${datasetNode.children.size + 1}`);
  }, [nodesByID, datasetSelection]);

  const isValid = useMemo(() => {
    return (
      !!datasetSelectionState.wrappedValue &&
      isValidISOTimestamp("", artifactTimestampState.wrappedValue) &&
      !!artifactInputState.wrappedValue &&
      !!artifactOutputState.wrappedValue
    );
  }, [
    datasetSelectionState.wrappedValue,
    artifactTimestampState.wrappedValue,
    artifactInputState.wrappedValue,
    artifactOutputState.wrappedValue,
  ]);

  const allDatasets = useDatasets();

  const extraParentArtifact = useMemo(() => {
    if (suggestedParentArtifactPath.length === 0) return null;
    const encodedArtifactPath = encodeArtifactPath(suggestedParentArtifactPath);
    if (allDatasets.some((dataset) => dataset.encodedArtifactPath === encodedArtifactPath)) {
      return null;
    }
    const node = nodesByID.get(encodedArtifactPath)?.at(0);
    return {
      encodedArtifactPath,
      name: `${node?.valueForKeyPaths(["metadata.name", "id"]).raw ?? suggestedParentArtifactPath.at(-1)?.id}`,
    };
  }, [suggestedParentArtifactPath, allDatasets, nodesByID]);

  const openUploadModal = useCallback(() => {
    uploadModalState.wrappedValue = true;
  }, [uploadModalState]);

  const openUploadModalWithDatasetName = useCallback(
    (datasetName: string) => {
      setPendingDatasetName(datasetName);
      uploadModalState.wrappedValue = true;
    },
    [uploadModalState],
  );

  const createDataset: PopupItemActionHandler = useCallback(async () => {
    const datasetPath = await presentCreateDatasetDialog({
      orgID: currentOrganization?.id,
    });
    if (!datasetPath) return;
    datasetSelectionState.wrappedValue = encodeArtifactPath(datasetPath);
  }, [currentOrganization, presentCreateDatasetDialog, datasetSelectionState]);

  const shouldAskForDataset = !isLoading && allDatasets.length === 0 && currentOrganization?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit currentOrg?.id to prevent multiple triggers
  useEffect(() => {
    if (!shouldAskForDataset) return;
    (async () => {
      const datasetPath = await presentCreateDatasetDialog({
        orgID: currentOrganization?.id,
        isFirstDataset: true,
        onUploadCSVRequest: openUploadModalWithDatasetName,
      });
      if (!datasetPath) return;
      datasetSelectionState.wrappedValue = encodeArtifactPath(datasetPath);
    })();
  }, [shouldAskForDataset, presentCreateDatasetDialog, datasetSelectionState, openUploadModalWithDatasetName]);

  const router = useRouter();

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);
  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  const toggleMetadataOpen = useCallback(() => {
    setIsMetadataOpen((prev) => !prev);
  }, []);

  const sendArtifact = useCallback(async () => {
    if (!currentOrganization) return;
    setIsWorking(true);
    const dataset = datasetSelectionState.wrappedValue;
    const parentArtifactPath = decodeArtifactSelector(dataset).artifactPath;

    try {
      const name = artifactNameState.wrappedValue ? artifactNameState.wrappedValue : defaultArtifactName;
      const metadata = {
        ...(name && { name }),
        ...(artifactVariationState.wrappedValue && { variation: artifactVariationState.wrappedValue }),
      };
      const response = await fetchCreateArtifact({
        orgID: currentOrganization.id,
        parentArtifactPath,
        id: artifactIDState.wrappedValue ? artifactIDState.wrappedValue.toLowerCase() : defaultArtifactID,
        timestamp: artifactTimestampState.wrappedValue ? artifactTimestampState.wrappedValue : defaultArtifactTimestamp,
        input: artifactInputState.wrappedValue,
        output: artifactOutputState.wrappedValue,
        ...(Object.keys(metadata).length && { metadata }),
      });

      await invalidateContentArtifacts(currentOrganization.id);
      setIsWorking(false);

      if (createMoreState.wrappedValue === "off") {
        router.push(response.url);
        return;
      }

      artifactNameState.wrappedValue = "";
      artifactInputState.wrappedValue = "";
      artifactOutputState.wrappedValue = "";
      artifactIDState.wrappedValue = crypto.randomUUID();
      setDefaultArtifactID(artifactIDState.wrappedValue);
      artifactTimestampState.wrappedValue = new Date().toISOString();
      setDefaultArtifactTimestamp(artifactTimestampState.wrappedValue);
      artifactVariationState.wrappedValue = "";
    } catch (error) {
      console.error(error);
      setIsWorking(false);
    }
  }, [
    currentOrganization,
    datasetSelectionState,
    defaultArtifactName,
    artifactNameState,
    artifactInputState,
    artifactOutputState,
    artifactIDState,
    defaultArtifactID,
    artifactTimestampState,
    defaultArtifactTimestamp,
    artifactVariationState,
    router,
    createMoreState,
  ]);

  const lastPathComponent = useRef<HTMLDivElement>(null);
  const onScroll: ScrollHandler = useCallback((scrollOffset) => {
    if (lastPathComponent.current) {
      const offset = 28 - Math.min(28, Math.max(0, scrollOffset.y - 6));
      const opacity = Math.min(20, Math.max(0.001, scrollOffset.y - 14)) / 20;
      lastPathComponent.current.style.top = `${offset}px`;
      lastPathComponent.current.style.opacity = `${opacity}`;
    }
  }, []);

  const onUpload: UploadCSVModalOnUpload = useCallback(
    async ({ parsed }) => {
      const datasetPath = datasetSelectionState.wrappedValue;
      if (!datasetPath && !pendingDatasetName) {
        console.error("Unable to upload artifacts: missing dataset selection or name");
        return;
      }

      setIsWorking(true);
      try {
        await createArtifactUploadHandler({
          organizationID: currentOrganization?.id,
          organizationSlug,
          datasetPath: pendingDatasetName ? undefined : datasetPath,
          datasetName: pendingDatasetName ?? undefined,
          columnDefinitions: uploadCSVColumnDefinitions,
          router,
        })({ parsed });
      } finally {
        setIsWorking(false);
        setPendingDatasetName(null);
      }
    },
    [
      currentOrganization?.id,
      datasetSelectionState.wrappedValue,
      pendingDatasetName,
      uploadCSVColumnDefinitions,
      organizationSlug,
      router,
    ],
  );

  const title = `New ${artifactKindDisplayName.one}`;

  return (
    <NavigationStack>
      <Toolbar>
        <ToolbarItem
          title={currentNavigationSidebarState === "open" ? "Hide Navigation" : "Show Navigation"}
          icon={
            currentNavigationSidebarState === "open"
              ? "adminPanel/left-Side-bar-icon-close"
              : "adminPanel/left-Side-bar-icon-open"
          }
          action={toggleNavigationSidebar}
          edge="leading"
          ignoresSidebar
        />
        <ToolbarItem title={title} edge="leading">
          <PathContainer>
            <LastPathComponent ref={lastPathComponent}>{title}</LastPathComponent>
          </PathContainer>
        </ToolbarItem>
        <ToolbarItem title={title} edge="center">
          <ContentHeader>{title}</ContentHeader>
        </ToolbarItem>
      </Toolbar>
      <NavigationSidebar sidebarState={navigationSidebarState} />
      <NavigationContent scrollsVertically onScroll={onScroll}>
        <Container prominence="primary" isEnabled={!isWorking}>
          <Row>
            <LabeledControl>
              <Label>
                {datasetKindDisplayName.one}
                <HelpIcon
                  data-tooltip={`${datasetKindDisplayName.many ?? datasetKindDisplayName.other} organize related ${(artifactKindDisplayName.many ?? artifactKindDisplayName.other).toLowerCase()}. You need at least one to upload ${(artifactKindDisplayName.many ?? artifactKindDisplayName.other).toLowerCase()}.`}
                />
              </Label>
              <PopupButton size="large" selectionState={datasetSelectionState}>
                <PopupItem title={`Choose a ${datasetKindDisplayName.one}`} value="" />
                {(allDatasets.length > 0 || extraParentArtifact) && <PopupDivider />}
                {allDatasets.map(({ encodedArtifactPath, name }) => (
                  <PopupItem key={encodedArtifactPath} value={encodedArtifactPath} title={name} />
                ))}
                {extraParentArtifact && <PopupDivider />}
                {extraParentArtifact && (
                  <PopupItem title={extraParentArtifact.name} value={extraParentArtifact.encodedArtifactPath} />
                )}
                {(allDatasets.length > 0 || extraParentArtifact) && <PopupDivider />}
                <PopupItem title={`Create ${datasetKindDisplayName.one}…`} action={createDataset} />
              </PopupButton>
            </LabeledControl>
            <LabeledControl>
              <Label>Name</Label>
              <TextField
                valueState={artifactNameState}
                placeholder={defaultArtifactName ? defaultArtifactName : `${artifactKindDisplayName.one} Name`}
                autoCapitalize="sentences"
              />
            </LabeledControl>
          </Row>
          <Row>
            <LabeledControl>
              <Label>{inputKindDisplayName.one}</Label>
              <TextField
                valueState={artifactInputState}
                placeholder={`Paste ${inputKindDisplayName.one.toLowerCase()} here…`}
                isMultiline
              />
            </LabeledControl>
            <LabeledControl>
              <Label>{outputKindDisplayName.one}</Label>
              <TextField
                valueState={artifactOutputState}
                placeholder={`Paste ${outputKindDisplayName.one.toLowerCase()} here…`}
                isMultiline
              />
            </LabeledControl>
          </Row>
          {showMetadata && (
            <>
              <DisclosureHeader onClick={toggleMetadataOpen} $isOpen={isMetadataOpen}>
                <DisclosureTriangle $state={isMetadataOpen ? "open" : "closed"} />
                <Label>Metadata</Label>
              </DisclosureHeader>
              <DisclosureSection $isOpen={isMetadataOpen}>
                <Row>
                  <LabeledControl>
                    <Label>ID</Label>
                    <TextField valueState={artifactIDState} placeholder={defaultArtifactID} isRawValue />
                  </LabeledControl>
                  <LabeledControl>
                    <Label>Timestamp</Label>
                    <TextField
                      valueState={artifactTimestampState}
                      placeholder={defaultArtifactTimestamp}
                      isRawValue
                      validator={isValidISOTimestamp}
                    />
                  </LabeledControl>
                  <LabeledControl>
                    <Label>Variation</Label>
                    <TextField valueState={artifactVariationState} placeholder="Model/Variation ID" />
                  </LabeledControl>
                </Row>
              </DisclosureSection>
            </>
          )}
          <Row>
            {isWorking && <progress />}
            <CheckboxButton selectionState={createMoreState}>Create More</CheckboxButton>
            <Button
              action={openUploadModal}
              prominence="secondary"
              isEnabled={!isWorking && !!datasetSelectionState.wrappedValue}
            >
              Bulk upload
            </Button>
            <Button action={sendArtifact} isDangerous={true} prominence="secondary" isEnabled={!isWorking && isValid}>
              Upload {artifactKindDisplayName.one}
            </Button>
          </Row>
        </Container>
      </NavigationContent>
      <UploadCSVModal
        isPresentedState={uploadModalState}
        columnDefinitions={uploadCSVColumnDefinitions}
        onUpload={onUpload}
        parseCSV={parseCSV}
        exampleRow="Transcript_331, Golden Artifact, Lorem Ipsum, Jan 1"
      />
    </NavigationStack>
  );
};

export default CreatePage;
