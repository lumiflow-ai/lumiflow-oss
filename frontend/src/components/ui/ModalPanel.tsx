import { type MouseEventHandler, type PropsWithChildren, useCallback } from "react";
import styled, { css } from "styled-components";

import { type StateObject, useBinding } from "@/library/StateObject";

import { Color } from "@/components/ui/colors";
import { Size } from "@/components/ui/sizes";

export const MODAL_MARGIN = 50;

const Constants = {
  emptyInsets: {},
};

export type ModalPresentation = "form" | "fullscreen" | "dialog";

// MARK: - Styles

const ModalBackground = styled.div`${() => css`
  position: absolute;
  display: flex;
  inset: 0px;
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  z-index: 3;
  align-content: center;
  justify-content: center;
  align-items: center;
  justify-items: center;
  overflow: hidden;
`}`;

const ModalContainer = styled.div<{ $presentation: ModalPresentation }>`${({ $presentation }) => css`
  --safe-margin: min(${MODAL_MARGIN}px, 10vw);

  ${() => {
    switch ($presentation) {
      case "fullscreen":
        return css`
        position: absolute;
        inset: var(--safe-margin);
        min-height: 100px;
      `;
      case "form":
      case "dialog":
        return css`
        position: relative;
        display: flex;
        margin: var(--safe-margin);
        max-height: calc(100% - var(--safe-margin) * 2);
        max-width: calc(100% - var(--safe-margin) * 2);
        flex-shrink: 1;
      `;
    }
  }}
  background-color: ${Color.contentSurface};
  outline: ${Size.line.thickness} solid ${Color.line};
  border-radius: 24px;
`}`;

const CloseButton = styled.button`${() => css`
  position: absolute;
  top: 24px;
  right: 24px;
  width: 20px;
  height: 20px;
  background-image: url(/assets/icon-close.svg);
  background-color: transparent;
  background-repeat: no-repeat;
  background-size: contain;
  background-position: center;
  border: none;

  &:hover {
    background-image: url(/assets/icon-close-hover.svg);
  }

  &:active:hover {
    background-image: url(/assets/icon-close-active.svg);
  }
`}`;

// MARK: - Components

export const ModalPanel = ({
  isPresentedState,
  coverInsets = Constants.emptyInsets,
  presentation = "fullscreen",
  children,
}: PropsWithChildren<{
  isPresentedState: StateObject<boolean>;
  /** Insets for the shaded region that no longer gets interactivity while the modal is present. */
  coverInsets?: { top?: number; right?: number; bottom?: number; left?: number };
  /** The presentation style for the modal, either a form or a full screen modal. */
  presentation?: ModalPresentation;
}>) => {
  const [isPresented, setIsPresented] = useBinding(isPresentedState);

  const closePanel: MouseEventHandler = useCallback(
    (event) => {
      if (event.currentTarget !== event.target) return;
      setIsPresented(false);
    },
    [setIsPresented],
  );

  return (
    <ModalBackground
      style={{
        visibility: isPresented ? "visible" : "hidden",
        top: coverInsets.top,
        right: coverInsets.right,
        bottom: coverInsets.bottom,
        left: coverInsets.left,
      }}
      onClick={presentation !== "dialog" ? closePanel : undefined}
    >
      {isPresented && (
        <ModalContainer $presentation={presentation}>
          {children}
          {presentation !== "dialog" && <CloseButton onClick={closePanel} />}
        </ModalContainer>
      )}
    </ModalBackground>
  );
};
ModalPanel.displayName = "ModalPanel";
