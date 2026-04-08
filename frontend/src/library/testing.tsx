import type { PropsWithChildren, ReactNode } from "react";
import styled, { createGlobalStyle, css } from "styled-components";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { Font, FontVariableNames } from "@/components/ui";

const GlobalStyle = createGlobalStyle`${() => css`
  :root {
    /* Installing Geist manually since vitest can't seem to import it properly. */
    ${FontVariableNames.sansSerif}: "Geist", Impact, Arial, sans-serif;
    ${FontVariableNames.monospace}: "Geist Mono", ui-monospace, SFMono-Regular, Roboto Mono, Menlo, Monaco, Liberation Mono, DejaVu Sans Mono, Courier New, monospace;
    ${FontVariableNames.inter}: sans-serif;
    ${FontVariableNames.ibmPlexSans}: sans-serif;

    /* Application Standard values */
    font-family: ${Font.inter};
    font-size: 15px;
  }

  /* cyrillic */
  @font-face {
    font-family: 'Geist';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/geist/v4/gyByhwUxId8gMEwYGFWNOITddY4.woff2) format('woff2');
    unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
  }
  /* latin-ext */
  @font-face {
    font-family: 'Geist';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/geist/v4/gyByhwUxId8gMEwSGFWNOITddY4.woff2) format('woff2');
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  /* latin */
  @font-face {
    font-family: 'Geist';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/geist/v4/gyByhwUxId8gMEwcGFWNOITd.woff2) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* cyrillic */
  @font-face {
    font-family: 'Geist Mono';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/geistmono/v4/or3nQ6H-1_WfwkMZI_qYFrMdmhHkjkotbA.woff2) format('woff2');
    unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
  }
  /* latin-ext */
  @font-face {
    font-family: 'Geist Mono';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/geistmono/v4/or3nQ6H-1_WfwkMZI_qYFrkdmhHkjkotbA.woff2) format('woff2');
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  /* latin */
  @font-face {
    font-family: 'Geist Mono';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/s/geistmono/v4/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2) format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
`}`;

const Container = styled.div`${() => css`
  position: relative;
  display: inline-block;
  padding: 20px;

  /* Application Standard values */
  /* font-family: ${Font.inter};
  font-size: 15px; */
`}`;

const ComponentTester = ({ children }: PropsWithChildren) => {
  return (
    <Container data-testid="ComponentTester">
      <GlobalStyle />
      {children}
    </Container>
  );
};

export async function renderComponent(ui: ReactNode) {
  const component = await render(<ComponentTester>{ui}</ComponentTester>);
  const size = component.getByTestId("ComponentTester").element().getBoundingClientRect();
  await page.viewport(size.width, size.height);
  return component;
}
