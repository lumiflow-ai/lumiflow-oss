"use client";

import {
  type MouseEventHandler,
  type PointerEventHandler,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";

import { type StateObject, useBinding, useReactiveState, useStateObject } from "@/library/StateObject";
import useLocalStorage from "@/library/useLocalStorage";

import { ControlContainer } from "@/components/ui/Control";
import { Color } from "@/components/ui/colors";
import { Size } from "@/components/ui/sizes";
import { ToolbarContext } from "@/components/ui/ToolbarContext";

// MARK: - Types

type SidebarPosition = "leading" | "trailing";
export type SidebarState = "open" | "collapsed" | "closed";
type SidebarStyle = "drawer" | "content";

// MARK: - Constants

const Constants = {
  minimumSidebarWidth: 80,
  gutterWidth: 6,
  grabberWidth: 3,
};

const Colors = {
  drawer: {
    backgroundRGBColor: Color.leftSidebar,
    edgeGradient: "rgba(245, 245, 245, 0) 0%, rgba(220, 220, 220, 0.1) 100%",
  },
  content: {
    backgroundRGBColor: Color.menuHover,
    edgeGradient: "rgba(252, 252, 252, 0) 90%, rgba(220, 220, 220, 0.1) 100%",
  },
};

// MARK: - Styles

const SidebarContainer = styled.div<{
  $position: SidebarPosition;
  $isCollapsed: boolean;
  $isDragging: boolean;
  $shouldAnimate: boolean;
  $style: SidebarStyle;
}>`${({ $isCollapsed, $position, $isDragging, $shouldAnimate, $style }) => css`
  display: block;
  font-family: var(--font-inter);
  box-sizing: border-box;
  position: relative;
  flex-shrink: 0;
  z-index: 1;
  --background-color: ${Colors[$style].backgroundRGBColor};

  ${
    $position === "leading"
      ? css`
    margin-right: -${Constants.gutterWidth * ($isCollapsed ? 1 : 1)}px;
  `
      : css`
    margin-left: -${Constants.gutterWidth * ($isCollapsed ? 1 : 1)}px;
  `
  }

  ${
    $isDragging &&
    css`
    cursor: col-resize;
  `
  }

  ${
    $shouldAnimate &&
    css`
      transition:
        width 0.1s ease-in-out,
        margin 0.1s ease-in-out;
    `
  }
`}`;

const ContentsContainer = styled.div<{
  $position: SidebarPosition;
  $isCollapsed: boolean;
  $isDragging: boolean;
  $shouldAnimate: boolean;
  $style: SidebarStyle;
}>`${({ $isCollapsed, $position, $isDragging, $shouldAnimate, $style }) => css`
  display: block;
  box-sizing: border-box;
  position: absolute;
  top: 0px;
  bottom: 0px;
  overflow: hidden;
  background-color: var(--background-color);

  ${
    $position === "leading"
      ? css`
        ${
          !$isCollapsed || $isDragging
            ? css`
              right: ${Constants.gutterWidth}px;
            `
            : css`
              right: ${Constants.gutterWidth}px;
            `
        }`
      : css`
        ${
          !$isCollapsed || $isDragging
            ? css`
              left: ${Constants.gutterWidth}px;
            `
            : css`
              left: ${Constants.gutterWidth}px;
            `
        }
      `
  }

  ${
    $shouldAnimate &&
    css`
    transition:
      width 0.1s ease-in-out,
      inset 0.1s ease-in-out;
  `
  }

  &::before {
    content: "";
    display: block;
    position: absolute;
    top: 0px;
    bottom: 0px;
    width: 3px;
    -webkit-user-select: none;
    user-select: none;
    z-index: 1;
    pointer-events: none;

    ${
      $position === "leading"
        ? css`
          right: 0px;
          background-image: linear-gradient(
            90deg,
            ${Colors[$style].edgeGradient}
          );
          border-right: ${Size.line.thickness} solid ${Color.line};
        `
        : css`
          left: 0px;
          background-image: linear-gradient(
            -90deg,
            ${Colors[$style].edgeGradient}
          );
          border-left: ${Size.line.thickness} solid ${Color.line};
        `
    }
  }
`}`;

const Contents = styled(ControlContainer)<{
  $position: SidebarPosition;
  $shouldAnimate: boolean;
}>`${({ $position, $shouldAnimate }) => css`
  display: flex;
  position: absolute;
  top: 0px;
  bottom: 0px;

  ${
    $position === "leading"
      ? css`
        right: 0px;
      `
      : css`
        left: 0px;
      `
  }

  flex-direction: column;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;

  ${
    $shouldAnimate &&
    css`
    transition:
      width 0.1s ease-in-out,
      margin 0.1s ease-in-out;
  `
  }
  
`}`;

const Grabber = styled.div<{
  $position: SidebarPosition;
  $isCollapsed: boolean;
  $isDragging: boolean;
}>`${({ $isCollapsed, $position, $isDragging }) => css`
  display: block;
  position: absolute;
  top: 0px;
  bottom: 0px;
  width: ${Constants.gutterWidth}px;
  -webkit-user-select: none;
  user-select: none;
  cursor: col-resize;

  ${
    $position === "leading"
      ? css`
        right: 0px;
      `
      : css`
        left: 0px;
      `
  }

  &::after {
    content: "";
    display: block;
    position: absolute;
    inset: 0px ${(Constants.gutterWidth * 2 - Constants.grabberWidth) / 2}px;

    ${
      $isCollapsed &&
      ($position === "leading"
        ? css`
      left: 0px;
      right: ${Constants.gutterWidth * 2 - Constants.grabberWidth}px;
    `
        : css`
      left: ${Constants.gutterWidth * 2 - Constants.grabberWidth}px;
      right: 0px;
    `)
    }

    ${
      $isDragging &&
      css`
      background: rgb(37, 177, 255);
    `
    }
  }

  &:hover::after {
    background: rgb(37, 177, 255);
  }
`}`;

// MARK: - Component

export const Sidebar = ({
  resizeIdentifier,
  position,
  style = "drawer",
  defaultWidth = 200,
  minimumWidth = 200,
  maximumWidth,
  sidebarState,
  closesOnCollapse = false,
  children,
}: PropsWithChildren<{
  resizeIdentifier?: string;
  position: SidebarPosition;
  style?: SidebarStyle;
  defaultWidth?: number;
  minimumWidth?: number;
  maximumWidth?: number;
  sidebarState?: StateObject<SidebarState>;
  closesOnCollapse?: boolean;
}>) => {
  const { setLeadingEdgeWidth, setTrailingEdgeWidth } = useContext(ToolbarContext);

  const actualMinimumWidth = Math.max(minimumWidth, Constants.minimumSidebarWidth);
  const actualMaximumWidth = Math.max(Math.max(maximumWidth ?? defaultWidth, defaultWidth), actualMinimumWidth);

  const backupState = useStateObject<SidebarState>("open");
  const resolvedState = sidebarState ?? backupState;

  const [isCollapsed, setIsCollapsedPreference] = useLocalStorage(
    `sidebar-collapsed-${resizeIdentifier}`,
    resolvedState.wrappedValue === "collapsed",
  );
  const [width, setWidth] = useLocalStorage(
    `sidebar-width-${resizeIdentifier}`,
    Math.max(actualMinimumWidth, defaultWidth),
  );

  const [currentSidebarState, setCurrentSidebarState] = useBinding(resolvedState);

  const [isDragging, setIsDragging] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const initialDragStateRef = useRef({ x: 0, y: 0, width: 0 });

  /// Sync the current state with the user's last collapsed state on mount or state object identity change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Don't capture isCollapsed as we only want to use its value when we first mount.
  useLayoutEffect(() => {
    setCurrentSidebarState((previous) => {
      if (isCollapsed) return closesOnCollapse ? previous : "collapsed";
      return previous === "collapsed" ? "open" : previous;
    });
  }, [setCurrentSidebarState]);

  /// Sync the collapsed state whenever the current state changes.
  useReactiveState(
    resolvedState,
    (_, newState) => {
      setIsCollapsedPreference(newState === "collapsed");
    },
    [setIsCollapsedPreference],
  );

  const dragStartHandler: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      setIsDragging(true);
      setShouldAnimate(false);
      initialDragStateRef.current = {
        x: event.clientX,
        y: event.clientY,
        width: isCollapsed ? 0 : width,
      };
      event.stopPropagation();
      event.preventDefault();
    },
    [isCollapsed, width],
  );

  const dragEndHandler = useCallback(() => {
    setIsDragging(false);
    setShouldAnimate(true);
    if (closesOnCollapse) {
      setCurrentSidebarState((previous) => {
        if (previous === "collapsed") return "closed";
        return previous;
      });
    }
  }, [closesOnCollapse, setCurrentSidebarState]);

  const dragHandler = useCallback(
    (event: PointerEvent) => {
      let difference = event.clientX - initialDragStateRef.current.x;
      if (position === "trailing") difference *= -1;
      const newWidth = initialDragStateRef.current.width + difference;

      if (newWidth < Math.max(actualMinimumWidth / 2, Constants.minimumSidebarWidth)) {
        setCurrentSidebarState("collapsed");
      } else {
        setCurrentSidebarState("open");
      }

      setShouldAnimate(newWidth < actualMinimumWidth);

      setWidth(Math.min(Math.max(newWidth, actualMinimumWidth), actualMaximumWidth));
    },
    [actualMaximumWidth, actualMinimumWidth, position, setCurrentSidebarState, setWidth],
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("pointermove", dragHandler);
      document.addEventListener("pointerup", dragEndHandler, { capture: true });
      document.addEventListener("pointercancel", dragEndHandler, { capture: true });
    }
    return () => {
      document.removeEventListener("pointermove", dragHandler);
      document.removeEventListener("pointerup", dragEndHandler, { capture: true });
      document.removeEventListener("pointercancel", dragEndHandler, { capture: true });
    };
  }, [isDragging, dragHandler, dragEndHandler]);

  const doubleClickHandler: MouseEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.detail >= 2) {
        setCurrentSidebarState((previous) => {
          if (previous !== "open") return "open";
          return closesOnCollapse ? "closed" : "collapsed";
        });
      }
      event.stopPropagation();
      event.preventDefault();
    },
    [setCurrentSidebarState, closesOnCollapse],
  );

  const actualWidth = Math.max(actualMinimumWidth, width);
  const isOpen = currentSidebarState === "open" && !isCollapsed;
  useLayoutEffect(() => {
    switch (position) {
      case "leading":
        setLeadingEdgeWidth(isOpen ? actualWidth : 75);
        break;
      case "trailing":
        setTrailingEdgeWidth(isOpen ? actualWidth : 0);
        break;
      // no-default
    }
  }, [actualWidth, isOpen, position, setLeadingEdgeWidth, setTrailingEdgeWidth]);
  const COLLAPSED_WIDTH = 0;
  const COLLAPSED_WIDTH_LEADING = 65;
  return (
    <SidebarContainer
      $position={position}
      $isCollapsed={!!isCollapsed && !closesOnCollapse}
      $isDragging={isDragging}
      $shouldAnimate={shouldAnimate}
      $style={style}
      style={{
        width: isCollapsed
          ? position === "leading"
            ? COLLAPSED_WIDTH_LEADING + Constants.gutterWidth
            : COLLAPSED_WIDTH + Constants.gutterWidth
          : actualWidth + Constants.gutterWidth,
        display: currentSidebarState === "closed" ? "none" : "flex",
      }}
    >
      <ContentsContainer
        $position={position}
        $isCollapsed={!!isCollapsed && !closesOnCollapse}
        $isDragging={isDragging}
        $shouldAnimate={shouldAnimate}
        $style={style}
        style={{
          width: isCollapsed ? (position === "leading" ? COLLAPSED_WIDTH_LEADING : COLLAPSED_WIDTH) : actualWidth,
        }}
      >
        <Contents
          $position={position}
          $shouldAnimate={shouldAnimate}
          size="small"
          prominence="primary"
          style={{
            width: isCollapsed ? (position === "leading" ? COLLAPSED_WIDTH_LEADING : COLLAPSED_WIDTH) : actualWidth,
          }}
        >
          {children}
        </Contents>
      </ContentsContainer>
      <Grabber
        $isCollapsed={!!isCollapsed}
        $position={position}
        $isDragging={isDragging}
        onPointerDownCapture={dragStartHandler}
        onClick={doubleClickHandler}
      />
    </SidebarContainer>
  );
};
Sidebar.displayName = "Sidebar";
