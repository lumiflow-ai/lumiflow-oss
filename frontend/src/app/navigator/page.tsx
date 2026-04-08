"use client"; // Putting this at the top level so it'll propagate all the way down for simplicity

import { useRouter } from "next/navigation";
import { useContext, useLayoutEffect } from "react";
import styled, { css } from "styled-components";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import { NavigationContent, NavigationStack } from "@/components/ui";

// MARK: - Styles

const CenteredContents = styled.h2`${() => css`
  position: relative;
  display: flex;
  opacity: 0.4;
  align-self: center;
  align-items: center;
  height: 100%;
  font-weight: 400;
`}`;

// MARK: - Components

export default function MainPage() {
  const { organizationSlug, isLoading } = useContext(OrganizationContext);

  const router = useRouter();

  useLayoutEffect(() => {
    if (!organizationSlug) return;
    router.push(`/app/${organizationSlug}/artifacts`);
  }, [router, organizationSlug]);

  return (
    <NavigationStack>
      <NavigationContent scrollsVertically>
        <CenteredContents>
          {isLoading ? "Loading…" : !organizationSlug ? "Please check back soon." : ""}
        </CenteredContents>
      </NavigationContent>
    </NavigationStack>
  );
}
