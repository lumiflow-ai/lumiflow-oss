import { describe, expect, test } from "vitest";

import { renderComponent } from "@/library/testing";

import { StatusIcon } from "@/components/ui";

import { MetricIconSelection } from "./MetricIconSelection";

const renderMetricIcon = async ({
  reviewStatus,
  isSelected,
}: {
  reviewStatus?: "approved" | "denied" | "not_applicable";
  isSelected?: boolean;
}) => {
  return renderComponent(
    <MetricIconSelection data-review-status={reviewStatus} data-selected={isSelected}>
      <StatusIcon icon="check" />
    </MetricIconSelection>,
  );
};

describe("MetricIconSelection", () => {
  test("icon not reviewed", async () => {
    const component = await renderMetricIcon({});
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon reviewed approved", async () => {
    const component = await renderMetricIcon({ reviewStatus: "approved" });
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon reviewed denied", async () => {
    const component = await renderMetricIcon({ reviewStatus: "denied" });
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon reviewed n/a", async () => {
    const component = await renderMetricIcon({ reviewStatus: "not_applicable" });
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon not reviewed highlighted selection (blue)", async () => {
    const component = await renderMetricIcon({ isSelected: true });
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon reviewed approved + highlighted selection (blue)", async () => {
    const component = await renderMetricIcon({ reviewStatus: "approved", isSelected: true });
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon reviewed denied + highlighted selection (blue)", async () => {
    const component = await renderMetricIcon({ reviewStatus: "denied", isSelected: true });
    await expect(component.baseElement).toMatchScreenshot();
  });

  test("icon reviewed n/a + highlighted selection (blue)", async () => {
    const component = await renderMetricIcon({ reviewStatus: "not_applicable", isSelected: true });
    await expect(component.baseElement).toMatchScreenshot();
  });
});
