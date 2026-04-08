import { memo } from "react";
import styled from "styled-components";

export type PropsWithClassName = { className?: string };

export function NamedComponent<Props>(displayName: string, component: (_: Props & PropsWithClassName) => JSX.Element) {
  const memoizedComponent = memo(component);
  memoizedComponent.displayName = displayName;
  return styled(memoizedComponent)``;
}
