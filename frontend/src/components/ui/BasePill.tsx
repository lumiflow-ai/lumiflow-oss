import styled, { css } from "styled-components";

import { Color } from "@/components/ui/colors";
import { Size } from "@/components/ui/sizes";

export const BasePill = styled.div`${() => css`
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  min-width: 44px;
  padding: 4px 10px;
  border: ${Size.line.thickness} solid ${Color.line};
  background: ${Color.tableHeader};
  color: ${Color.mutedText};
`}`;

BasePill.displayName = "BasePill";
