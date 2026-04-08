"use client";

import styled, { css } from "styled-components";

import { Color, IconSelection, Size } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";

export const TooltipPopup = styled.div`${() => css`
  position: fixed;
  z-index: 9999;
  transform: translateX(-50%);
  color: ${Color.textDark};
  outline: ${Size.line.thickness} solid ${Color.line};
  background-color: ${Color.tableHeader};
  border-radius: 4px;
  padding: 4px 8px;
  font-size: ${Size.fontSize.fontSize12};
  font-weight: 400;
  white-space: pre-line;
  line-height: 1.5;
  pointer-events: none;
`}`;

export const MetricIconSelection = styled(IconSelection)`${() => css`
  padding: 6px;
  width: fit-content;

  &[data-selected="true"] ${Icon} {
    outline: 4px solid rgb(63, 67, 194);
    border-width: 20px;
    outline-offset: 1px;
  }

  &[data-review-status="approved"] ${Icon} {
    background-image: url(/assets/adminPanel/approved-by-humans.svg);
    border-radius: 999px;
  }

  &[data-review-status="denied"] ${Icon} {
    background-image: url(/assets/adminPanel/rejected-by-humans.svg);
    border-radius: 999px;
  }

  &[data-review-status="not_applicable"] ${Icon} {
    background-image: url(/assets/adminPanel/na-by-humans.svg);
    border-radius: 999px;
  }
`}`;
