import {
  type Dashboard,
  type OrganizationID,
  OrganizationTemplate,
  TableContents,
  ValueFilterOperator,
  WidgetKind,
} from "@/types";

import { AuthorizationError, AuthorizationRequirement } from "@/lib/authorization";
import { RouteGroup } from "@/lib/routeGroup";

import { encodeArtifactPathPattern } from "@/model/artifactPath";

import { OrgIDs } from "@/user";

import { configurationMap as tableConfigurationMap } from "../configuration/loadTableConfiguration";

import { DefaultDashboardRequestSchema, DefaultDashboardResponseSchema } from "./definitions";

const demoConfigurationMap = new Map<string, Dashboard>([
  [
    "root",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Dataset", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Artifacts", keyPaths: ["numberOfDirectChildren"], width: 160 },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          filter: {
            keyPath: "kind",
            operator: ValueFilterOperator.equal,
            value: "dataset",
          },
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "list*",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Dataset", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Artifacts", keyPaths: ["numberOfDirectChildren"], width: 160 },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail*",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 6,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Child ID", keyPaths: ["id"], width: "auto" },
            { title: "Type", keyPaths: ["kind"], width: 120 },
            { title: "Total Children", keyPaths: ["numberOfChildren"], width: 160 },
            { title: "Timestamp", keyPaths: ["creationTimestamp"], width: 170 },
          ],
          showsNestedArtifacts: true,
        },
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 6,
          y: 0,
          width: 6,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [],
          showsContext: true,
        },
      ],
    },
  ],
  [
    "list-dataset:",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Dataset", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Artifacts", keyPaths: ["numberOfDirectChildren"], width: 160 },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Artifact", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: true,
        },
      ],
    },
  ],
  [
    "list-dataset:/artifact:",
    {
      id: "2ec361ab-ccee-41a5-b5e2-112202260f33",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Artifact", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:/artifact:",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 0,
          y: 0,
          width: 6,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [{ id: "input" }],
          showsContext: false,
        },
        {
          kind: WidgetKind.content,
          id: "35c5ab32-1038-4ecd-9e74-0b82f11a7650",
          x: 6,
          y: 0,
          width: 6,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [{ id: "output" }],
          showsContext: true,
        },
      ],
    },
  ],
  [
    "list-dataset:/artifact:/input",
    {
      id: "2ec361ab-ccee-41a5-b5e2-112202260f33",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Input", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:/artifact:/input",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 0,
          y: 0,
          width: 12,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [],
          showsContext: false,
        },
      ],
    },
  ],
  [
    "list-dataset:/artifact:/output",
    {
      id: "2ec361ab-ccee-41a5-b5e2-112202260f33",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Expected", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:/artifact:/output",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 0,
          y: 0,
          width: 12,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [],
          showsContext: false,
        },
      ],
    },
  ],
]);

const configurationMap = new Map<OrganizationID, Map<string, Dashboard>>([
  [
    OrgIDs.demo.coding,
    new Map([
      [
        "root",
        {
          id: "00000000-0000-0000-0000-000000000000",
          widgets: [
            {
              kind: WidgetKind.table,
              id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
              x: 0,
              y: 0,
              width: 12,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              contents: TableContents.artifact,
              columns: [
                { title: "Project", keyPaths: ["metadata.name", "id"], width: "auto" },
                {
                  title: "Overall Intent Match",
                  keyPaths: ["metrics.81206c71-facf-4243-9250-fe2141b4e6d4"],
                  width: 120,
                },
                {
                  title: "Progressed Conversation",
                  keyPaths: ["metrics.09caa455-3685-494f-832c-95abdfdd4093"],
                  width: 120,
                },
                { title: "Timestamp", keyPaths: ["creationTimestamp"], width: 170 },
              ],
              filter: {
                keyPath: "kind",
                operator: ValueFilterOperator.equal,
                value: "project",
              },
              showsNestedArtifacts: false,
            },
          ],
        },
      ],
      [
        "list-project:",
        {
          id: "00000000-0000-0000-0000-000000000000",
          widgets: [
            {
              kind: WidgetKind.table,
              id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
              x: 0,
              y: 0,
              width: 12,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              contents: TableContents.artifact,
              columns: [
                { title: "Project", keyPaths: ["metadata.name", "id"], width: "auto" },
                {
                  title: "Overall Intent Match",
                  keyPaths: ["metrics.81206c71-facf-4243-9250-fe2141b4e6d4"],
                  width: 120,
                },
                {
                  title: "Progressed Conversation",
                  keyPaths: ["metrics.09caa455-3685-494f-832c-95abdfdd4093"],
                  width: 120,
                },
                { title: "Timestamp", keyPaths: ["creationTimestamp"], width: 170 },
              ],
              showsNestedArtifacts: false,
            },
          ],
        },
      ],
      [
        "detail-project:",
        {
          id: "00000000-0000-0000-0000-000000000000",
          widgets: [
            {
              kind: WidgetKind.metrics,
              id: "496e167d-68d9-41ce-85b7-53b05bd8be90",
              x: 0,
              y: 0,
              width: 12,
              height: 1,
              metrics: [
                { metricID: "81206c71-facf-4243-9250-fe2141b4e6d4" },
                { metricID: "09caa455-3685-494f-832c-95abdfdd4093" },
              ],
            },
            {
              kind: WidgetKind.table,
              id: "09940541-55a4-4e45-b6c1-815b4ff30619",
              x: 0,
              y: 1,
              width: 12,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              contents: TableContents.artifact,
              columns: [
                { title: "Turn", keyPaths: ["id"], width: "auto" },
                { title: "Matches Intent", keyPaths: ["metrics.47b7abdb-b22b-40fe-8b0d-ce595fee3ed3"], width: 160 },
                {
                  title: "Progresses Conversation",
                  keyPaths: ["metrics.09caa455-3685-494f-832c-95abdfdd4093"],
                  width: 160,
                },
                {
                  title: "Refines Functionality",
                  keyPaths: ["metrics.a82ade58-b054-4a56-8840-f2ac2a5e19e5"],
                  width: 160,
                },
                { title: "Refines Style", keyPaths: ["metrics.361a0845-19b1-4205-83df-8e791c0bd376"], width: 160 },
                { title: "Refines Layout", keyPaths: ["metrics.ea6cf26e-abf6-4236-bee0-d9da253cd359"], width: 160 },
                { title: "Refines Copy", keyPaths: ["metrics.4d87bd3e-7fb0-4037-b7c3-85bcf2c792aa"], width: 160 },
                { title: "Timestamp", keyPaths: ["creationTimestamp"], width: 170 },
              ],
              showsNestedArtifacts: true,
            },
          ],
        },
      ],
      [
        "detail-project:/turn:",
        {
          id: "00000000-0000-0000-0000-000000000000",
          widgets: [
            {
              kind: WidgetKind.metrics,
              id: "496e167d-68d9-41ce-85b7-53b05bd8be90",
              x: 0,
              y: 0,
              width: 3,
              height: 1,
              metrics: [
                { metricID: "47b7abdb-b22b-40fe-8b0d-ce595fee3ed3" },
                { metricID: "09caa455-3685-494f-832c-95abdfdd4093" },
              ],
            },
            {
              kind: WidgetKind.metrics,
              id: "4d11d626-fb4d-458c-a2a3-e8b94df74ed4",
              x: 3,
              y: 0,
              width: 9,
              height: 1,
              metrics: [
                { metricID: "a82ade58-b054-4a56-8840-f2ac2a5e19e5" },
                { metricID: "361a0845-19b1-4205-83df-8e791c0bd376" },
                { metricID: "ea6cf26e-abf6-4236-bee0-d9da253cd359" },
                { metricID: "4d87bd3e-7fb0-4037-b7c3-85bcf2c792aa" },
              ],
            },
            {
              kind: WidgetKind.content,
              id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
              x: 0,
              y: 1,
              width: 6,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              childArtifactPath: [{ id: "user" }],
              showsContext: false,
            },
            {
              kind: WidgetKind.content,
              id: "35c5ab32-1038-4ecd-9e74-0b82f11a7650",
              x: 6,
              y: 1,
              width: 6,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              childArtifactPath: [{ id: "assistant" }],
              showsContext: true,
            },
          ],
        },
      ],
      [
        "detail-project:/turn:/assistant",
        {
          id: "00000000-0000-0000-0000-000000000000",
          widgets: [
            {
              kind: WidgetKind.content,
              id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
              x: 0,
              y: 0,
              width: 12,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              childArtifactPath: [],
              showsContext: false,
            },
          ],
        },
      ],
      [
        "detail-project:/turn:/user",
        {
          id: "00000000-0000-0000-0000-000000000000",
          widgets: [
            {
              kind: WidgetKind.content,
              id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
              x: 0,
              y: 0,
              width: 12,
              height: 2,
              maxHeight: Number.POSITIVE_INFINITY,
              childArtifactPath: [],
              showsContext: false,
            },
          ],
        },
      ],
    ]),
  ],
]);

for (const [orgID, tableDescriptors] of tableConfigurationMap) {
  let dashboardDescriptors = configurationMap.get(orgID);
  if (!dashboardDescriptors) {
    dashboardDescriptors = new Map<string, Dashboard>();
    configurationMap.set(orgID, dashboardDescriptors);
  }

  for (const [pattern, tableDescriptor] of tableDescriptors) {
    if (dashboardDescriptors.has(pattern)) continue;
    dashboardDescriptors.set(pattern, {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: tableDescriptor,
          showsNestedArtifacts: pattern.startsWith("detail"),
        },
      ],
    });
  }
}

const defaultDashboard: Dashboard = {
  id: "00000000-0000-0000-0000-000000000000",
  widgets: [
    {
      kind: WidgetKind.table,
      id: "00000000-0000-0000-0000-000000000000",
      x: 0,
      y: 0,
      width: 12,
      height: 2,
      maxHeight: Number.POSITIVE_INFINITY,
      contents: TableContents.artifact,
      columns: [
        { title: "Dataset", keyPaths: ["metadata.name", "id"], width: "auto" },
        { title: "Artifacts", keyPaths: ["numberOfDirectChildren"], width: 160 },
        { title: "Creation Date", keyPaths: ["creationTimestamp.date"], width: 170 },
      ],
      showsNestedArtifacts: false,
    },
  ],
};

const defaultDetailDashboard: Dashboard = {
  id: "00000000-0000-0000-0000-000000000000",
  widgets: [
    {
      kind: WidgetKind.table,
      id: "00000000-0000-0000-0000-000000000000",
      x: 0,
      y: 0,
      width: 6,
      height: 2,
      maxHeight: Number.POSITIVE_INFINITY,
      contents: TableContents.artifact,
      columns: [
        { title: "Child ID", keyPaths: ["id"], width: "auto" },
        { title: "Type", keyPaths: ["kind"], width: 120 },
        { title: "Total Children", keyPaths: ["numberOfChildren"], width: 160 },
        { title: "Timestamp", keyPaths: ["creationTimestamp"], width: 170 },
      ],
      showsNestedArtifacts: true,
    },
    {
      kind: WidgetKind.content,
      id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
      x: 6,
      y: 0,
      width: 6,
      height: 2,
      maxHeight: Number.POSITIVE_INFINITY,
      childArtifactPath: [],
      showsContext: true,
    },
  ],
};

const defaultDashboardConfigurations: Map<string, Dashboard> = new Map([
  [
    "root",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Dataset", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Artifacts", keyPaths: ["numberOfDirectChildren"], width: 160 },
            { title: "Creation Date", keyPaths: ["creationTimestamp.date"], width: 170 },
          ],
          filter: {
            keyPath: "kind",
            operator: ValueFilterOperator.equal,
            value: "dataset",
          },
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  ["list*", defaultDashboard],
  ["detail*", defaultDetailDashboard],
  [
    "list-dataset:",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "00000000-0000-0000-0000-000000000000",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Dataset", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Artifacts", keyPaths: ["numberOfDirectChildren"], width: 160 },
            { title: "Creation Date", keyPaths: ["creationTimestamp.date"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Artifact", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: true,
        },
      ],
    },
  ],
  [
    "list-dataset:/artifact:",
    {
      id: "2ec361ab-ccee-41a5-b5e2-112202260f33",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Artifact ID", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Children", keyPaths: ["numberOfDirectChildren"], width: 160 },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:/artifact:",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 0,
          y: 0,
          width: 6,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [{ id: "input" }],
          showsContext: false,
        },
        {
          kind: WidgetKind.content,
          id: "35c5ab32-1038-4ecd-9e74-0b82f11a7650",
          x: 6,
          y: 0,
          width: 6,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [{ id: "output" }],
          showsContext: true,
        },
      ],
    },
  ],
  [
    "list-dataset:/artifact:/input",
    {
      id: "2ec361ab-ccee-41a5-b5e2-112202260f33",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Input ID", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:/artifact:/input",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 0,
          y: 0,
          width: 12,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [],
          showsContext: false,
        },
      ],
    },
  ],
  [
    "list-dataset:/artifact:/output",
    {
      id: "2ec361ab-ccee-41a5-b5e2-112202260f33",
      widgets: [
        {
          kind: WidgetKind.table,
          id: "79c0aefb-4b30-4008-98b6-b221399ceae5",
          x: 0,
          y: 0,
          width: 12,
          height: 2,
          maxHeight: Number.POSITIVE_INFINITY,
          contents: TableContents.artifact,
          columns: [
            { title: "Output ID", keyPaths: ["metadata.name", "id"], width: "auto" },
            { title: "Creation Date", keyPaths: ["creationTimestamp.sortableDate"], width: 170 },
          ],
          showsNestedArtifacts: false,
        },
      ],
    },
  ],
  [
    "detail-dataset:/artifact:/output",
    {
      id: "00000000-0000-0000-0000-000000000000",
      widgets: [
        {
          kind: WidgetKind.content,
          id: "3d28d5f7-7dab-4939-b303-00bb2abd1bad",
          x: 0,
          y: 0,
          width: 12,
          height: 4,
          maxHeight: Number.POSITIVE_INFINITY,
          childArtifactPath: [],
          showsContext: false,
        },
      ],
    },
  ],
]);

export const loadDefault = new RouteGroup();
loadDefault.get(
  "default",
  {
    requestSchema: DefaultDashboardRequestSchema,
    responseSchema: DefaultDashboardResponseSchema,
    auth: AuthorizationRequirement.session,
  },
  async (request, context) => {
    const orgID = request.orgID.toLowerCase() as OrganizationID;
    const user = context.user;
    if (!user?.organizations.has(orgID)) {
      throw new AuthorizationError();
    }

    const organization = user.organizations.get(orgID);

    const configurations =
      configurationMap.get(orgID) ??
      (organization?.template === OrganizationTemplate.demo ? demoConfigurationMap : undefined);
    /// If there are no patterns, first check for a root dashboard.
    if (request.patterns.length === 0) {
      const dashboard = configurations?.get("root");
      if (dashboard) return { dashboard };
    }

    /// Next, try each pattern, checking for a match in the org configuration.
    for (const pattern of request.patterns) {
      const encodedPattern = encodeArtifactPathPattern(pattern);
      const dashboard = configurations?.get(encodedPattern ? `${request.context}-${encodedPattern}` : "root");
      if (dashboard) return { dashboard };
    }

    /// Next, check the org configuration for a wildcard match.
    const dashboard = configurations?.get(`${request.context}*`);
    if (dashboard) return { dashboard };

    /// Next, if there are no patterns, check for a default root dashboard.
    if (request.patterns.length === 0) {
      const defaultRootDashboard = defaultDashboardConfigurations.get("root");
      if (defaultRootDashboard) return { dashboard: defaultRootDashboard };
    }

    /// Next, try each pattern, checking for a match in the default configurations.
    for (const pattern of request.patterns) {
      const encodedPattern = encodeArtifactPathPattern(pattern);
      const defaultPatternDashboard = defaultDashboardConfigurations.get(
        encodedPattern ? `${request.context}-${encodedPattern}` : "root",
      );
      if (defaultPatternDashboard) return { dashboard: defaultPatternDashboard };
    }

    /// Finally, check the default configuration for a wildcard match, or fallback to basic defaults based on the context.
    return {
      dashboard:
        defaultDashboardConfigurations.get(`${request.context}*`) ??
        (request.context === "list" ? defaultDashboard : defaultDetailDashboard),
    };
  },
);
