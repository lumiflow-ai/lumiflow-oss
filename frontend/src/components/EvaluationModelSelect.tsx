import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import type { EvaluationModelConfiguration } from "@/generated/serverTypes";

import { type StateObject, useBinding } from "@/library/StateObject";

import { useEvaluationModels } from "@/model/evaluationModels";

import { Color, Label, LabeledControl, Size } from "@/components/ui";
import { ControlCSSMetrics } from "@/components/ui/Control";

type EvaluationModelSelectProps = {
  selectionState: StateObject<EvaluationModelSelectState>;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
  isEnabled?: boolean;
  includeProviderHint?: boolean;
};

export type EvaluationModelSelectState =
  | { kind: "placeholder"; value: null; model: null }
  | { kind: "valid"; value: string; model: EvaluationModelConfiguration };

const placeholderState: EvaluationModelSelectState = { kind: "placeholder", value: null, model: null };
const loadingStatePlaceholder = "Loading models...";
const emptyStatePlaceholder = "No models available";

function formatEvaluationModelOptionTitle({
  model,
  includeProviderHint,
}: {
  model: EvaluationModelConfiguration;
  includeProviderHint: boolean;
}) {
  const description = model.description ? model.description : "";
  const providerHint = includeProviderHint && model.provider ? model.provider : "-";
  return `${model.displayName} | ${providerHint} | ${model.costMultiplier} | ${description}`;
}

function selectionStateForModelID({
  value,
  modelByID,
}: {
  value: string;
  modelByID: Map<string, EvaluationModelConfiguration>;
}): EvaluationModelSelectState {
  if (value === "") return placeholderState;
  const model = modelByID.get(value);
  if (!model) return placeholderState;
  return { kind: "valid", value, model };
}

export const __visibleForTesting = {
  formatEvaluationModelOptionTitle,
  selectionStateForModelID,
};

// MARK: - Styles

const DropdownWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Trigger = styled.button<{ $isOpen: boolean; $isEnabled: boolean }>`
  position: relative;
  width: 100%;
  font-size: ${ControlCSSMetrics.large.fontSize};
  font-weight: normal;
  padding: 0px calc(min(${ControlCSSMetrics.large.controlPadding} + 12px, 24px)) 0px
    ${ControlCSSMetrics.large.controlPadding};
  font-family: inherit;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: ${({ $isOpen }) => ($isOpen ? "12px 12px 0 0" : "12px")};
  background: ${Color.surfaceOffWhite};
  color: ${({ $isEnabled }) => ($isEnabled ? Color.textDark : Color.mutedText)};
  box-sizing: border-box;
  height: ${ControlCSSMetrics.large.controlHeight};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  text-align: left;
  cursor: ${({ $isEnabled }) => ($isEnabled ? "pointer" : "default")};
  opacity: ${({ $isEnabled }) => ($isEnabled ? 1 : 0.5)};

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    right: 8px;
    width: 16px;
    background: ${Color.textDark};
    mask-image: url(/assets/ui-choose.svg);
    mask-repeat: no-repeat;
    mask-position: center;
    pointer-events: none;
  }

  &:hover:not(:disabled) {
    color: ${Color.emphasizedText};
    background: ${Color.hover};
  }
`;

const Popover = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  border: ${Size.line.thickness} solid ${Color.line};
  border-top: none;
  border-radius: 0 0 12px 12px;
  background: ${Color.contentSurface};
  max-height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: left;
`;

const ModelRow = styled.div<{ $isSelected?: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 12px;
  gap: 2px;
  background-color: ${({ $isSelected }) => ($isSelected ? Color.surfaceRowHover : Color.contentSurface)};
  cursor: pointer;
  border-bottom: ${Size.line.thickness} solid ${Color.line};

  &:last-of-type {
    border-bottom: none;
  }

  &:hover {
    background-color: ${Color.hover};
  }
`;

const ModelName = styled.span`
  font-size: ${Size.fontSize.fontSize14};
  color: ${Color.textDark};
`;

const ModelCost = styled.span`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.mutedText};
  margin-left: 6px;
`;

const ModelMeta = styled.span`
  font-size: ${Size.fontSize.fontSize12};
  color: ${Color.mutedText};
`;

// MARK: - Component

export const EvaluationModelSelect = ({
  selectionState,
  label = "Judge Model",
  placeholder = "Choose a Judge Model",
  showLabel = true,
  isEnabled = true,
  includeProviderHint = true,
}: EvaluationModelSelectProps) => {
  const { evaluationModels, defaultEvaluationModelID, isLoading } = useEvaluationModels();
  const modelByID = useMemo(() => new Map(evaluationModels.map((model) => [model.id, model])), [evaluationModels]);
  const [selection, setSelection] = useBinding(selectionState);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isControlEnabled = isEnabled && !isLoading && evaluationModels.length > 0;

  const triggerLabel = isLoading
    ? loadingStatePlaceholder
    : evaluationModels.length === 0
      ? emptyStatePlaceholder
      : selection.kind === "valid"
        ? selection.model.displayName
        : placeholder;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dropdown = (
    <DropdownWrapper ref={wrapperRef}>
      <Trigger
        type="button"
        $isOpen={isOpen}
        $isEnabled={isControlEnabled}
        disabled={!isControlEnabled}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {triggerLabel}
      </Trigger>
      {isOpen && (
        <Popover>
          {evaluationModels.map((model) => {
            const subtitle = [includeProviderHint && model.provider ? model.provider : null, model.description || null]
              .filter(Boolean)
              .join(" · ");
            return (
              <ModelRow
                key={model.id}
                $isSelected={
                  selection.kind === "valid" ? selection.value === model.id : model.id === defaultEvaluationModelID
                }
                onClick={() => {
                  setSelection(selectionStateForModelID({ value: model.id, modelByID }));
                  setIsOpen(false);
                }}
              >
                <ModelName>
                  {model.displayName}
                  {model.costMultiplier && <ModelCost>{model.costMultiplier}</ModelCost>}
                </ModelName>
                {subtitle && <ModelMeta>{subtitle}</ModelMeta>}
              </ModelRow>
            );
          })}
        </Popover>
      )}
    </DropdownWrapper>
  );

  if (!showLabel) return dropdown;

  return (
    <LabeledControl>
      <Label>{label}</Label>
      {dropdown}
    </LabeledControl>
  );
};
