import { describe, expect, test } from "vitest";

import { StateObject } from "@/library/StateObject";
import { renderComponent } from "@/library/testing";

import { ItemNode } from "@/model/keyPath";

import type { TableColumnDescriptor } from "./Table";
import { Table } from "./Table";

describe("Table", () => {
  test("applies percentage widths to header and body cells", async () => {
    const items = [
      new ItemNode({
        id: "row-1",
        item: { name: "Alpha", status: "OK" },
      }),
    ];

    const columns: TableColumnDescriptor[] = [
      { title: "Name", keyPaths: ["name"], width: "30%" },
      { title: "Status", keyPaths: ["status"], width: "70%" },
    ];

    const component = await renderComponent(
      <Table items={items} columnsState={new StateObject(columns)} style={{ width: 300 }} />,
    );

    const nameHeaderCell = component.getByText("Name").element().closest("th");
    const statusHeaderCell = component.getByText("Status").element().closest("th");

    if (!nameHeaderCell || !statusHeaderCell) {
      throw new Error("Missing header cells");
    }

    expect(nameHeaderCell.style.width).toBe("30%");
    expect(nameHeaderCell.style.minWidth).toBe("0px");
    expect(statusHeaderCell.style.width).toBe("70%");
    expect(statusHeaderCell.style.minWidth).toBe("0px");

    const nameBodyCell = component.getByText("Alpha").element().closest("td");
    const statusBodyCell = component.getByText("OK").element().closest("td");

    if (!nameBodyCell || !statusBodyCell) {
      throw new Error("Missing body cells");
    }

    expect(nameBodyCell.style.width).toBe("30%");
    expect(nameBodyCell.style.minWidth).toBe("0px");
    expect(statusBodyCell.style.width).toBe("70%");
    expect(statusBodyCell.style.minWidth).toBe("0px");

    await expect(component.baseElement).toMatchScreenshot();
  });

  test("uses fixed widths on headers for numeric column sizes", async () => {
    const items = [
      new ItemNode({
        id: "row-1",
        item: { name: "Alpha", status: "OK" },
      }),
    ];

    const columns: TableColumnDescriptor[] = [
      { title: "Name", keyPaths: ["name"], width: 120 },
      { title: "Status", keyPaths: ["status"], width: 180 },
    ];

    const component = await renderComponent(
      <Table items={items} columnsState={new StateObject(columns)} style={{ width: 300 }} />,
    );

    const nameHeaderCell = component.getByText("Name").element().closest("th");
    const statusHeaderCell = component.getByText("Status").element().closest("th");

    if (!nameHeaderCell || !statusHeaderCell) {
      throw new Error("Missing header cells");
    }

    expect(nameHeaderCell.style.width).toBe("180px");
    expect(nameHeaderCell.style.minWidth).toBe("120px");
    expect(statusHeaderCell.style.width).toBe("270px");
    expect(statusHeaderCell.style.minWidth).toBe("180px");

    const nameBodyCell = component.getByText("Alpha").element().closest("td");
    const statusBodyCell = component.getByText("OK").element().closest("td");

    if (!nameBodyCell || !statusBodyCell) {
      throw new Error("Missing body cells");
    }

    expect(nameBodyCell.style.width).toBe("");
    expect(statusBodyCell.style.width).toBe("");

    await expect(component.baseElement).toMatchScreenshot();
  });
});
