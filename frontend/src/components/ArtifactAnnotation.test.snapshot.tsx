import { describe, expect, test } from "vitest";

import { renderComponent } from "@/library/testing";

import { ArtifactAnnotation } from "./ArtifactAnnotation";

describe("ArtifactAnnotation", () => {
  test("creation mode", async () => {
    const component = await renderComponent(
      <ArtifactAnnotation
        selectionRange={{ start: 10, end: 32 }}
        selectedText={"Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
        content=""
        initialMode="create"
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("edit mode", async () => {
    const component = await renderComponent(
      <ArtifactAnnotation
        selectionRange={{ start: 4, end: 18 }}
        selectedText={"Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
        content={"This is Latin."}
        initialMode="edit"
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("view mode", async () => {
    const component = await renderComponent(
      <ArtifactAnnotation
        selectionRange={{ start: 15, end: 27 }}
        selectedText={"Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
        content={"This is Latin."}
        updatedAt={"2024-03-01T12:00:00.000Z"}
        initialMode="view"
      />,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });
});
