import { type PropsWithChildren, useMemo, useState } from "react";
import styled, { css } from "styled-components";

import { ToolbarContext } from "@/components/ui/ToolbarContext";

const Container = styled.div`${() => css`
  position: absolute;
  top: 0px;
  right: 0px;
  bottom: 0px;
  left: 0px;

  display: flex;
  flex-direction: row;
  align-items: stretch;
`}`;

export const NavigationStack = ({ children }: PropsWithChildren) => {
  const [leadingEdgeWidth, setLeadingEdgeWidth] = useState(0);
  const [trailingEdgeWidth, setTrailingEdgeWidth] = useState(0);
  const [isToolbarVisible, setToolbarVisible] = useState(false);

  const toolbarContext = useMemo(
    () => ({
      leadingEdgeWidth,
      setLeadingEdgeWidth,
      trailingEdgeWidth,
      setTrailingEdgeWidth,
      isToolbarVisible,
      setToolbarVisible,
    }),
    [leadingEdgeWidth, trailingEdgeWidth, isToolbarVisible],
  );

  return (
    <Container>
      <ToolbarContext.Provider value={toolbarContext}>{children}</ToolbarContext.Provider>
    </Container>
  );
};
NavigationStack.displayName = "NavigationStack";
