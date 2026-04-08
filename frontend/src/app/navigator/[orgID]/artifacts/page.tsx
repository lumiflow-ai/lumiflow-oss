"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { use, useCallback, useContext, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { fetchDeleteArtifact, useDashboard } from "@/generated/serverEndpoints";
import { DashboardContext, type Metric } from "@/generated/serverTypes";

import { useBinding, useStateObject } from "@/library/StateObject";
import { usePagination } from "@/library/usePagination";

import type { ArtifactNode } from "@/model/artifactNode";
import { decodeArtifactPathPattern, encodeArtifactSelector } from "@/model/artifactPath";

import { ContentHeader } from "@/components/ContentHeader";
import { usePresentCreateDatasetDialog } from "@/components/CreateDatasetDialog";
import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { MetricsComparisonPanel } from "@/components/MetricsComparisonPanel";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import {
  type CSVColumnDefinition,
  UploadCSVModal,
  type UploadCSVModalOnUpload,
} from "@/components/modals/UploadCSVModal";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import { Pagination } from "@/components/pagination/Pagination";
import { EvaluationDetailsSidebar } from "@/components/sidebars/EvaluationDetailsSidebar";
import {
  Button,
  type CheckboxState,
  Font,
  NavigationContent,
  NavigationStack,
  type SidebarState,
  Size,
  Toolbar,
  ToolbarItem,
} from "@/components/ui";
import { DashboardRenderer } from "@/components/WidgetRenderer";

import { invalidateContentArtifacts } from "@/app/navigator/_shared/artifacts";
import { ArtifactContext } from "@/app/navigator/_shared/context";
import { createArtifactUploadHandler, getArtifactCSVColumnDefinitions } from "@/lib/artifactCsvUpload";
import { parseCSV } from "@/lib/csvUpload";

const EmptyStateContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;

  h3 {
      font-size: ${Size.fontSize.fontSize14};
      font-weight: 400;
      font-family: ${Font.ibmPlexSans};
      line-height: 1.2;
      max-width: 300px;
      text-wrap: balance;
      text-wrap: pretty;
      margin: 0px;
    }
`}`;

const ButtonContent = styled.span`${() => css`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`}`;

const ArtifactType = (props: { searchParams: Promise<{ kind?: string }> }) => {
  const searchParams = use(props.searchParams);

  const {
    currentOrganization,
    organizationSlug,
    kindConfigurations,
    kindConfigurationForPattern,
    metricDefinitionForID,
    metricColorForID,
    canCreateArtifactWithPattern,
  } = useContext(OrganizationContext);

  const context = useContext(ArtifactContext);
  if (!context) throw new Error("Component must be used within a ArtifactContextProvider");
  const { nodesByKind, nodesByID, rootNodes, isLoading } = context;

  const presentCreateDatasetDialog = usePresentCreateDatasetDialog();

  const selectedMetricsState = useStateObject<Map<string, Metric>>(() => new Map());
  const uploadModalState = useStateObject(false);
  const [pendingDatasetName, setPendingDatasetName] = useState<string | null>(null);

  const uploadCSVColumnDefinitions = useMemo<CSVColumnDefinition[]>(
    () => getArtifactCSVColumnDefinitions({ kindConfigurationForPattern, genericArtifactName: { one: "Artifact" } }),
    [kindConfigurationForPattern],
  );

  const openUploadModal = useCallback(
    (datasetName: string) => {
      setPendingDatasetName(datasetName);
      uploadModalState.wrappedValue = true;
    },
    [uploadModalState],
  );

  const defaultKind = kindConfigurations.at(0)?.key ?? null;
  const searchKind = searchParams.kind;
  const currentKind = searchKind ?? defaultKind;
  const currentKindPattern = useMemo(() => decodeArtifactPathPattern(currentKind), [currentKind]);

  const nodes = useMemo(
    () => (currentKind ? nodesByKind.get(currentKind) : rootNodes),
    [nodesByKind, currentKind, rootNodes],
  );
  const { page, totalPages, paginatedItems, goToPage } = usePagination({ items: nodes ?? [], isLoading: isLoading });

  const dashboardRequest = useDashboard(
    currentOrganization && currentKind
      ? { orgID: currentOrganization.id, patterns: [currentKindPattern], context: DashboardContext.list }
      : undefined,
  );
  const dashboard = dashboardRequest.response?.dashboard;

  const currentSelectionState = useStateObject<ArtifactNode | null>(null);
  const [currentSelection, setCurrentSelection] = useBinding(currentSelectionState);
  const deleteDatasetDialogState = useStateObject(false);
  const [_isDeleteDatasetDialogOpen, setDeleteDatasetDialogOpen] = useBinding(deleteDatasetDialogState);
  const [artifactToDelete, setArtifactToDelete] = useState<ArtifactNode | null>(null);

  const detailSidebarState = useStateObject<SidebarState>("collapsed");
  const [currentDetailsSidebarState, setCurrentDetailsSidebarState] = useBinding(detailSidebarState);

  const navigationSidebarState = useStateObject<SidebarState>("open");
  const annotationVisibilityState = useStateObject<CheckboxState>("on");
  const [currentNavigationSidebarState, setCurrentNavigationSidebarState] = useBinding(navigationSidebarState);

  const router = useRouter();

  const onUpload: UploadCSVModalOnUpload = useCallback(
    async ({ parsed }) => {
      if (!pendingDatasetName) {
        console.error("Unable to upload artifacts: no dataset name provided");
        return;
      }

      try {
        await createArtifactUploadHandler({
          organizationID: currentOrganization?.id,
          organizationSlug,
          datasetName: pendingDatasetName,
          columnDefinitions: uploadCSVColumnDefinitions,
          router,
        })({ parsed });
      } finally {
        setPendingDatasetName(null);
      }
    },
    [currentOrganization?.id, organizationSlug, pendingDatasetName, uploadCSVColumnDefinitions, router],
  );

  const toggleNavigationSidebar = useCallback(() => {
    setCurrentNavigationSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentNavigationSidebarState]);

  const toggleDetailSidebar = useCallback(() => {
    setCurrentDetailsSidebarState((previous) => {
      if (previous === "open") return "collapsed";
      if (previous === "collapsed") return "open";
      return previous;
    });
  }, [setCurrentDetailsSidebarState]);

  const datasetDisplayName = useMemo(
    () => kindConfigurationForPattern([{ kind: "dataset" }], "one").displayName,
    [kindConfigurationForPattern],
  );
  const canCreateDataset = useMemo(
    () => canCreateArtifactWithPattern([{ kind: "dataset" }]),
    [canCreateArtifactWithPattern],
  );

  const createDataset = useCallback(async () => {
    try {
      const artifactPath = await presentCreateDatasetDialog({
        orgID: currentOrganization?.id,
        onUploadCSVRequest: openUploadModal,
      });
      if (artifactPath && organizationSlug) {
        const artifactSelector = encodeArtifactSelector({
          tags: [],
          artifactPath,
          eventSummaryIDs: [],
          generationIDs: [],
        });
        router.push(`/app/${organizationSlug}/artifacts/${artifactSelector}?annotationTip=1`);
      }
    } catch (error) {
      console.error("Couldn't create dataset!", error);
    }
  }, [presentCreateDatasetDialog, currentOrganization, organizationSlug, router, openUploadModal]);

  const uploadArtifactDisplayName = useMemo(
    () => kindConfigurationForPattern(currentKindPattern, "many").displayName,
    [kindConfigurationForPattern, currentKindPattern],
  );
  const canUploadArtifact = useMemo(
    () => canCreateArtifactWithPattern(currentKindPattern),
    [canCreateArtifactWithPattern, currentKindPattern],
  );

  const createArtifact = useCallback(() => {
    router.push(`/app/${organizationSlug}/create`);
  }, [router, organizationSlug]);

  const deleteArtifactNode = useCallback(
    async (node: ArtifactNode) => {
      if (!currentOrganization?.id || !node.artifact?.artifactPath) return;

      // 1. Unselect first - sidebar will show "No Row Selected"
      setCurrentSelection(null);

      // 2. Delete
      try {
        await fetchDeleteArtifact({
          orgID: currentOrganization.id,
          artifactPath: node.artifact.artifactPath,
          deleteSubartifacts: true,
        });

        // 3. Refresh
        await invalidateContentArtifacts(currentOrganization.id);
      } catch (error) {
        console.error("Couldn't delete artifact!", error);
      }
    },
    [currentOrganization, setCurrentSelection],
  );

  const deleteSelection = useCallback(async () => {
    if (!artifactToDelete) return;
    await deleteArtifactNode(artifactToDelete);
    setArtifactToDelete(null);
  }, [artifactToDelete, deleteArtifactNode]);

  const promptDeleteNode = useCallback(
    (node: ArtifactNode) => {
      if (!node.artifact?.artifactPath) return;
      setCurrentSelection(node);

      const isDeletingDataset = node.artifact.artifactPath.at(-1)?.kind === "dataset";
      if (isDeletingDataset) {
        setArtifactToDelete(node);
        setDeleteDatasetDialogOpen(true);
        return;
      }

      void deleteArtifactNode(node);
    },
    [deleteArtifactNode, setCurrentSelection, setDeleteDatasetDialogOpen],
  );

  const showCreateDatasetButton = canCreateDataset && currentKind === "dataset:";
  const showUploadArtifactButton = canUploadArtifact && currentKind !== "dataset:";

  const emptyState = useMemo(() => {
    if (showCreateDatasetButton) {
      return (
        <EmptyStateContainer>
          <Button size="large" prominence="primary" action={createDataset}>
            Create {datasetDisplayName}
          </Button>
          <h3>Create a dataset to organize your data.</h3>
        </EmptyStateContainer>
      );
    }
    if (showUploadArtifactButton) {
      return (
        <EmptyStateContainer>
          <Button size="large" prominence="secondary" action={createArtifact}>
            <ButtonContent>
              <Image src="/assets/adminPanel/upload-icon.svg" alt="Upload" width={20} height={20} />
              Upload {uploadArtifactDisplayName}
            </ButtonContent>
          </Button>
          <h3>Upload data to be evaluated.</h3>
        </EmptyStateContainer>
      );
    }
    return null;
  }, [
    createArtifact,
    createDataset,
    datasetDisplayName,
    showCreateDatasetButton,
    showUploadArtifactButton,
    uploadArtifactDisplayName,
  ]);

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
        <ToolbarItem title={kindConfigurationForPattern(currentKindPattern, "many").displayName} edge="center">
          <ContentHeader>
            {currentKind
              ? kindConfigurationForPattern(currentKindPattern, "many").displayName
              : isLoading
                ? "Loading Artifacts…"
                : "No Artifacts"}
          </ContentHeader>
        </ToolbarItem>
        <ToolbarItem
          title={currentDetailsSidebarState === "open" ? "Hide Details" : "Show Details"}
          icon={
            currentDetailsSidebarState === "open" ? "adminPanel/Side-bar-icon-close" : "adminPanel/Side-bar-icon-open"
          }
          action={toggleDetailSidebar}
          edge="trailing"
        />

        {showCreateDatasetButton && (
          <ToolbarItem
            title={`Create ${datasetDisplayName}`}
            variant="primary"
            action={createDataset}
            edge="trailing"
          />
        )}
        {showUploadArtifactButton && (
          <ToolbarItem
            title={`Upload ${uploadArtifactDisplayName}`}
            variant="default"
            action={createArtifact}
            edge="trailing"
          />
        )}
      </Toolbar>
      <NavigationSidebar sidebarState={navigationSidebarState} />
      <NavigationContent scrollsVertically>
        <DashboardRenderer
          dashboard={dashboard}
          currentNode={null}
          nodes={paginatedItems}
          nodesByID={nodesByID}
          currentSelectionState={currentSelectionState}
          organizationSlug={organizationSlug}
          metricDefinitionForID={metricDefinitionForID}
          metricColorForID={metricColorForID}
          kindConfigurationForPattern={kindConfigurationForPattern}
          emptyState={emptyState}
          onDeleteArtifact={promptDeleteNode}
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
        />
      </NavigationContent>
      <EvaluationDetailsSidebar
        resizeIdentifier="list-details"
        artifactNodeState={currentSelectionState}
        selectedMetricsState={selectedMetricsState}
        sidebarState={detailSidebarState}
        closesOnCollapse
        metricDefinitionForID={metricDefinitionForID}
        metricColorForID={metricColorForID}
        annotationVisibilityState={annotationVisibilityState}
      />
      <MetricsComparisonPanel
        organizationSlug={organizationSlug}
        nodesByID={nodesByID}
        selectedMetricsState={selectedMetricsState}
        commonArtifactPath={currentSelection?.artifact?.artifactPath ?? []}
        metricDefinitionForID={metricDefinitionForID}
        metricColorForID={metricColorForID}
        kindConfigurationForPattern={kindConfigurationForPattern}
      />
      <UploadCSVModal
        isPresentedState={uploadModalState}
        columnDefinitions={uploadCSVColumnDefinitions}
        parseCSV={parseCSV}
        onUpload={onUpload}
        exampleRow="Transcript_331, Golden Artifact, Lorem Ipsum, Jan 1"
      />
      <ConfirmationDialog
        isPresentedState={deleteDatasetDialogState}
        title="Delete Dataset?"
        message="Are you sure you want to delete this dataset? Deleting it will remove it and all of its artifacts. If this dataset is part of an evaluation, deleting it will affect your past evaluations. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteSelection}
      />
    </NavigationStack>
  );
};

export default ArtifactType;
