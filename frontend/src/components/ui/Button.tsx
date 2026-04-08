import { type MouseEventHandler, type PropsWithChildren, useCallback, useEffect } from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";

import { ControlCSSMetrics, type ControlProps, type ControlSize, useControlDefaults } from "@/components/ui/Control";

import { Color } from "./colors";
import { Font } from "./fonts";
import { Size } from "./sizes";

// MARK: - Types

type ButtonKind = keyof typeof Colors;

// MARK: - Constants

const Colors = {
  plain: {
    default: {
      backgroundColor: `${Color.buttonNeutral.background}`,
      textColor: `${Color.buttonNeutral.text}`,
      borderColor: `${Color.buttonNeutral.border}`,
    },
    hover: {
      backgroundColor: `${Color.buttonNeutral.hover.background}`,
      textColor: `${Color.buttonNeutral.hover.text}`,
      borderColor: `${Color.buttonNeutral.hover.border}`,
    },
    active: {
      backgroundColor: `${Color.buttonNeutral.hover.background}`,
      textColor: `${Color.buttonNeutral.hover.text}`,
      borderColor: `${Color.buttonNeutral.hover.border}`,
    },
    disabled: {
      opacity: 0.4,
    },
  },

  secondary: {
    default: {
      backgroundColor: `${Color.buttonOutlined.background}`,
      textColor: `${Color.buttonOutlined.text}`,
      borderColor: `${Color.buttonOutlined.border}`,
    },
    hover: {
      backgroundColor: `${Color.buttonOutlined.hover.background}`,
      textColor: `${Color.buttonOutlined.hover.text}`,
      borderColor: `${Color.buttonOutlined.hover.border}`,
    },
    active: {
      backgroundColor: `${Color.buttonOutlined.hover.background}`,
      textColor: `${Color.buttonOutlined.hover.text}`,
      borderColor: `${Color.buttonOutlined.hover.border}`,
    },
    disabled: {
      opacity: 0.4,
    },
  },

  prominent: {
    default: {
      backgroundColor: `${Color.buttonfilled.background}`,
      textColor: `${Color.buttonfilled.text}`,
      borderColor: `${Color.buttonfilled.border}`,
    },
    hover: {
      backgroundColor: `${Color.buttonfilled.hover.background}`,
      textColor: `${Color.buttonfilled.hover.text}`,
      borderColor: `${Color.buttonfilled.hover.border}`,
    },
    active: {
      backgroundColor: `${Color.buttonfilled.hover.background}`,
      textColor: `${Color.buttonfilled.hover.text}`,
      borderColor: `${Color.buttonfilled.hover.border}`,
    },
    disabled: {
      opacity: 0.4,
    },
  },

  dangerous: {
    default: {
      backgroundColor: `${Color.buttonDanger.background}`,
      textColor: `${Color.buttonDanger.text}`,
      borderColor: `${Color.buttonDanger.border}`,
    },
    hover: {
      backgroundColor: `${Color.buttonDanger.hover.background}`,
      textColor: `${Color.buttonDanger.hover.text}`,
      borderColor: `${Color.buttonDanger.hover.border}`,
    },
    active: {
      backgroundColor: `${Color.buttonDanger.hover.background}`,
      textColor: `${Color.buttonDanger.hover.text}`,
      borderColor: `${Color.buttonDanger.hover.border}`,
    },
    disabled: {
      opacity: 0.4,
    },
  },
};

const StyledButton = styled.button<{ $size: ControlSize; $kind: ButtonKind }>`${({ $size, $kind }) => css`
  font-family: ${Font.inter};
  background-color: ${Colors[$kind].default.backgroundColor};
  color: ${Colors[$kind].default.textColor};
  border: ${Size.line.thickness} solid ${Colors[$kind].default.borderColor};
  border-radius: 14px;
  font-size: ${ControlCSSMetrics[$size].fontSize};
  padding: 0px ${ControlCSSMetrics[$size].controlPadding} 0px;
  height: 40px;
  cursor: pointer;
  white-space: nowrap;

  &:not([disabled]):hover {
    background-color: ${Colors[$kind].hover.backgroundColor};
    color: ${Colors[$kind].hover.textColor};
  }

  &:not([disabled]):active:hover {
    background-color: ${Colors[$kind].active.backgroundColor};
    color: ${Colors[$kind].active.textColor};
  }

  &[disabled] {
    opacity: 0.4;
    cursor: auto;
   
  }
`}`;

export const Button = NamedComponent(
  "Button",
  ({
    action,
    keyEquivalent,
    isDangerous = false,
    style,
    className,
    children,
    ...controlProps
  }: {
    action?: () => void;
    keyEquivalent?: "Enter" | "Escape" | string;
    isDangerous?: boolean;
  } & ControlProps &
    PropsWithChildren) => {
    const { id, isEnabled, size, prominence } = useControlDefaults(controlProps);

    const kind: ButtonKind =
      keyEquivalent === "Enter"
        ? "prominent"
        : prominence === "secondary"
          ? "secondary"
          : isDangerous
            ? "dangerous"
            : keyEquivalent === "Escape"
              ? "plain"
              : "prominent";

    const clickHandler: MouseEventHandler = useCallback(
      (event) => {
        action?.();
        event?.preventDefault();
        event?.stopPropagation();
      },
      [action],
    );

    // Handle keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!isEnabled || !keyEquivalent) return;
        if (event.key === keyEquivalent) {
          action?.();
          event?.preventDefault();
          event?.stopPropagation();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [action, isEnabled, keyEquivalent]);

    return (
      <StyledButton
        id={id}
        className={className}
        style={style}
        $size={size}
        $kind={kind}
        disabled={!isEnabled}
        onClick={clickHandler}
      >
        {children}
      </StyledButton>
    );
  },
);
