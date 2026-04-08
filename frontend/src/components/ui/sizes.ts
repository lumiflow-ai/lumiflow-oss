export const Size = {
  line: {
    /** Standard thickness for borders, outlines, and line-like treatments. */
    thickness: "1.5px",
  },
  fontSize: {
    /** Small auxiliary text used for table values, metadata, and other low-emphasis supporting content. */
    fontSize12: "0.75rem",
    /** Base body text used for body copy, subheadings, buttons, form labels, table content, and general UI text. */
    fontSize14: "0.875rem",
    /** Font size for modal and dialog headings, used exclusively for modal titles and dialog headers. */
    fontSize16: "clamp(0.875rem, 0.8481rem + 0.1266vw, 1rem)",
    /** Font size for section and table headings, used for table headers. */
    fontSize20: "clamp(1rem, 0.9462rem + 0.2532vw, 1.25rem)",
    /** Font size for authentication page headings, used for Sign In and Sign Up page titles. */
    fontSize32: "clamp(1.25rem, 1.0886rem + 0.7595vw, 2rem)",
  },
} as const;
