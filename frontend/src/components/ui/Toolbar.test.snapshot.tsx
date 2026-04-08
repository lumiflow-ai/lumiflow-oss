import { describe, expect, test } from "vitest";

import { renderComponent } from "@/library/testing";

import { Toolbar } from "./Toolbar";
import { ToolbarItem } from "./ToolbarItem";

describe("Toolbar", () => {
  test("Button with action", async () => {
    const component = await renderComponent(
      <div style={{ position: "relative", width: "200px", height: "40px" }}>
        <Toolbar>
          <ToolbarItem title="Create Dataset" variant="primary" action={() => {}} edge="trailing" />
        </Toolbar>
      </div>,
    );
    await expect(component.baseElement).toMatchScreenshot();
  });
});
