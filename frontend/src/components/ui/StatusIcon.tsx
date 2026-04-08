import { NamedComponent } from "@/library/NamedComponent";

import { type ControlProps, useControlDefaults } from "@/components/ui/Control";
import { Icon } from "@/components/ui/Icon";

// MARK: - Types

export type StatusIcon = "check" | "dash" | "dot" | "xmark" | "warning";

// MARK: - Component

export const StatusIcon = NamedComponent(
  "StatusIcon",
  ({
    icon,
    isSelected = false,
    action,
    style,
    className,
    ...controlProps
  }: {
    icon: StatusIcon | null;
    isSelected?: boolean;
    action?: () => void;
  } & ControlProps) => {
    const { id, size } = useControlDefaults(controlProps);

    return (
      <Icon
        onClick={action}
        id={id}
        className={className}
        style={style}
        $icon={icon}
        $size={size}
        data-selected={isSelected}
        data-interactive={!!action}
      />
    );
  },
);
