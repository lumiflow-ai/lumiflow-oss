import { describe, expect, test } from "vitest";

import { renderComponent } from "@/library/testing";

import { SegmentedControl, SegmentedControlOption } from "./SegmentedControl.internal";

describe("SegmentedControl", () => {
  test("metrics selected", async () => {
    const component = await renderComponent(
      <SegmentedControl>
        <SegmentedControlOption $isSelected>All Metrics</SegmentedControlOption>
        <SegmentedControlOption>Metric Sets</SegmentedControlOption>
      </SegmentedControl>,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("metric sets selected", async () => {
    const component = await renderComponent(
      <SegmentedControl>
        <SegmentedControlOption>All Metrics</SegmentedControlOption>
        <SegmentedControlOption $isSelected>Metric Sets</SegmentedControlOption>
      </SegmentedControl>,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });
});
