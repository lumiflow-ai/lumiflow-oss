/// These should only be used in the root layout.
export const FontVariableNames = {
  sansSerif: "--font-sans-serif",
  monospace: "--font-monospace",
  inter: "--font-inter",
  ibmPlexSans: "--font-ibm-plex-sans",
};

export const Font = {
  sansSerif: `var(${FontVariableNames.sansSerif})`,
  monospace: `var(${FontVariableNames.monospace})`,
  /** Primary UI font for the entire admin panel, used for all text including headings, body, labels, navigation, tables, and dashboards. */
  inter: `var(${FontVariableNames.inter})`,
  /** Supporting font used for Sign In / Sign Up body text, clinical and transcript descriptions, and placeholder text. */
  ibmPlexSans: `var(${FontVariableNames.ibmPlexSans})`,
};
