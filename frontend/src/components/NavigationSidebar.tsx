import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useLayoutEffect } from "react";
import styled, { css } from "styled-components";

import { type StateObject, useDerivedState } from "@/library/StateObject";
import useLocalStorage from "@/library/useLocalStorage";
import { useSessionManager } from "@/library/useSessionManager";
import type { WorkflowStep } from "@/library/useStepWorkflow";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  Color,
  Font,
  NavigationContent,
  PopupButton,
  PopupItem,
  Sidebar,
  type SidebarState,
  Size,
} from "@/components/ui";

import { WorkflowLine } from "@/app/navigator/[orgID]/evaluations/workflow/components/WorkflowLine";

// MARK: - Constants and Types

// MARK: - Styles

const Spacer = styled.div`${() => css`
  position: relative;
  width: auto;
  height: 30px;
  flex-shrink: 0;
  
`}`;

const List = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: -8px 0px;
  font-size: ${Size.fontSize.fontSize14};
`}`;

const CreateProjectButton = styled.button`${() => css`
  display: flex;
  align-items: center;
  text-decoration: none;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 12px;
  background: ${Color.line};
  border: ${Size.line.thickness} solid ${Color.line};
  color: ${Color.textDark};
  font-weight: 500;
  font-size: ${Size.fontSize.fontSize14};
  font-family: ${Font.inter}
  cursor: pointer;
  &:hover {
    border-color: ${Color.emphasizedLine};
  }
`}`;

const WorkflowLineContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  margin: 20px 0px 35px;
`}`;

const LineBreak = styled.hr`${() => css`
  width: 90%;
  border: none;
  border-top: 1px solid ${Color.line};
  margin: 16px 0 16px;
  align-self: center;
`}`;

const Icon = styled.div<{ $iconPath: string; $hoverIconPath: string; $collapsed?: boolean }>`${({
  $iconPath,
  $hoverIconPath,
  $collapsed,
}) => css`
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background-image: url(${$iconPath});
  background-size: 20px 20px;
  background-position: center;
  background-repeat: no-repeat;
  margin-right: ${$collapsed === false ? "0px" : "12px"};
  ${NavigationLink}[data-selected="true"] &,
  ${NavigationLink}:hover &,
  ${NavigationLink}:active:hover & {
    background-image: url(${$hoverIconPath});
  }
`}`;

const NavigationLink = styled(Link)`${() => css`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-grow: 1;
  padding: 10px 12px 10px 16px;
  color: ${Color.textDark};
  text-decoration: none;
  border-radius: 12px;
  line-height: 1.1;
  font-weight: 500;
  font-size: ${Size.fontSize.fontSize14};
  border: 1px solid transparent;
  height: 20px;
  &[data-selected="true"],
  &:hover,
  &:active:hover {
    color: ${Color.textDark};
    background: ${Color.contentSurface};
    border-color: ${Color.line};
  }
`}`;

const LogoutIcon = styled.img`${() => css`
   width: 20px;
   height: 20px;

`}`;

const LogoutButton = styled.button`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  text-align: left;
  &[data-collapsed="true"] {
    justify-content: center;
  }
  &:hover {
    color: ${Color.textDark};
  }
`}`;

const BottomSection = styled.div`${() => css`
  margin-top: auto;
  padding: 8px 12px;
  background-color: white;
  border-radius: 12px;
  display:flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`}`;

const LogoutContainer = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
`}`;

const LogoutContentContainer = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 2px;
`}`;

const LogoutText = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  color: ${Color.textDark};
`}`;

const OrgSelector = styled(PopupButton)`${() => css`
  font-size: ${Size.fontSize.fontSize16} !important;
  padding-left: 5px;

  select {
    font-size: ${Size.fontSize.fontSize16} !important;
  }
`}`;

// MARK: - Component

type NavigationSidebarProps = {
  sidebarState?: StateObject<SidebarState>;
  workflowLine?: {
    steps: Pick<WorkflowStep, "id" | "title">[];
    currentStepIndex: number;
    controls: {
      onPrevious: () => void;
      previousEnabled: boolean;
      onNext: () => void;
      nextEnabled: boolean;
      nextLabel: string;
      showRestart: boolean;
      onRestart: () => void;
      restartEnabled: boolean;
    };
  };
};

export const NavigationSidebar = ({ sidebarState, workflowLine }: NavigationSidebarProps) => {
  const { currentOrganizationState, organizations, organizationSlug } = useContext(OrganizationContext);
  const { logSessionOut } = useSessionManager();
  const currentPath = usePathname();
  const pathComponents = currentPath.split("/");
  const router = useRouter();
  const selectedOrgState = useDerivedState(
    currentOrganizationState,
    {
      get: (existingValue) => existingValue?.id ?? "",
      set: (_, newValue) => organizations.find(({ id }) => id === newValue),
    },
    [organizations],
  );

  const navigatorLink = `/app/${organizationSlug}/artifacts`;
  const metricsLink = `/app/${organizationSlug}/metrics?sets`;
  const evaluationsLink = `/app/${organizationSlug}/evaluations`;
  const evaluationWorkflowLink = `/app/${organizationSlug}/evaluations/workflow`;
  const isNavigatorLink = pathComponents.at(1) === "app" && pathComponents.at(3) === "artifacts";
  const isMetricsLink = pathComponents.at(1) === "app" && pathComponents.at(3) === "metrics";
  const isEvaluationsLink =
    pathComponents.at(1) === "app" && pathComponents.at(3) === "evaluations" && pathComponents.at(4) !== "workflow";
  const [isCollapsed, _setIsCollapsedPreference] = useLocalStorage("sidebar-collapsed-navigation", false);
  const handleCreateNewEvaluation = () => {
    if (workflowLine?.controls.onRestart && workflowLine.controls.restartEnabled) {
      workflowLine.controls.onRestart();
    }

    router.push(evaluationWorkflowLink);
  };
  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = (e: MediaQueryListEvent) => {
      _setIsCollapsedPreference(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [_setIsCollapsedPreference]);

  return (
    <Sidebar
      resizeIdentifier="navigation"
      position="leading"
      defaultWidth={260}
      minimumWidth={180}
      maximumWidth={400}
      sidebarState={sidebarState}
    >
      <NavigationContent
        scrollsVertically
        style={{ padding: "25px 10px 10px 9px", display: "flex", flexDirection: "column" }}
      >
        {!isCollapsed && organizations.length > 1 && (
          <>
            <OrgSelector size="regular" selectionState={selectedOrgState} prominence="primary">
              {organizations.map(({ id, name }) => (
                <PopupItem key={id} value={id} title={name} />
              ))}
            </OrgSelector>
            <Spacer />
          </>
        )}
        <List>
          <DatasetsNavigationLink href={navigatorLink} selected={isNavigatorLink} collapsed={isCollapsed} />
          <MetricsNavigationLink href={metricsLink} selected={isMetricsLink} collapsed={isCollapsed} />
          <EvaluationsNavigationLink href={evaluationsLink} selected={isEvaluationsLink} collapsed={isCollapsed} />
          <LineBreak />
          <CreateProjectButton onClick={handleCreateNewEvaluation}>
            <Icon
              $iconPath="/assets/adminPanel/add-circle.svg"
              $hoverIconPath="/assets/adminPanel/add-circle.svg"
              $collapsed={isCollapsed}
            />
            {!isCollapsed && "Create New Evaluation"}
          </CreateProjectButton>
          {workflowLine && (
            <WorkflowLineContainer>
              <WorkflowLine
                steps={workflowLine.steps}
                currentStepIndex={workflowLine.currentStepIndex}
                orientation="vertical"
                collapsed={isCollapsed}
              />
            </WorkflowLineContainer>
          )}
        </List>
        <BottomSection>
          {!isCollapsed ? (
            <LogoutButton onClick={logSessionOut} type="button">
              <LogoutContainer>
                <LogoutContentContainer>
                  <LogoutText>Logout</LogoutText>
                </LogoutContentContainer>
                <LogoutIcon src={"/assets/adminPanel/logout.svg"} alt="Settings" />
              </LogoutContainer>
            </LogoutButton>
          ) : (
            <LogoutButton data-collapsed="true" onClick={logSessionOut} type="button">
              <LogoutIcon src={"/assets/adminPanel/logout.svg"} alt="Settings" />
            </LogoutButton>
          )}
        </BottomSection>
      </NavigationContent>
    </Sidebar>
  );
};
NavigationSidebar.displayName = "NavigationSidebar";

const DatasetsNavigationLink = ({
  href,
  selected,
  collapsed,
}: {
  href: string;
  selected: boolean;
  collapsed?: boolean;
}) => (
  <NavigationLink href={href} data-selected={selected}>
    <Icon
      $collapsed={collapsed}
      $iconPath="/assets/adminPanel/datasets-icon.svg"
      $hoverIconPath="/assets/adminPanel/datasets-hover-icon.svg"
    />
    Datasets
  </NavigationLink>
);

const MetricsNavigationLink = ({
  href,
  selected,
  collapsed,
}: {
  href: string;
  selected: boolean;
  collapsed?: boolean;
}) => (
  <NavigationLink href={href} data-selected={selected}>
    <Icon
      $collapsed={collapsed}
      $iconPath="/assets/adminPanel/metrics-icon.svg"
      $hoverIconPath="/assets/adminPanel/metrics-hover-icon.svg"
    />
    Metrics
  </NavigationLink>
);

const EvaluationsNavigationLink = ({
  href,
  selected,
  collapsed,
}: {
  href: string;
  selected: boolean;
  collapsed?: boolean;
}) => (
  <NavigationLink href={href} data-selected={selected}>
    <Icon
      $collapsed={collapsed}
      $iconPath="/assets/adminPanel/evaluations-icon.svg"
      $hoverIconPath="/assets/adminPanel/evaluations-hover-icon.svg"
    />
    Evaluations
  </NavigationLink>
);

export const __visibleForTesting = {
  NavigationLink,
  DatasetsNavigationLink,
  MetricsNavigationLink,
  EvaluationsNavigationLink,
};
