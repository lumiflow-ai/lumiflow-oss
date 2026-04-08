import { describe, expect, test } from "vitest";

import { renderComponent } from "@/library/testing";

import { Button } from "./Button";

describe("Button", () => {
  test("Standard", async () => {
    const component = await renderComponent(<Button>Test</Button>);
    await expect(component.baseElement).toMatchScreenshot();
  });
});
