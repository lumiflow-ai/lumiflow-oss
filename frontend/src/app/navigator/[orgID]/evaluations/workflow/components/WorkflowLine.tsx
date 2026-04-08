"use client";

import { Fragment } from "react";
import styled, { css } from "styled-components";

import type { WorkflowStep } from "@/library/useStepWorkflow";

import { Color, Size } from "@/components/ui";

export type WorkflowLineOrientation = "horizontal" | "vertical";

const Line = styled.div<{ $orientation: WorkflowLineOrientation }>`
${({ $orientation }) => css`
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
  ${
    $orientation === "vertical"
      ? css`
        flex-direction: column;
        align-items: flex-start;
        overflow-x: hidden;
        overflow-y: auto;
      `
      : css`
        flex-direction: row;
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
      `
  }
`}`;

const StepItem = styled.div<{ $collapsed?: boolean }>`${({ $collapsed }) => css`
  display: flex;
  padding: 0px 16px;
  gap: ${$collapsed ? "0" : "12px"};
  align-items: center;
  position: relative;
  flex-direction: ${$collapsed ? "column" : "row"};
`}`;

const Stop = styled.div`${() => css`
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-size: ${Size.fontSize.fontSize12};
`}`;

const StepIconContainer = styled.div`${() => css`
  display: flex;
  align-items: center;
  justify-content: center;

  & > div {
    margin-right: 0 !important;
  }
`}`;

const Icon = styled.div<{ $iconPath: string; $collapsed?: boolean }>`${({ $iconPath, $collapsed }) => css`
  width: 13px;
  height: 13px;
  background-size: contain;
  flex-shrink: 0;
  background-image: url(${$iconPath});
  background-position: center;
  background-repeat: no-repeat;
  margin-right: ${$collapsed === false ? "0px" : "12px"};
`}`;

const Connector = styled.div<{ $active: boolean; $orientation: WorkflowLineOrientation }>`${({
  $active,
  $orientation,
}) => css`
  background: ${$active ? Color.blueSurface : Color.emphasizedLine};
  ${
    $orientation === "vertical"
      ? css`
        width: 1px;
        height: 24px;
        margin: 4px 28px;
      `
      : css`
        width: 40px;
        height: 2px;
        margin: 0 8px;
      `
  }
`}`;

const Dot = styled.div<{ $state: "pending" | "active" | "complete"; $collapsed?: boolean }>`
  ${({ $state, $collapsed }) => css`
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin-bottom: ${$collapsed ? "8px" : "0"};
  background: ${$state === "pending" ? Color.emphasizedLine : Color.blueSurface};
`}`;

const StepContent = styled.div<{ $collapsed?: boolean; $status: boolean }>`${({ $collapsed, $status }) => css`
  display: ${$collapsed ? "none" : "flex"};
  flex-direction: column;
  gap: 4px;
  opacity: ${$status ? 1 : 0.5};
  min-width: 0;
`}`;

const StepTitle = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 400;
  color: ${Color.mutedText};
`}`;

const StepSubtitle = styled.div`${() => css`
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  color: ${Color.textDark};
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
`}`;

type WorkflowLineProps = {
  steps: Pick<WorkflowStep, "id" | "title" | "description" | "icon">[];
  currentStepIndex: number;
  orientation?: WorkflowLineOrientation;
  collapsed?: boolean;
};

export const WorkflowLine = ({
  steps,
  currentStepIndex,
  orientation = "horizontal",
  collapsed = false,
}: WorkflowLineProps) => {
  return (
    <Line $orientation={orientation}>
      {steps.map((step, stepIndex) => {
        let state: "pending" | "active" | "complete" = "pending";
        if (stepIndex < currentStepIndex) state = "complete";
        else if (stepIndex === currentStepIndex) state = "active";
        const isFilled = state !== "pending";

        return (
          <Fragment key={step.id}>
            {stepIndex > 0 && <Connector $active={stepIndex < currentStepIndex} $orientation={orientation} />}
            <StepItem $collapsed={collapsed}>
              <Stop>
                <Dot $collapsed={collapsed} $state={state}>
                  <StepIconContainer>
                    <Icon
                      $collapsed={collapsed}
                      $iconPath={state === "complete" ? "/assets/adminPanel/complete-nav-icon.svg" : (step.icon ?? "")}
                    />
                  </StepIconContainer>
                </Dot>
                <StepContent $collapsed={collapsed} $status={isFilled}>
                  <StepTitle>{step.title}</StepTitle>
                  <StepSubtitle>{step.description}</StepSubtitle>
                </StepContent>
              </Stop>
            </StepItem>
          </Fragment>
        );
      })}
    </Line>
  );
};
