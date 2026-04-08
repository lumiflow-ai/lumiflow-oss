import { describe, expect, test } from "vitest";

import { useStateObject } from "@/library/StateObject";
import { renderComponent } from "@/library/testing";

import { FeatureTipDialog } from "./FeatureTipDialog";

const ModalWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: "relative", width: 500, height: 550 }}>{children}</div>
);

describe("FeatureTipDialog", () => {
  test("displays with sections", async () => {
    const TestDialog = () => {
      const isPresentedState = useStateObject(true);
      return (
        <FeatureTipDialog
          localStorageKey="test:featureTipDialog"
          title="Your first annotation"
          isPresentedState={isPresentedState}
          sections={[
            {
              heading: "Your data has been uploaded",
              body: "You can find all your datasets on the left menu bar",
            },
            {
              heading: "Select text to annotate",
              body: "Click at the start of any text, hold down, and drag to create your first annotation.",
            },
            {
              heading: "Track everything on the right",
              body: "Your annotation will show up on the right side panel.",
            },
          ]}
        />
      );
    };

    const component = await renderComponent(
      <ModalWrapper>
        <TestDialog />
      </ModalWrapper>,
    );

    await expect(component.baseElement).toMatchScreenshot();
  });
});
