import { useCallback, useEffect } from "react";
import styled, { css } from "styled-components";

import { type StateObject, useDerivedState } from "@/library/StateObject";
import useLocalStorage from "@/library/useLocalStorage";

import { Button, ModalPanel } from "@/components/ui";

export type FeatureTipSection = {
  heading: string;
  body: string;
};

const Container = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
  align-items: stretch;
  overflow-y: auto;
  max-width: 420px;
  box-sizing: border-box;
`}`;

const Title = styled.h1`${() => css`
  margin: 0px;
  font-size: 18px;
  font-weight: 600;
`}`;

const Section = styled.div`${() => css`
  display: flex;
  flex-direction: column;
  gap: 4px;
`}`;

const SectionHeading = styled.div`${() => css`
  margin: 0px;
  font-size: 15px;
  font-weight: 700;
`}`;

const SectionBody = styled.p`${() => css`
  margin: 0px;
  font-size: 15px;
`}`;

const ButtonsStack = styled.div`${() => css`
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
`}`;

export function FeatureTipDialog({
  localStorageKey,
  title,
  sections,
  isPresentedState,
}: {
  localStorageKey: string;
  title: string;
  sections: FeatureTipSection[];
  isPresentedState: StateObject<boolean>;
}) {
  const [showTip, setShowTip] = useLocalStorage(localStorageKey, true);
  const gatedPresentedState = useDerivedState(
    isPresentedState,
    {
      get: (value) => value && showTip,
      set: (_existingValue, newValue) => newValue,
    },
    [showTip],
  );

  useEffect(() => {
    gatedPresentedState.wrappedValue = isPresentedState.wrappedValue && showTip;
  }, [showTip, isPresentedState, gatedPresentedState]);

  const handleClose = useCallback(() => {
    gatedPresentedState.wrappedValue = false;
  }, [gatedPresentedState]);

  const handleDontShowAgain = useCallback(() => {
    setShowTip(false);
    gatedPresentedState.wrappedValue = false;
  }, [setShowTip, gatedPresentedState]);

  return (
    <ModalPanel isPresentedState={gatedPresentedState} presentation="dialog">
      <Container>
        <Title>{title}</Title>
        {sections.map((section) => (
          <Section key={section.heading}>
            <SectionHeading>{section.heading}</SectionHeading>
            <SectionBody>{section.body}</SectionBody>
          </Section>
        ))}
        <ButtonsStack>
          <Button action={handleDontShowAgain} prominence="secondary">
            Don&apos;t show again
          </Button>
          <Button action={handleClose} keyEquivalent="Enter">
            Close
          </Button>
        </ButtonsStack>
      </Container>
    </ModalPanel>
  );
}
FeatureTipDialog.displayName = "FeatureTipDialog";
