import { type PropsWithChildren, useCallback } from "react";
import styled, { css } from "styled-components";

import { type StateObject, useBinding } from "@/library/StateObject";

import { Button, ModalPanel } from "@/components/ui";

// MARK: - Styles

const Container = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 12px;
  align-items: stretch;
  overflow-y: auto;
  max-width: 420px;
  box-sizing: border-box;
`}`;

const Title = styled.h1`${() => css`
  margin: 0px;
  font-size: 20px;
  font-weight: 400;
`}`;

const Message = styled.p`${() => css`
  font-size: 15px;
  margin: 0px;
`}`;

const ButtonsStack = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 12px;
`}`;

// MARK: - Component

export function ConfirmationDialog({
  isPresentedState,
  title,
  message,
  children,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isProcessing = false,
  isDangerous = true,
}: PropsWithChildren<{
  isPresentedState: StateObject<boolean>;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isProcessing?: boolean;
  isDangerous?: boolean;
}>) {
  const [isPresented, setIsPresented] = useBinding(isPresentedState);

  const handleCancel = useCallback(() => {
    if (!isPresented) return;
    setIsPresented(false);
    onCancel?.();
  }, [isPresented, onCancel, setIsPresented]);

  const handleConfirm = useCallback(() => {
    if (!isPresented || isProcessing) return;
    setIsPresented(false);
    onConfirm?.();
  }, [isPresented, isProcessing, onConfirm, setIsPresented]);

  return (
    <ModalPanel isPresentedState={isPresentedState} presentation="dialog">
      <Container>
        <Title>{title}</Title>
        {message ? <Message>{message}</Message> : children}
        <ButtonsStack>
          <Button action={handleCancel} keyEquivalent="Escape" isEnabled={!isProcessing}>
            {cancelLabel}
          </Button>
          <Button action={handleConfirm} keyEquivalent="Enter" isEnabled={!isProcessing} isDangerous={isDangerous}>
            {confirmLabel}
          </Button>
        </ButtonsStack>
      </Container>
    </ModalPanel>
  );
}
ConfirmationDialog.displayName = "ConfirmationDialog";
