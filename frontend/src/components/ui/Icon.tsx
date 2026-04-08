import styled, { css } from "styled-components";

import type { ControlSize } from "@/components/ui/Control";
import { Color } from "@/components/ui/colors";
import { Size } from "@/components/ui/sizes";

// MARK: - Constants

const Metrics = {
  small: {
    size: "15px",
  },
  regular: {
    size: "19px",
  },
  large: {
    size: "23px",
  },
};

// MARK: - Styles

export const IconSelection = styled.div`${() => css`
  display: block;
  width: fit-content;
  cursor: pointer;
`}`;

export const Icon = styled.div<{ $icon: string | null; $size: ControlSize }>`${({ $icon, $size }) => css`
  display: block;
  text-decoration: none;
  width: ${Metrics[$size].size};
  height: ${Metrics[$size].size};
  opacity: 1;
  ${
    $icon &&
    css`
      background-image: url(/assets/status-${$icon}.svg);
      background-size: ${Metrics[$size].size};

      &[data-interactive=true] {
        cursor: pointer;
      }
    `
  }

  &[data-selected=true],
  ${IconSelection}[data-selected=true] & {
    border-radius: ${Metrics[$size].size};
    outline: ${Size.line.thickness} solid ${Color.line};
    outline-offset: 2px;
  }

  &[data-interactive=true]:hover,
  ${IconSelection}:hover & {
    opacity: 0.6;
  }
`}`;
