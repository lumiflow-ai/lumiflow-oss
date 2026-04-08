import styled, { css } from "styled-components";

import { Color } from "@/components/ui/colors";
import { Font } from "@/components/ui/fonts";
import { Size } from "@/components/ui/sizes";

// MARK: - Constants and Types

// MARK: - Styles

export const Tooltip = styled.div`${() => css`
    visibility: hidden;
    opacity: 0;
    position: absolute;
    z-index: 1;
    top: 150%;
    left: 50%;
    transform: translateX(-50%);
    background-color: ${Color.surfaceRowHover};
    box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.25);
    color: black;
    font-size: ${Size.fontSize.fontSize16};
    font-family: ${Font.ibmPlexSans};
    font-weight: normal;
    text-align: left;
    padding: 5px;
    border-radius: 6px;
    border: ${Size.line.thickness} solid ${Color.line};
    transition: opacity 0.3s;
    white-space: normal;
    width: max-content;
    max-width: 300px;
`}`;

export const Container = styled.div`${() => css`
    position: static;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: ${Color.hover};
    cursor: help;
    font-size: 0.85em;

    &:hover ${Tooltip} {
        visibility: visible;
        opacity: 1;
    }
`}`;

// MARK: - Component

export const TooltipTrigger = ({ text = "?", tooltip }: { text?: string; tooltip: string }) => {
  return (
    <Container>
      {text}
      <Tooltip>{tooltip}</Tooltip>
    </Container>
  );
};
TooltipTrigger.displayName = "TooltipTrigger";
