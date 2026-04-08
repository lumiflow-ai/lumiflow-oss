"use client";

import { useLayoutEffect } from "react";
import styled from "styled-components";

import { useSessionManager } from "@/library/useSessionManager";

import { CreateDatasetDialogProvider } from "@/components/CreateDatasetDialog";
import { OrganizationContextProvider } from "@/components/contexts/OrganizationContext";
import { RecipeContextProvider } from "@/components/contexts/RecipeContext";
import { CreateMetricSetDialogProvider } from "@/components/modals/CreateMetricSetDialog";
import { Font } from "@/components/ui/fonts";

import { Common } from "@/app/Common";
import BACKEND_URLS from "@/BackendURLs";

import { ArtifactContextProvider } from "./_shared/context";

// MARK: - Styles

const ArtifactsContainer = styled.div`
  font-family: ${Font.inter};
  margin: 0px;
  font-size: 15px;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: 400;
  }

  .fakeData {
    color: deeppink;
  }
`;

export default function ArtifactsLayout({ children }: { children: React.ReactNode }) {
  const { registerLogoutHandler } = useSessionManager();

  useLayoutEffect(
    () =>
      registerLogoutHandler(() => {
        window.location.href = BACKEND_URLS.LOGOUT;
      }),
    [registerLogoutHandler],
  );

  return (
    <Common>
      <style>{`
        html {
          overscroll-behavior: none;
        }
      `}</style>
      <ArtifactsContainer>
        <OrganizationContextProvider>
          <ArtifactContextProvider>
            <RecipeContextProvider>
              <CreateDatasetDialogProvider>
                <CreateMetricSetDialogProvider>{children}</CreateMetricSetDialogProvider>
              </CreateDatasetDialogProvider>
            </RecipeContextProvider>
          </ArtifactContextProvider>
        </OrganizationContextProvider>
      </ArtifactsContainer>
    </Common>
  );
}
