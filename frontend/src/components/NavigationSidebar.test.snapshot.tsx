import { describe, expect, test } from "vitest";

import { renderComponent } from "@/library/testing";

import { __visibleForTesting } from "./NavigationSidebar";

describe("NavigationSidebar", () => {
  describe("generic text-only", () => {
    test("deselected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.NavigationLink href={"http://example.org"} data-selected={false}>
          Navigation
        </__visibleForTesting.NavigationLink>,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });
    test("selected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.NavigationLink href={"http://example.org"} data-selected={true}>
          Navigation
        </__visibleForTesting.NavigationLink>,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });
  });

  describe("actuals", () => {
    test("datasets deselected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.DatasetsNavigationLink href={"http://example.org"} selected={false} />,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });

    test("datasets selected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.DatasetsNavigationLink href={"http://example.org"} selected={true} />,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });

    test("metrics deselected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.MetricsNavigationLink href={"http://example.org"} selected={false} />,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });

    test("metrics selected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.MetricsNavigationLink href={"http://example.org"} selected={true} />,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });

    test("evaluations deselected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.EvaluationsNavigationLink href={"http://example.org"} selected={false} />,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });

    test("evaluations selected", async () => {
      const component = await renderComponent(
        <__visibleForTesting.EvaluationsNavigationLink href={"http://example.org"} selected={true} />,
      );
      await expect(component.baseElement).toMatchScreenshot();
    });
  });
});
