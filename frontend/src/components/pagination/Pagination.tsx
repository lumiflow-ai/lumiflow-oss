"use client";

import Image from "next/image";
import styled from "styled-components";

import { Color, Size } from "../ui";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  marginBottom?: string;
}

const PaginationContainer = styled.div<{ $marginBottom?: string }>`
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 16px;
  color: ${Color.mutedText};
  font-size: ${Size.fontSize.fontSize14};
  margin-bottom: ${({ $marginBottom = "2.3rem" }) => $marginBottom};
  margin-right: 1rem;`;

const PageInfo = styled.span``;

const NavButton = styled.button`
  width: 40px;
  height: 32px;
  border-radius: 12px;
  border: ${Size.line.thickness} solid ${Color.line};
  background: ${Color.surfaceOffWhite};
  font-size: ${Size.fontSize.fontSize16};
  cursor: pointer;
  color: ${Color.textDark};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }`;

export function Pagination({ page, totalPages, onPrev, onNext, marginBottom }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <PaginationContainer $marginBottom={marginBottom}>
      <PageInfo>
        Page: {page} out of {totalPages}
      </PageInfo>

      <NavButton onClick={onPrev} disabled={page === 1}>
        <Image src="/assets/adminPanel/left-arrow-icon.svg" alt="Previous" width={20} height={20} />
      </NavButton>

      <NavButton onClick={onNext} disabled={page === totalPages}>
        <Image src="/assets/adminPanel/right-arrow-icon.svg" alt="Previous" width={20} height={20} />
      </NavButton>
    </PaginationContainer>
  );
}
