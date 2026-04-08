import type { MouseEventHandler, PropsWithChildren, ReactElement } from "react";
import styled, { css } from "styled-components";

// MARK: - Constants and Types
export type ToolbarItemVariant = "default" | "primary" | "danger";
type ToolbarItemProps = {
  edge: "leading" | "center" | "trailing";
  ignoresSidebar?: boolean;
  isEnabled?: boolean;
  variant?: ToolbarItemVariant;
  title: string;
  icon?: string;
  action?: MouseEventHandler<HTMLButtonElement>;
};

// MARK: - Styles

const ItemContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  pointer-events: auto;
`}`;

export const ToolbarItemIcon = styled.div`${() => css`
  position: relative;
  width: 20px;
  height: 20px;
  background: currentcolor;
`}`;

// MARK: - Component

export const ToolbarItem = ({ title, icon, children }: PropsWithChildren<ToolbarItemProps>) => {
  return (
    <ItemContainer title={title}>
      {children ??
        (icon ? <ToolbarItemIcon style={{ maskImage: `url(/assets/${icon}.svg)`, maskSize: "contain" }} /> : title)}
    </ItemContainer>
  );
};
ToolbarItem.displayName = "ToolbarItem";

export type ToolbarItemJSXElement = ReactElement<PropsWithChildren<ToolbarItemProps>>;
