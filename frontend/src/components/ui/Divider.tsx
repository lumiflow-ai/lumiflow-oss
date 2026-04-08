import styled, { css } from "styled-components";

import { Color } from "@/components/ui/colors";
import { Size } from "@/components/ui/sizes";

export const Divider = styled.hr`${() => css`
  width: auto;
  height: ${Size.line.thickness};
  margin: 12px 8px;
  border: 0px;
  background: ${Color.line};
  border-radius: 0.75px;
  flex-shrink: 0;
`}`;
