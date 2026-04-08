import { type CSSProperties, createContext, memo, type PropsWithChildren, useContext, useMemo } from "react";

import { NamedComponent, type PropsWithClassName } from "@/library/NamedComponent";

import { Size } from "./sizes";

// MARK: - Types

export type ControlSize = "small" | "regular" | "large";
export type ControlProminence = "primary" | "secondary" | "default" | "dangerous";
type DefaultControlContextProps = {
  isEnabled?: boolean;
  size?: ControlSize;
  prominence?: ControlProminence;
  id?: string;
};
export type ControlProps = DefaultControlContextProps &
  PropsWithClassName & {
    style?: CSSProperties | undefined;
  };

// MARK: - Constants

export const ControlVariableNames = {
  smallFontSize: "--control-font-size-small",
  regularFontSize: "--control-font-size-regular",
  largeFontSize: "--control-font-size-large",

  smallControlHeight: "--control-height-small",
  regularControlHeight: "--control-height-regular",
  largeControlHeight: "--control-height-large",

  smallControlPadding: "--control-padding-small",
  regularControlPadding: "--control-padding-regular",
  largeControlPadding: "--control-padding-large",

  accentColor: "--control-accent-color",
};

export const ControlCSSConstants = {
  accentColor: `var(${ControlVariableNames.accentColor}, rgb(15, 148, 255))`,
};

export const ControlCSSMetrics = {
  small: {
    fontSize: `var(${ControlVariableNames.smallFontSize}, ${Size.fontSize.fontSize14})`,
    controlHeight: `var(${ControlVariableNames.smallControlHeight}, 22px)`,
    controlPadding: `var(${ControlVariableNames.smallControlPadding}, 8px)`,
  },

  regular: {
    fontSize: `var(${ControlVariableNames.regularFontSize}, ${Size.fontSize.fontSize14})`,
    controlHeight: `var(${ControlVariableNames.regularControlHeight}, 32px)`,
    controlPadding: `var(${ControlVariableNames.regularControlPadding}, 12px)`,
  },

  large: {
    fontSize: `var(${ControlVariableNames.largeFontSize},  ${Size.fontSize.fontSize14})`,
    controlHeight: `var(${ControlVariableNames.largeControlHeight}, 40px)`,
    controlPadding: `var(${ControlVariableNames.largeControlPadding}, 12px)`,
  },
};

// MARK: - Contexts

const DefaultControlContext = createContext<DefaultControlContextProps>({});

// MARK: - Hooks

export const useControlDefaults = (override: DefaultControlContextProps) => {
  const sharedContext = useContext(DefaultControlContext);
  return useMemo(
    () => ({
      id: override.id ?? sharedContext.id,
      isEnabled: override.isEnabled ?? sharedContext.isEnabled ?? true,
      size: override.size ?? sharedContext.size ?? "regular",
      prominence: override.prominence ?? sharedContext.prominence ?? "default",
    }),
    [sharedContext, override.id, override.isEnabled, override.size, override.prominence],
  );
};

// MARK: - Components

export const DefaultControlProvider = memo(
  ({ children, ...override }: PropsWithChildren & DefaultControlContextProps) => {
    const controlDefaults = useControlDefaults(override);
    return <DefaultControlContext.Provider value={controlDefaults}>{children}</DefaultControlContext.Provider>;
  },
);
DefaultControlProvider.displayName = "DefaultControlProvider";

export const ControlContainer = NamedComponent(
  "ControlContainer",
  ({
    id,
    style,
    children,
    className,
    ...override
  }: { id?: string; style?: CSSProperties } & PropsWithClassName &
    PropsWithChildren &
    Omit<DefaultControlContextProps, "id">) => {
    return (
      <DefaultControlProvider {...override}>
        <div id={id} style={style} className={className}>
          {children}
        </div>
      </DefaultControlProvider>
    );
  },
);
