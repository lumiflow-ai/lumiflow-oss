import styled, { css } from "styled-components";

import { Color, Size } from "@/components/ui";

export const SegmentedControlOption = styled.button<{ $isSelected?: boolean }>`${({ $isSelected = false }) => css`
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  appearance: none;
  font-size: 15px;
  font-family: inherit;
  padding: 0px 10px;
  min-width: 36px;
  border-radius: 12px;
  color: black;
  cursor: pointer;
  white-space: nowrap;

  ${
    $isSelected
      ? css`
        border: ${Size.line.thickness} solid ${Color.line};
        background: ${Color.contentSurface};
      `
      : css`
        border: none;
        background: transparent;
      `
  }

  &:not([disabled]):hover {
    background: ${Color.hover};
    color: black;
  }

  &:not([disabled]):active:hover {
    background: ${Color.hover};
  }

  &[disabled] {
    opacity: 0.4;
    cursor: auto;
  }
`}`;

export const SegmentedControl = styled.div`${() => css`
  display: flex;
  box-sizing: border-box;
  height: 32px;
  gap: 0px;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 12px;
  padding: 1px;
  background-color: ${Color.tableHeader};
`}`;
