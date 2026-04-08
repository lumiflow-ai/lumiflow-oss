import { type MouseEventHandler, type PropsWithChildren, useCallback, useId } from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";
import { type StateObject, useBinding } from "@/library/StateObject";

import {
  ControlCSSConstants,
  type ControlProps,
  type ControlSize,
  DefaultControlProvider,
  useControlDefaults,
} from "@/components/ui/Control";
import { Color } from "@/components/ui/colors";
import { Label } from "@/components/ui/Label";
import { Size } from "@/components/ui/sizes";

// MARK: - Types

export type CheckboxState = "on" | "off" | "mixed";
export type CheckboxActionHandler = (previousValue: CheckboxState, newValue: "on" | "off") => void;

// MARK: - Constants

const Metrics = {
  small: {
    size: "12px",
    padding: "6px",
    markSize: "12px",
    cornerRadius: "3px",
  },
  regular: {
    size: "14px",
    padding: "6px",
    markSize: "12px",
    cornerRadius: "4px",
  },
  large: {
    size: "18px",
    padding: "8px",
    markSize: "16px",
    cornerRadius: "5px",
  },
};

// MARK: - Styles

const CheckboxIcon = styled.div`${() => css`
  position: absolute;
  inset: 0px;
  background: rgba(0, 0, 0, 0.5);
  mask-position: center;
  mask-repeat: no-repeat;
  mix-blend-mode: plus-darker;
`}`;

const CheckboxContainer = styled.button<{ $size: ControlSize }>`${({ $size }) => css`
  position: relative;
  width: ${Metrics[$size].size};
  height: ${Metrics[$size].size};
  border-radius: ${Metrics[$size].cornerRadius};
  flex-shrink: 0;
  border: 0px;

  &::after {
    content: "";
    position: absolute;
    inset: 0px;
    border-radius: inherit;
    outline: ${Size.line.thickness} solid ${Color.line};
    outline-offset: -1px;
    mix-blend-mode: plus-darker;
  }

  &:not(:disabled):active:hover::after {
    background: rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.4;
  }

  ${CheckboxIcon} {
    mask-size: ${Metrics[$size].markSize}
  }
`}`;

const CheckmarkIcon = styled(CheckboxIcon)`${() => css`
  mask-image: url("/assets/checkmark-checked.svg");
`}`;

const MixedIcon = styled(CheckboxIcon)`${() => css`
  mask-image: url("/assets/checkmark-mixed.svg");
`}`;

const CheckboxButtonContainer = styled.div<{ $size: ControlSize }>`${({ $size }) => css`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${Metrics[$size].padding};

  &:not(input[disabled]):hover ${Label} {
    color: black;
  }
`}`;

// MARK: - Components

export const Checkbox = NamedComponent(
  "Checkbox",
  ({
    selectionState,
    action,
    color,
    showsColorWhenOff = false,
    style,
    className,
    ...controlProps
  }: {
    selectionState: StateObject<CheckboxState>;
    action?: CheckboxActionHandler;
    color?: string;
    showsColorWhenOff?: boolean;
  } & ControlProps) => {
    const { id, isEnabled, size, prominence } = useControlDefaults(controlProps);
    const [selection] = useBinding(selectionState);

    const toggle: MouseEventHandler = useCallback(
      (event) => {
        const oldValue = selectionState.wrappedValue;
        selectionState.wrappedValue = oldValue === "mixed" || oldValue === "off" ? "on" : "off";
        action?.(oldValue, selectionState.wrappedValue);
        event.stopPropagation();
      },
      [selectionState, action],
    );

    const onColor = color ?? ControlCSSConstants.accentColor;
    const offColor = !showsColorWhenOff ? (prominence === "primary" ? "white" : "transparent") : onColor;

    return (
      <CheckboxContainer
        id={id}
        className={className}
        style={{ ...style, backgroundColor: selection === "off" ? offColor : onColor }}
        onClick={toggle}
        disabled={!isEnabled}
        $size={size}
      >
        {selection === "on" && <CheckmarkIcon />}
        {selection === "mixed" && <MixedIcon />}
      </CheckboxContainer>
    );
  },
);

export const CheckboxButton = NamedComponent(
  "CheckboxButton",
  ({
    selectionState,
    action,
    color = "white",
    showsColorWhenOff = false,
    groupID,
    style,
    className,
    children,
    ...controlProps
  }: {
    selectionState: StateObject<CheckboxState>;
    action?: CheckboxActionHandler;
    color?: string;
    showsColorWhenOff?: boolean;
    groupID?: string;
  } & ControlProps &
    PropsWithChildren) => {
    const controlID = useId();
    const controlDefaults = useControlDefaults({ id: controlID, ...controlProps });

    return (
      <DefaultControlProvider {...controlDefaults}>
        <CheckboxButtonContainer id={groupID} className={className} style={style} $size={controlDefaults.size}>
          <Checkbox
            action={action}
            color={color}
            selectionState={selectionState}
            showsColorWhenOff={showsColorWhenOff}
          />
          <Label>{children}</Label>
        </CheckboxButtonContainer>
      </DefaultControlProvider>
    );
  },
);
