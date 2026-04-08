import styled, { css } from "styled-components";

import { Color, Size } from "./ui";

export const ContentHeader = styled.h1`${css`
  font-size: ${Size.fontSize.fontSize20};
  font-weight: 400;
  line-height: 1.1;
  width: fit-content;
  color: ${Color.textDark};
  a {
    color: inherit;
    text-decoration: none;
    -webkit-user-select: none;
    user-select: none;
    cursor: pointer;
    &:hover {
      color: ${Color.mutedText};
    }
    &:active:hover {
      color: ${Color.mutedText};
    }
  }
`}`;
