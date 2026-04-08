export const Color = {
  /** Standard neutral gray used for all line treatments.*/
  line: "rgba(235, 235, 235, 1)",
  /** Background for lines and surfaces that hold primary content. */
  emphasizedLine: "rgb(150, 150, 150)",
  /** Background for left/leading side navigation surfaces. */
  leftSidebar: "rgb(248, 248, 248)",
  /** Background for primary content and trailing side panels. */
  contentSurface: "rgb(255, 255, 255, 1)",
  /** Shared hover highlight color for interactive surface elements. */
  hover: "rgb(245, 245, 245)",
  /** Hover highlight color for navigation menus and sidebars. */
  menuHover: "rgb(255, 255, 255, 1)",
  /** Default table header surface color. */
  tableHeader: "rgba(233, 234, 234, 1)",
  /* Background for Sub table Header. */
  tableSubHeader: "rgba(233, 234, 234, 1)",
  /** Background for summary/computed values like averages rows and aggregate columns. */
  averages: "rgb(248, 249, 250)",
  /** Neutral muted text color used for tertiary navigation labels and metadata. */
  mutedText: "rgba(103, 103, 103, 1)",
  /** Darker text color used for interactive elements and emphasis. */
  emphasizedText: "rgb(26, 26, 26)",
  /** Background for non-prominent buttons and controls. */
  buttonPlain: "rgba(248, 248, 248, 1)",
  /** Background for prominent action buttons. */
  buttonProminent: "rgb(255, 255, 255)",
  /** evaluation button text. */
  evaluationButtonText: "rgb(255, 255, 255)",
  /** Dark text color used across the admin panel for headings, body text, buttons, sidebar labels, table content, transcripts, and placeholders. */
  textDark: "rgb(13, 13, 13, 1)",
  /** Inverted text color for dark surfaces, used for text inside filled black buttons. */
  textOffWhite: "rgba(248, 248, 248, 1)",
  /** Default application surface used for sidebars and pagination icons. */
  surfaceOffWhite: "rgba(248, 248, 248, 1)",
  /** Surface used for input and expected backgrounds. */
  surfaceOffWhiteLight: "rgba(250, 250, 250, 1)",
  /** Background color for interactive row highlights, used on hover and active/selected table rows. */
  surfaceRowHover: "rgba(243, 249, 252, 1)",
  /** Background color for interactive input background. */
  surfaceDivider: "rgba(235, 235, 235, 1)",
  /** Destructive action color used for delete button text and border, with hover showing danger background and textOnDark. */
  danger: "rgba(198, 40, 40, 1)",
  /** Annotation highlight color. */
  annotationHighlight: "rgba(221, 197, 240, 1)",
  /**Evaluation report status colors */
  statusProgress: "rgb(216, 245, 230)",
  statusSuccess: "rgb(52, 195, 143)",
  /** Blue Background for stepper and yes button in evaluation report (filled). */
  blueSurface: "rgba(63,67,194,1)",
  /** Primary action button (filled). */
  buttonfilled: {
    background: "rgb(13, 13, 13)",
    text: "rgba(248, 248, 248, 1)",
    border: "rgb(13, 13, 13)",

    hover: {
      background: "rgba(61, 61, 61, 1)",
      text: "rgba(248, 248, 248, 1)",
      border: "rgba(61, 61, 61, 1)",
    },
  },
  /** Secondary action button (outlined). */
  buttonOutlined: {
    background: "rgba(248, 248, 248, 1)",
    text: "rgb(13, 13, 13)",
    border: "rgb(13, 13, 13)",

    hover: {
      background: "rgba(248, 248, 248, 0.75)",
      text: "rgba(13, 13, 13, 0.75)",
      border: "rgba(13, 13, 13, 0.75)",
    },
  },
  /** Destructive action button. */
  buttonDanger: {
    background: "rgb(255, 255, 255)",
    text: "rgba(198, 40, 40, 1)",
    border: "rgba(198, 40, 40, 1)",

    hover: {
      background: "rgba(198, 40, 40, 1)",
      text: "rgba(248, 248, 248, 1)",
      border: "rgba(198, 40, 40, 1)",
    },
  },
  /** Deny action button with fill. */
  buttonDangerFill: {
    background: "rgba(198, 40, 40, 0.9)",
    border: "rgba(198, 40, 40, 0.9)",

    hover: {
      background: "rgba(198, 40, 40, 1)",
      border: "rgba(198, 40, 40, 1)",
    },

    disable: {
      background: "rgba(198, 40, 40, 0.8)",
      border: "rgba(198, 40, 40, 0.8)",
    },

    active: {
      background: "rgba(198, 40, 40, 0.95)",
      border: "rgba(198, 40, 40, 0.95)",
    },
  },
  /** Neutral action button color used for Cancel and Close buttons. */
  buttonNeutral: {
    background: "rgba(248, 248, 248, 1)",
    text: "rgba(103, 103, 103, 1)",
    border: "rgba(235, 235, 235, 1)",

    hover: {
      background: "rgba(235, 235, 235, 1)",
      text: "rgba(103, 103, 103, 1)",
      border: "rgba(235, 235, 235, 1)",
    },
  },
  /** Neutral action button color used for N/A buttons. */
  buttonNeutralFill: {
    background: "rgba(146, 146, 146, 0.9)",
    border: "rgba(235, 235, 235, 0.9)",

    hover: {
      background: "rgba(146, 146, 146, 1)",
      border: "rgba(146, 146, 146, 1)",
    },

    disable: {
      background: "rgba(146, 146, 146, 0.8)",
      border: "rgba(146, 146, 146, 0.8)",
    },

    active: {
      background: "rgba(146, 146, 146, 0.95)",
      border: "rgba(146, 146, 146, 0.95)",
    },
  },
  /** Success action button color used for Approve buttons. */
  buttonSuccess: {
    background: "rgba(0, 206, 200, 0.9)",
    border: "rgba(0, 206, 200, 0.9)",

    hover: {
      background: "rgba(0, 206, 200, 1)",
      border: "rgba(0, 206, 200, 1)",
    },

    disable: {
      background: "rgba(0, 206, 200, 0.8)",
      border: "rgba(0, 206, 200, 0.8)",
    },

    active: {
      background: "rgba(0, 206, 200, 0.95)",
      border: "rgba(0, 206, 200, 0.95)",
    },
  },
  /** Deny action button color used for Deny buttons. */
  buttonDeny: {
    background: "rgba(255, 77, 77, 0.9)",
    border: "rgba(255, 77, 77, 0.9)",

    hover: {
      background: "rgba(255, 77, 77, 1)",
      border: "rgba(255, 77, 77, 1)",
    },

    disable: {
      background: "rgba(255, 77, 77, 0.8)",
      border: "rgba(255, 77, 77, 0.8)",
    },

    active: {
      background: "rgba(255, 77, 77, 0.95)",
      border: "rgba(255, 77, 77, 0.95)",
    },
  },
} as const;
