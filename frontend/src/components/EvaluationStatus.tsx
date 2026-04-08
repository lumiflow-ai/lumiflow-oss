import styled, { css } from "styled-components";

import type { EvaluationStatus } from "@/model/evaluationStatus";

import { Color, Font, Size } from "@/components/ui";

export const EvaluationMetadata = styled.div`${() => css`
  margin: 2px 0 0 0;
  font-size: ${Size.fontSize.fontSize12};
  font-family: ${Font.ibmPlexSans};
  line-height: 1.2;
  color: ${Color.textDark};
`}`;

const StatusContainer = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const StatusText = styled.span`
  color: ${Color.textDark};
`;

const LoaderContainer = styled.div<{ $circleSize: number }>`
  position: relative;
  width: 50px;
  height: ${({ $circleSize }) => Math.max(20, $circleSize)}px;
`;

const Circle = styled.div<{ direction: "left" | "right"; $circleSize: number }>`
  position: absolute;
  width: ${({ $circleSize }) => $circleSize}px;
  height: ${({ $circleSize }) => $circleSize}px;
  border-radius: 50%;
  background: ${({ direction }) => (direction === "left" ? Color.blueSurface : Color.statusSuccess)};
  top: 0;

  ${({ direction }) =>
    direction === "left"
      ? css`
          animation: moveLeft 1s linear infinite;
        `
      : css`
          animation: moveRight 1s linear infinite;
        `}

  @keyframes moveLeft {
    0% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(40px);
    }
    100% {
      transform: translateX(0);
    }
  }

  @keyframes moveRight {
    0% {
      transform: translateX(40px);
    }
    50% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(40px);
    }
  }
`;

export const EvaluationStatusMessage = ({
  status,
  circleSize = 15,
}: {
  status: EvaluationStatus;
  circleSize?: number;
}) => {
  if (status === "Done") {
    return (
      <StatusContainer>
        <StatusText>Status: Done</StatusText>
      </StatusContainer>
    );
  }

  if (status === "Failed") {
    return (
      <StatusContainer>
        <StatusText>Status: Failed</StatusText>
      </StatusContainer>
    );
  }

  if (status === "Cancelled") {
    return (
      <StatusContainer>
        <StatusText>Status: Cancelled</StatusText>
      </StatusContainer>
    );
  }

  return (
    <StatusContainer>
      <StatusText>Status: Evaluation running...</StatusText>
      <LoaderContainer $circleSize={circleSize}>
        <Circle direction="left" $circleSize={circleSize} />
        <Circle direction="right" $circleSize={circleSize} />
      </LoaderContainer>
    </StatusContainer>
  );
};
