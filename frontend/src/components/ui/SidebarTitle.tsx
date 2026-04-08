import styled, { css } from "styled-components";

import { Color } from "./colors";
import { Size } from "./sizes";

export const SidebarTitle = styled.h1`${() => css`
  margin: 0;
  padding-bottom: 15px;
  font-size: ${Size.fontSize.fontSize16};
  font-weight: 500;
  border-bottom: 1px solid ${Color.line};
`}`;
