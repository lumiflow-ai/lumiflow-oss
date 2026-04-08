import {
  type CSSProperties,
  type PropsWithChildren,
  type UIEventHandler,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import styled, { css } from "styled-components";

import { Color } from "@/components/ui/colors";
import { ToolbarConstants } from "@/components/ui/Toolbar";
import { ToolbarContext } from "@/components/ui/ToolbarContext";

/// MARK: - Types

export type ScrollHandler = (scrollOffset: { x: number; y: number }) => void;

/// MARK: - Constants

const Constants = {
  scrollbarPadding: 4,
  shadowInsets: 2,
  backgroundColor: Color.contentSurface,
};

/// MARK: - Styles

const Container = styled.div`${() => css`
  position: relative;
  display: block;
  flex-grow: 1;
  overflow-x: hidden;
  overflow-y: hidden;
  background-color: var(--background-color, ${Constants.backgroundColor});
  z-index: 0;
`}`;

const ScrollViewShadow = styled.div`${() => css`
  position: absolute;
  display: block;
  top: 0px;
  right: ${Constants.shadowInsets}px;
  left: ${Constants.shadowInsets}px;
  height: ${ToolbarConstants.height}px;
  background-color: var(--background-color, ${Constants.backgroundColor});
  z-index: 1;
  opacity: 0;
  transition: opacity 0.5s ease-in-out;

  &::before {
    content: "";
    position: absolute;
    display: block;
    inset: 0px -${Constants.shadowInsets}px;
    background-color: var(--background-color, ${Constants.backgroundColor});
  }
`}`;

const ScrollView = styled.div<{
  $scrollsVertically: boolean;
  $scrollsHorizontally: boolean;
  $isToolbarVisible: boolean;
}>`${({ $scrollsVertically, $scrollsHorizontally, $isToolbarVisible }) => css`
  position: absolute;
  display: block;
  inset: ${$isToolbarVisible ? `${ToolbarConstants.height}px` : "0px"} ${Constants.scrollbarPadding}px 0px 0px;
  overflow-x: ${$scrollsHorizontally ? "auto" : "hidden"};
  overflow-y: ${$scrollsVertically ? "auto" : "hidden"};
  overscroll-behavior: contain;
`}`;

const ScrollViewContents = styled.div`${() => css`
  position: absolute;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  inset: 0px -${Constants.scrollbarPadding}px 0px 0px;
`}`;

/// MARK: - NavigationContent Component

export const NavigationContent = ({
  scrollsVertically = false,
  scrollsHorizontally = false,
  style,
  onScroll,
  children,
}: {
  scrollsVertically?: boolean;
  scrollsHorizontally?: boolean;
  style?: CSSProperties | undefined;
  onScroll?: ScrollHandler;
} & PropsWithChildren) => {
  const { isToolbarVisible } = useContext(ToolbarContext);

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const scrollShadowRef = useRef<HTMLDivElement>(null);
  const scrollFlags = useRef({ didScroll: false, isScrolling: false });

  const scrollHandler: UIEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      scrollFlags.current.didScroll = true;

      if (!scrollFlags.current.isScrolling) {
        scrollFlags.current.isScrolling = true;
        const scrollView = event.currentTarget;

        window.requestAnimationFrame(() => {
          scrollFlags.current.isScrolling = false;

          if (scrollShadowRef.current) {
            scrollShadowRef.current.style.opacity = `${Math.min(Math.max(scrollView.scrollTop / 30, 0), 1)}`;
          }

          onScroll?.({ x: scrollView.scrollLeft, y: scrollView.scrollTop });
        });
      }
    },
    [onScroll],
  );

  useLayoutEffect(() => {
    onScroll?.({ x: scrollViewRef.current?.scrollLeft ?? 0, y: scrollViewRef.current?.scrollTop ?? 0 });
  }, [onScroll]);

  return (
    <Container>
      <ScrollView
        $scrollsVertically={scrollsVertically}
        $scrollsHorizontally={scrollsHorizontally}
        $isToolbarVisible={isToolbarVisible}
        onScroll={scrollHandler}
        ref={scrollViewRef}
      >
        <ScrollViewContents style={style}>{children}</ScrollViewContents>
      </ScrollView>
      {scrollsVertically && isToolbarVisible && <ScrollViewShadow ref={scrollShadowRef} />}
    </Container>
  );
};
NavigationContent.displayName = "NavigationContent";
