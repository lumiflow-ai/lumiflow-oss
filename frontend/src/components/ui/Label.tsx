import type { PropsWithChildren } from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";

import { ControlCSSMetrics, type ControlProps, type ControlSize, useControlDefaults } from "@/components/ui/Control";

import { Color } from "./colors";

// MARK: - Types

// MARK: - Constants

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const StyledLabel = styled.label<{ $size: ControlSize }>`${({ $size }) => css`
  position: relative;
  font-size: ${ControlCSSMetrics[$size].fontSize};
  font-weight: 500;
  color: ${Color.textDark};
  -webkit-user-select: none;
  top: 0.5px;

  &[data-is-enabled="false"] {
    opacity: 0.4;
  }
`}`;

// MARK: - Components

export const Label = NamedComponent(
  "Label",
  ({ id, style, className, ...controlProps }: ControlProps & (PropsWithChildren | { text: string })) => {
    const { id: controlID, isEnabled, size } = useControlDefaults(controlProps);

    return (
      <StyledLabel
        id={id}
        className={className}
        style={style}
        htmlFor={controlID}
        $size={size}
        data-is-enabled={isEnabled}
        title={"text" in controlProps ? controlProps.text : undefined}
      >
        {"text" in controlProps ? controlProps.text : controlProps.children}
      </StyledLabel>
    );
  },
);
