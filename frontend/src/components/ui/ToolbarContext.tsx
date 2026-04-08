import { createContext } from "react";

export const ToolbarContext = createContext<{
  leadingEdgeWidth: number;
  setLeadingEdgeWidth: (width: number) => void;
  trailingEdgeWidth: number;
  setTrailingEdgeWidth: (width: number) => void;
  isToolbarVisible: boolean;
  setToolbarVisible: (isVisible: boolean) => void;
}>({
  leadingEdgeWidth: 0,
  setLeadingEdgeWidth() {},
  trailingEdgeWidth: 0,
  setTrailingEdgeWidth() {},
  isToolbarVisible: false,
  setToolbarVisible() {},
});
