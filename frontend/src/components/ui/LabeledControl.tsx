import { type PropsWithChildren, useId } from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";

import {
  ControlCSSMetrics,
  type ControlProps,
  type ControlSize,
  DefaultControlProvider,
  useControlDefaults,
} from "@/components/ui/Control";
import { Label } from "@/components/ui/Label";
import { TextField } from "@/components/ui/TextField";

// MARK: - Types

// MARK: - Constants

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const Container = styled.div<{ $size: ControlSize }>`${({ $size }) => css`
  display: flex;
  position: relative;
  flex-direction: column;
  gap: 4px;

  ${Label} {
    font-size: calc(${ControlCSSMetrics[$size].fontSize} - 1px);
    padding: 0px calc(${ControlCSSMetrics[$size].controlPadding} + 1px);
  }

  ${TextField} {
    width: 100%;
  }

  &:has(textarea) {
    flex-grow: 1;
  }
`}`;

// MARK: - Components

export const LabeledControl = NamedComponent(
  "LabeledControl",
  ({
    groupID,
    style,
    className,
    children,
    ...controlProps
  }: {
    groupID?: string;
  } & ControlProps &
    PropsWithChildren) => {
    const controlID = useId();
    const controlDefaults = useControlDefaults({ id: controlID, ...controlProps });
    return (
      <DefaultControlProvider {...controlDefaults}>
        <Container id={groupID} className={className} style={style} $size={controlDefaults.size}>
          {children}
        </Container>
      </DefaultControlProvider>
    );
  },
);
