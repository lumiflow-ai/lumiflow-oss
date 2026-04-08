import { Fragment, useContext, useLayoutEffect, useMemo } from "react";
import styled, { css } from "styled-components";

import useLocalStorage from "@/library/useLocalStorage";

import { ControlContainer, ControlVariableNames } from "@/components/ui/Control";
import { ToolbarContext } from "@/components/ui/ToolbarContext";
import { ToolbarItemIcon, type ToolbarItemJSXElement } from "@/components/ui/ToolbarItem";

import { Color } from "./colors";
import { Size } from "./sizes";

// MARK: - Constants and Types

export const ToolbarConstants = {
  height: 40,
  itemSpacing: 8,
  containerGap: 15,
};

// MARK: - Styles

const Container = styled(ControlContainer)`${() => css`
  position: absolute;
  top: 10px;
  top: 10px;
  left: 0px;
  right: 0px;
  height: ${ToolbarConstants.height}px;
  z-index: 2;
  pointer-events: none;
  padding: 0px 20px 0px 2px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  gap: ${ToolbarConstants.containerGap}px;
  align-items: stretch;

  ${ControlVariableNames.regularFontSize}: ${Size.fontSize.fontSize14};
`}`;

const InnerContainer = styled.div`${() => css`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-grow: 1;
  height: 100%;
`}`;

const Group = styled.div`${() => css`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${ToolbarConstants.itemSpacing}px;
  height: auto;
`}`;

const Spacer = styled.div`${() => css`
  position: relative;
  display: block;
  flex-grow: 1;
  flex-shrink: 1;
  margin: 0px -${ToolbarConstants.itemSpacing / 2}px;
`}`;

const Button = styled.button<{ $variant?: "default" | "primary" | "danger" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  appearance: none;
  font-size: ${Size.fontSize.fontSize14};
  font-weight: 500;
  font-family: inherit;
  padding: 10px 12px;
  border-radius: 12px;
  white-space: nowrap;
  cursor: pointer;
  height: 32px;


  ${({ $variant = "default" }) => {
    switch ($variant) {
      case "primary":
        return css`
          background: ${Color.buttonfilled.background};
          color: ${Color.buttonfilled.text};
          border: 1px solid ${Color.buttonfilled.border};

          &:hover {
            opacity: 0.8;
          }
        `;

      case "danger":
        return css`
          background: ${Color.buttonDanger.background};
          color: ${Color.buttonDanger.text};
          border: 1px solid ${Color.buttonDanger.border};

          &:hover {
            background: ${Color.buttonDanger.hover.background};
            color: ${Color.buttonDanger.hover.text};
            border: 1px solid ${Color.buttonDanger.hover.border};
          }
        `;

      default:
        return css`
          background: ${Color.buttonOutlined.background};
          color: ${Color.buttonOutlined.text};
          border: 1px solid ${Color.buttonOutlined.border};

          &:hover {
            background: ${Color.buttonOutlined.hover.background};
            color: ${Color.buttonOutlined.hover.text};
            border: 1px solid ${Color.buttonOutlined.hover.border};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:has(${ToolbarItemIcon}) {
    padding: 6px 0px 6px 8px;
    min-width: 20px;
    background: transparent;
    border: none;
  }`;

const LeadingArea = styled.div<{ $collapsed: boolean; $leadingEdgeWidth: number }>`
  display: flex;
  width: 95%;
  align-items: center;
  justify-content: space-between;
  gap: ${ToolbarConstants.itemSpacing}px;

  .logo {

    display: ${({ $collapsed }) => ($collapsed ? "block" : "block")};
  }

 .items {
  display: ${({ $collapsed }) => ($collapsed ? "none" : "flex")};
  margin-left: ${({ $collapsed }) => ($collapsed ? "12px" : "0px")};
}

  ${({ $collapsed }) =>
    $collapsed &&
    css`
      &:hover .logo {
        display: none;
      }

      &:hover .items {
        display: flex;
      }
  `}`;

const LogoImage = styled.img`
  width: 65px;
  pointer-events: auto;
  cursor: pointer;
`;
// MARK: - Component

export const Toolbar = ({
  children,
}: {
  children: ToolbarItemJSXElement | (ToolbarItemJSXElement | undefined | null | false)[] | undefined | null | false;
}) => {
  const { leadingEdgeWidth, trailingEdgeWidth, setToolbarVisible } = useContext(ToolbarContext);
  const [isCollapsed, _setIsCollapsedPreference] = useLocalStorage("sidebar-collapsed-navigation", false);
  const [leadingWindow, _leadingContent, centerItems, trailingContent, trailingWindow] = useMemo(() => {
    let allItems: (ToolbarItemJSXElement | undefined | null | false)[] = [];
    if (Array.isArray(children)) {
      allItems = children;
    } else if (children) {
      allItems = [children];
    }

    const leadingWindow: ToolbarItemJSXElement[] = [];
    const leadingContent: ToolbarItemJSXElement[] = [];
    const trailingContent: ToolbarItemJSXElement[] = [];
    const trailingWindow: ToolbarItemJSXElement[] = [];
    const centerItems: ToolbarItemJSXElement[] = [];

    let index = 0;
    for (const item of allItems) {
      if (!item) continue;
      const { edge, ignoresSidebar = false, action, isEnabled = true, variant } = item.props;

      const component = action ? (
        <Button key={index} onClick={action} disabled={!isEnabled} $variant={variant}>
          {item}
        </Button>
      ) : (
        <Fragment key={index}>{item}</Fragment>
      );

      switch (edge) {
        case "leading":
          if (ignoresSidebar) {
            leadingWindow.push(component);
          } else {
            leadingContent.push(component);
          }
          break;
        case "trailing":
          if (ignoresSidebar) {
            trailingWindow.push(component);
          } else {
            trailingContent.push(component);
          }
          break;
        case "center":
          centerItems.push(component);
          break;
        // no-default
      }
      index += 1;
    }

    trailingContent.reverse();
    trailingWindow.reverse();

    return [leadingWindow, leadingContent, centerItems, trailingContent, trailingWindow];
  }, [children]);

  useLayoutEffect(() => {
    setToolbarVisible(true);
    return () => {
      setToolbarVisible(false);
    };
  }, [setToolbarVisible]);

  return (
    <Container prominence="primary">
      <Group>
        {(leadingWindow.length > 0 || leadingEdgeWidth > 0) && (
          <Group
            style={{
              minWidth: Math.max(leadingEdgeWidth - ToolbarConstants.itemSpacing, 0),
              display: "flex",
              justifyContent: "space-between",
              paddingRight: "10px",
            }}
          >
            <LeadingArea $collapsed={isCollapsed} $leadingEdgeWidth={leadingEdgeWidth}>
              <LogoImage className="logo" src="/assets/Logo-icon.svg" alt="Lumiflow" />
              <div className="items">{leadingWindow}</div>
            </LeadingArea>
          </Group>
        )}
      </Group>
      <InnerContainer>
        {centerItems.length > 0 && <Group style={{ flex: 1, justifyContent: "flex-start" }}>{centerItems}</Group>}
        <Group>
          {trailingContent}
          {(trailingWindow.length > 0 || trailingEdgeWidth > 0) && (
            <Group
              style={{
                minWidth: Math.max(trailingEdgeWidth - ToolbarConstants.itemSpacing, 0),
              }}
            >
              <Spacer />
              {trailingWindow}
            </Group>
          )}
        </Group>
      </InnerContainer>
    </Container>
  );
};

Toolbar.displayName = "Toolbar";
