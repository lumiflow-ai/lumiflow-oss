// This file is generated. Do not edit.

export type AccountResponse = {
  user: User;
  isEmailVerified: boolean;
};

export type AnnotationID = UUID;

export type AnnotationLocation = {
  start: number;
  end: number;
};

export type Annotation = {
  id: AnnotationID;
  location: AnnotationLocation;
  content: string;
  author: UserID;
  createdTimestamp: ISO8601PreciseTimestamp;
  modifiedTimestamp: ISO8601PreciseTimestamp;
  isDeleted: boolean;
};

export type AnyRecipeStepInput = BaseRecipeStepInput & (RecipeStepConstantInput | RecipeStepArtifactInput | RecipeStepMetricInput);

export type AnyRecipeStepOutput = BaseRecipeStepOutput & (RecipeStepArtifactOutput | RecipeStepSnapshotOutput | RecipeStepMetricOutput);

export type ArtifactContentsRequest = {
  orgID: OrganizationID;
  afterCursor?: string | undefined;
  beforeCursor?: string | undefined;
  limit?: number | undefined;
};

export type ArtifactContentsResponse = {
  artifacts: Artifact[];
  startCursor: string;
  endCursor: string;
};

export type ArtifactID = string;

export type ArtifactKind = string;

export type ArtifactMetricGeneration = {
  eventSummaryID: EventSummaryID;
  recipeRunID: RecipeRunID;
  generationID: GenerationID;
  modelID: string;
  modelParams?: EvaluationModelParameters | undefined;
  endTimestamp: ISO8601PreciseTimestamp;
  didComplete: boolean;
};

export type ArtifactPathComponent = {
  kind?: (ArtifactKind | null) | undefined;
  id: ArtifactID;
};

export type ArtifactPathPatternComponent = {
  kind: ArtifactKind;
  id?: (ArtifactID | null) | undefined;
} | {
  id: ArtifactID;
};

export type ArtifactPathPattern = ArtifactPathPatternComponent[];

export type ArtifactPathRecipeTrigger = {
  id: RecipeTriggerID;
  evaluationGroupID: EvaluationGroupID;
  name: string;
  kind: typeof RecipeTriggerKind.artifactPath;
  creationTimestamp: ISO8601PreciseTimestamp;
  updateTimestamp: ISO8601PreciseTimestamp;
  artifactPathPattern: ArtifactPathPattern;
};

export type ArtifactPath = ArtifactPathComponent[];

export type ArtifactPatternConfiguration = {
  pattern: ArtifactPathPattern;
  displayName: DisplayName;
  allowCreation?: boolean | undefined;
};

export type Artifact = {
  artifactPath: ArtifactPath;
  sourceArtifactPaths?: ArtifactPath[] | undefined;
  snapshots: ArtifactSnapshot[];
  metrics?: Metric[] | undefined;
  generations?: ArtifactMetricGeneration[] | undefined;
};

export type ArtifactSelector = {
  tags?: TagValue[] | undefined;
  artifactPath: ArtifactPath;
  eventSummaryIDs?: EventSummaryID[] | undefined;
  recipeRunIDs?: RecipeRunID[] | undefined;
  generationIDs?: GenerationID[] | undefined;
};

export type ArtifactSnapshotDelta = {
  /** Mapping from annotation ID to annotation */
  annotations?: {
    [x: string]: Annotation;
  } | undefined;
  /** Mapping from MetricReviewID to MetricReview */
  reviews?: {
    [x: string]: MetricReview;
  } | undefined;
  /** Mapping from an evaluation (identified by EvalutionGroupID) to a due date */
  dueDates?: {
    [x: string]: ISO8601PreciseTimestamp;
  } | undefined;
};

export type ArtifactSnapshot = {
  artifactPath?: ArtifactPath | undefined;
  sourceArtifactSelectors?: ArtifactSelector[] | undefined;
  eventSummaryID?: EventSummaryID | undefined;
  tags?: {
    [x: string]: string;
  } | undefined;
  metadata?: {
    [x: string]: string;
  } | undefined;
  timestamp?: ISO8601PreciseTimestamp | undefined;
  content: RenderedContent;
  metrics?: Metric[] | undefined;
  generations?: ArtifactMetricGeneration[] | undefined;
  /** Mapping from annotation ID to annotation */
  annotations?: {
    [x: string]: Annotation;
  } | undefined;
  /** Mapping from MetricReviewID to MetricReview */
  reviews?: {
    [x: string]: MetricReview;
  } | undefined;
  /** Mapping from an evaluation (identified by EvalutionGroupID) to a due date */
  dueDates?: {
    [x: string]: ISO8601PreciseTimestamp;
  } | undefined;
};

export type ArtifactSnapshotStrict = {
  artifactPath: ArtifactPath;
  sourceArtifactSelectors: ArtifactSelector[];
  eventSummaryID: EventSummaryID;
  tags: {
    [x: string]: string;
  };
  metadata: {
    [x: string]: string;
  };
  timestamp: ISO8601PreciseTimestamp;
  content: RenderedContent;
  metrics: MetricStrict[];
  generations: ArtifactMetricGeneration[];
  /** Mapping from annotation ID to annotation */
  annotations: {
    [x: string]: Annotation;
  };
  /** Mapping from MetricReviewID to MetricReview */
  reviews: {
    [x: string]: MetricReview;
  };
  /** Mapping from an evaluation (identified by EvalutionGroupID) to a due date */
  dueDates: {
    [x: string]: ISO8601PreciseTimestamp;
  };
};

export type ArtifactStrict = {
  artifactPath: ArtifactPath;
  snapshots: ArtifactSnapshotStrict[];
  metrics: MetricStrict[];
  generations: ArtifactMetricGeneration[];
};

export type BaseRecipeStepInput = {
  kind: RecipeStepInputKind;
  token: string;
};

export type BaseRecipeStepOutput = {
  kind: RecipeStepOutputKind;
  key: string;
};

export type BaseRecipeStep = {
  id: RecipeStepID;
  name: string;
  kind: RecipeStepKind;
  status: RecipeStepStatus;
  creationTimestamp: ISO8601PreciseTimestamp;
  updateTimestamp: ISO8601PreciseTimestamp;
  dependencies: RecipeStepID[];
};

export type BaseRecipeTrigger = {
  id: RecipeTriggerID;
  evaluationGroupID: EvaluationGroupID;
  name: string;
  kind: RecipeTriggerKind;
  creationTimestamp: ISO8601PreciseTimestamp;
  updateTimestamp: ISO8601PreciseTimestamp;
};

export type BaseWidget = {
  id: WidgetID;
  kind: WidgetKind;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHeight?: number | undefined;
};

export type CSSColor = string;

export type CancelEvaluationRequest = {
  orgID: OrganizationID;
  evaluationGroupID: EvaluationGroupID;
};

export type CancelEvaluationResponse = {
  status: "success";
  cancelledJobCount: number;
};

export const ChartDirection = {
  horizontal: "horizontal",
  vertical: "vertical",
} as const;
export type ChartDirection = typeof ChartDirection[keyof typeof ChartDirection];

export const ChartKind = {
  bar: "bar",
  stackedBar: "stackedBar",
} as const;
export type ChartKind = typeof ChartKind[keyof typeof ChartKind];

export type ChartSeries = {
  title?: string | undefined;
  keyPaths: KeyPath[];
  filter?: Filter | undefined;
  minSize?: number | undefined;
  colors?: (CSSColor | [
    PrimitiveValue,
    CSSColor
  ][]) | undefined;
  legends?: (string | [
    PrimitiveValue,
    string
  ][]) | undefined;
  valueAccumulationStrategy: ChartValueAccumulationStrategy;
  valueNormalization?: ChartValueNormalizationStrategy | undefined;
  minValue?: number | undefined;
  maxValue?: number | undefined;
};

export const ChartValueAccumulationStrategy = {
  count: "count",
  average: "average",
  sum: "sum",
} as const;
export type ChartValueAccumulationStrategy = typeof ChartValueAccumulationStrategy[keyof typeof ChartValueAccumulationStrategy];

export const ChartValueNormalizationStrategy = {
  none: "none",
  ratio: "ratio",
} as const;
export type ChartValueNormalizationStrategy = typeof ChartValueNormalizationStrategy[keyof typeof ChartValueNormalizationStrategy];

export type ChartWidget = {
  id: WidgetID;
  kind: typeof WidgetKind.chart;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHeight?: number | undefined;
  title: string;
  chartKind: ChartKind;
  direction: ChartDirection;
  segmentationKeyPaths: KeyPath[];
  series: ChartSeries[];
  segmentsTitle?: string | undefined;
};

export type ColumnDescriptor = {
  title: string;
  keyPaths: string[];
  width: number | "auto";
  description?: string | undefined;
};

export type ContentWidget = {
  id: WidgetID;
  kind: typeof WidgetKind.content;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHeight?: number | undefined;
  childArtifactPath: ArtifactPath;
  showsContext: boolean;
};

export type CopyRecipeStep = {
  id: RecipeStepID;
  name: string;
  kind: typeof RecipeStepKind.copy;
  status: RecipeStepStatus;
  creationTimestamp: ISO8601PreciseTimestamp;
  updateTimestamp: ISO8601PreciseTimestamp;
  dependencies: RecipeStepID[];
  inputs: RecipeStepMetricInput[];
  outputs: RecipeStepArtifactOutput[];
};

export type CreateArtifactRequest = {
  orgID: OrganizationID;
  parentArtifactPath?: ArtifactPath | undefined;
  id: string;
  timestamp: ISO8601PreciseTimestamp;
  input: string;
  output: string;
  metadata?: {
    [x: string]: string;
  } | undefined;
};

export type CreateArtifactResponse = {
  url: URL;
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
};

export type CreateOrganizationRequest = {
  name: string;
};

export type CreateOrganizationResponse = {
  organization: Organization;
};

export type CreateSnapshotsRequest = {
  orgID: OrganizationID;
  snapshots: ArtifactSnapshotStrict[];
};

export type CreateSnapshotsResponse = {
  url: URL;
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
}[];

export const DashboardContext = {
  list: "list",
  detail: "detail",
} as const;
export type DashboardContext = typeof DashboardContext[keyof typeof DashboardContext];

export type DashboardID = UUID;

export type Dashboard = {
  id: DashboardID;
  widgets: Widget[];
};

export type DefaultDashboardRequest = {
  orgID: OrganizationID;
  patterns: (ArtifactPathPattern | ArtifactPath)[];
  context: DashboardContext;
};

export type DefaultDashboardResponse = {
  dashboard: Dashboard;
};

export type DeleteArtifactContentsRequest = {
  orgID: OrganizationID;
  artifactPath: ArtifactPath;
  eventSummaryID?: EventSummaryID | undefined;
  /** Delete all sub-artifacts with paths that start with this artifact's path (default: false) */
  deleteSubartifacts?: boolean | undefined;
};

export type DeleteArtifactContentsResponse = {
  status: "success" | "error";
  message: string;
};

export type DisplayName = {
  zero?: string | undefined;
  one: string;
  two?: string | undefined;
  few?: string | undefined;
  many?: string | undefined;
  other: string;
  evaluate?: string | undefined;
};

export type EvaluateRecipeStep = {
  id: RecipeStepID;
  name: string;
  kind: typeof RecipeStepKind.evaluate;
  status: RecipeStepStatus;
  creationTimestamp: ISO8601PreciseTimestamp;
  updateTimestamp: ISO8601PreciseTimestamp;
  dependencies: RecipeStepID[];
  inputs: AnyRecipeStepInput[];
  outputs: (BaseRecipeStepOutput & (RecipeStepSnapshotOutput | RecipeStepMetricOutput))[];
  promptTemplate: string;
  userPrompt: string;
  model: RecipeEvaluationModel;
};

export type EvaluationGroupID = UUID;

export type EvaluationModelConfiguration = {
  id: string;
  displayName: string;
  description: string;
  provider: string;
  costMultiplier: string;
  defaultParameters?: EvaluationModelParameters | undefined;
};

export type EvaluationModelParameters = {
  temperature?: number | undefined;
  topP?: number | undefined;
  maxNewTokens?: number | undefined;
};

export type EventSummaryID = UUID;

export type ExportMetricsRequest = {
  orgID: OrganizationID;
  metricSetID?: string | undefined;
};

export type Filter = PrimitiveValueFilter | KeyPathFilter | GroupFilter;

export type GenerationID = string;

export const GroupFilterOperator = {
  all: "all",
  any: "any",
  none: "none",
} as const;
export type GroupFilterOperator = typeof GroupFilterOperator[keyof typeof GroupFilterOperator];

export type GroupFilter = {
  operator: GroupFilterOperator;
  filters: Filter[];
};

export type ISO8601PreciseTimestamp = string | string;

export type KeyPathFilter = {
  operator: ValueFilterOperator;
  keyPath: KeyPath;
  value: PrimitiveValue;
};

export type KeyPath = string;

export type LoadRecipesRequest = {
  orgID: OrganizationID;
};

export type LoadRecipesResponse = {
  recipes: Recipe[];
  cancelledEvaluationGroupIDs: EvaluationGroupID[];
};

export type MetricDefinition = {
  id: MetricID;
  precursorID?: MetricID | undefined;
  isDeleted?: true | undefined;
  name: string;
  description?: string | undefined;
  order?: string | undefined;
  group?: string | undefined;
  relatedMetricsIDs?: MetricID[] | undefined;
  metricValueAggregationRule?: MetricValueAggregationRule | undefined;
  displayValues?: [
    PrimitiveValue,
    string
  ][] | undefined;
  acceptanceValue?: Filter | undefined;
  rejectionValue?: Filter | undefined;
  kind?: ("string" | "number" | "boolean" | "icon") | undefined;
  unit?: string | undefined;
  color?: string | undefined;
};

export type MetricDefinitionsRequest = {
  orgID: OrganizationID;
  afterCursor?: string | undefined;
  beforeCursor?: string | undefined;
  limit?: number | undefined;
};

export type MetricDefinitionsResponse = {
  metricDefinitions: MetricDefinition[];
  startCursor: string;
  endCursor: string;
};

export type MetricDisplay = {
  metricID: MetricID;
  title?: string | undefined;
  matchingValues?: PrimitiveValue[] | undefined;
};

export type MetricExample = {
  artifactPath: ArtifactPath;
  matchingContent?: PrimitiveValue | undefined;
  relation?: string | undefined;
};

export type MetricID = string;

export type MetricRecording = {
  eventSummaryID: EventSummaryID;
  recipeRunID?: RecipeRunID | undefined;
  generationID?: GenerationID | undefined;
  evaluationGroupID: EvaluationGroupID;
  value: PrimitiveValue;
  examples?: MetricExample[] | undefined;
};

export type MetricRecordingStrict = {
  eventSummaryID: EventSummaryID;
  recipeRunID: RecipeRunID;
  generationID: GenerationID;
  evaluationGroupID: EvaluationGroupID;
  value: PrimitiveValue;
  examples?: MetricExample[] | undefined;
};

export type MetricReviewID = UUID;

export type MetricReview = {
  id: MetricReviewID;
  metricId: MetricID;
  recipeRunId: RecipeRunID;
  evaluationGroupId: EvaluationGroupID;
  value: MetricReviewValue;
  author: UserID;
  createdTimestamp: ISO8601PreciseTimestamp;
  modifiedTimestamp: ISO8601PreciseTimestamp;
};

export const MetricReviewValue = {
  approved: "approved",
  denied: "denied",
  not_applicable: "not_applicable",
} as const;
export type MetricReviewValue = typeof MetricReviewValue[keyof typeof MetricReviewValue];

export type Metric = {
  id: MetricID;
  values: MetricRecording[];
  isMock?: boolean | undefined;
};

export type MetricStrict = {
  id: MetricID;
  values: MetricRecordingStrict[];
  isMock?: true | undefined;
};

export const MetricValueAggregationRule = {
  uniqueValues: "uniqueValues",
  uniformValues: "uniformValues",
  anyTrue: "anyTrue",
  allTrue: "allTrue",
  concatenate: "concatenate",
} as const;
export type MetricValueAggregationRule = typeof MetricValueAggregationRule[keyof typeof MetricValueAggregationRule];

export const MetricValuesDisplayKind = {
  value: "value",
  examples: "examples",
} as const;
export type MetricValuesDisplayKind = typeof MetricValuesDisplayKind[keyof typeof MetricValuesDisplayKind];

export type MetricValuesDisplay = {
  title?: string | undefined;
  childArtifactPath: ArtifactPath;
  displayKind: MetricValuesDisplayKind;
  width: number | "auto";
  displayValues?: [
    PrimitiveValue,
    string
  ][] | undefined;
};

export type MetricsListWidget = {
  id: WidgetID;
  kind: typeof WidgetKind.metricsList;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHeight?: number | undefined;
  metrics: MetricDisplay[];
  groups?: string[] | undefined;
  valueColumns: MetricValuesDisplay[];
};

export type MetricsWidget = {
  id: WidgetID;
  kind: typeof WidgetKind.metrics;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHeight?: number | undefined;
  metrics: MetricDisplay[];
};

export type OrgConfigurationRequest = {
  orgID: OrganizationID;
};

export type OrgConfigurationResponse = {
  artifactPatterns: ArtifactPatternConfiguration[];
  genericArtifactName: DisplayName;
};

export type OrgEvaluationModelsRequest = {
  orgID: OrganizationID;
};

export type OrgEvaluationModelsResponse = {
  evaluationModels: EvaluationModelConfiguration[];
  defaultEvaluationModelID: string;
};

export type OrgUsersRequest = {
  orgID: OrganizationID;
};

export type OrgUsersResponse = {
  users: User[];
};

export type OrganizationID = UUID;

export type Organization = {
  id: OrganizationID;
  name: string;
  template?: OrganizationTemplate | undefined;
  isDeleted?: true | undefined;
};

export const OrganizationTemplate = {
  demo: "demo",
  general: "general",
} as const;
export type OrganizationTemplate = typeof OrganizationTemplate[keyof typeof OrganizationTemplate];

export type OrganizationsResponse = {
  orgs: Organization[];
};

export type PartialArtifactPathRecipeTrigger = {
  id: RecipeTriggerID;
  evaluationGroupID?: EvaluationGroupID | undefined;
  name?: string | undefined;
  kind: typeof RecipeTriggerKind.artifactPath;
  creationTimestamp?: ISO8601PreciseTimestamp | undefined;
  updateTimestamp?: ISO8601PreciseTimestamp | undefined;
  artifactPathPattern?: ArtifactPathPattern | undefined;
};

export type PartialBaseRecipeTrigger = {
  id: RecipeTriggerID;
  evaluationGroupID?: EvaluationGroupID | undefined;
  name?: string | undefined;
  kind: RecipeTriggerKind;
  creationTimestamp?: ISO8601PreciseTimestamp | undefined;
  updateTimestamp?: ISO8601PreciseTimestamp | undefined;
};

export type PartialMetricDefinition = {
  id: MetricID;
  precursorID?: (MetricID | null) | undefined;
  isDeleted?: (true | null) | undefined;
  name?: string | undefined;
  description?: (string | null) | undefined;
  order?: (string | null) | undefined;
  group?: (string | null) | undefined;
  relatedMetricsIDs?: (MetricID[] | null) | undefined;
  metricValueAggregationRule?: (MetricValueAggregationRule | null) | undefined;
  displayValues?: ([
    PrimitiveValue,
    string
  ][] | null) | undefined;
  acceptanceValue?: (Filter | null) | undefined;
  rejectionValue?: (Filter | null) | undefined;
  kind?: (("string" | "number" | "boolean" | "icon") | null) | undefined;
  unit?: (string | null) | undefined;
  color?: (string | null) | undefined;
};

export type PartialRecipe = {
  id: RecipeID;
  name?: string | undefined;
  description?: (string | null) | undefined;
  isDeleted?: (true | null) | undefined;
  stepUpdates?: (string | RecipeStep)[] | undefined;
  triggerUpdates?: (string | RecipeTrigger)[] | undefined;
  creationTimestamp?: ISO8601PreciseTimestamp | undefined;
  updateTimestamp?: ISO8601PreciseTimestamp | undefined;
};

export type PartialRecipeTrigger = PartialBaseRecipeTrigger & (PartialArtifactPathRecipeTrigger);

export const PluralityClass = {
  zero: "zero",
  one: "one",
  two: "two",
  few: "few",
  many: "many",
  other: "other",
  evaluate: "evaluate",
} as const;
export type PluralityClass = typeof PluralityClass[keyof typeof PluralityClass];

export type PreviewRecipeRequest = {
  orgID: OrganizationID;
  metricName?: string | undefined;
  question: string;
  artifactSelectors: ArtifactSelector[];
  evaluateChildArtifactPaths: ArtifactPath[];
  evaluationModelID?: string | undefined;
};

export type PreviewRecipeResponse = {
  status: "success";
  steps: RecipeStep[];
  metrics: [
    ArtifactPath,
    Metric
  ][];
  metricDefinition: MetricDefinition;
};

export type PrimitiveValueFilter = {
  operator: ValueFilterOperator;
  value: PrimitiveValue;
};

export type PrimitiveValue = boolean | string | number | null;

export type RecipeEvaluationModel = {
  name: string;
  parameters: {
    temperature?: number | undefined;
    topP?: number | undefined;
    maxNewTokens?: number | undefined;
  };
};

export type RecipeID = string;

export type RecipeRunID = string;

export type Recipe = {
  id: RecipeID;
  name: string;
  description?: string | undefined;
  isDeleted?: true | undefined;
  creationTimestamp: ISO8601PreciseTimestamp;
  updateTimestamp: ISO8601PreciseTimestamp;
  triggers: RecipeTrigger[];
  steps: RecipeStep[];
};

export type RecipeStepArtifactInput = {
  kind: typeof RecipeStepInputKind.artifact;
  token: string;
  input: {
    childArtifactPath: ArtifactPath;
    keyPath: KeyPath;
  };
};

export type RecipeStepArtifactOutput = {
  kind: typeof RecipeStepOutputKind.artifact;
  key: string;
  output: {
    childArtifactPath: ArtifactPath;
    metricValueAggregationRule: MetricValueAggregationRule;
  };
};

export type RecipeStepConstantInput = {
  kind: typeof RecipeStepInputKind.constant;
  token: string;
  input: string;
};

export type RecipeStepID = string;

export const RecipeStepInputKind = {
  constant: "constant",
  artifact: "artifact",
  metric: "metric",
} as const;
export type RecipeStepInputKind = typeof RecipeStepInputKind[keyof typeof RecipeStepInputKind];

export const RecipeStepKind = {
  evaluate: "evaluate",
  copy: "copy",
} as const;
export type RecipeStepKind = typeof RecipeStepKind[keyof typeof RecipeStepKind];

export type RecipeStepMetricInput = {
  kind: typeof RecipeStepInputKind.metric;
  token: string;
  input: {
    childArtifactPath: ArtifactPath;
    metricID: MetricID;
  };
};

export type RecipeStepMetricOutput = {
  kind: typeof RecipeStepOutputKind.metric;
  key: string;
  output: {
    childArtifactPath: ArtifactPath;
    metricID: MetricID;
    includeEvidence: boolean;
  };
};

export const RecipeStepOutputKind = {
  artifact: "artifact",
  snapshot: "snapshot",
  metric: "metric",
} as const;
export type RecipeStepOutputKind = typeof RecipeStepOutputKind[keyof typeof RecipeStepOutputKind];

export type RecipeStep = BaseRecipeStep & (EvaluateRecipeStep | CopyRecipeStep);

export type RecipeStepSnapshotOutput = {
  kind: typeof RecipeStepOutputKind.snapshot;
  key: string;
  output: {
    childArtifactPath: ArtifactPath;
  };
};

export const RecipeStepStatus = {
  enabled: "enabled",
  disabled: "disabled",
  migrated: "migrated",
  hidden: "hidden",
} as const;
export type RecipeStepStatus = typeof RecipeStepStatus[keyof typeof RecipeStepStatus];

export type RecipeTriggerID = string;

export const RecipeTriggerKind = {
  artifactPath: "artifactPath",
} as const;
export type RecipeTriggerKind = typeof RecipeTriggerKind[keyof typeof RecipeTriggerKind];

export type RecipeTrigger = BaseRecipeTrigger & (ArtifactPathRecipeTrigger);

export type RecordArtifactContentsRequest = {
  orgID: OrganizationID;
  artifactPath: ArtifactPath;
  snapshots: ArtifactSnapshotStrict[];
};

export type RecordArtifactContentsResponse = {
  message: string;
} & ({
  status: "success";
  artifact: Artifact;
} | {
  status: "error";
});

export type RecordMetricDefinitionRequest = {
  orgID: OrganizationID;
  metricDefinition: PartialMetricDefinition;
};

export type RecordMetricDefinitionResponse = {
  status: "success";
  metricDefinition: MetricDefinition;
};

export type RecordRecipeRequest = {
  orgID: OrganizationID;
  recipe: PartialRecipe;
};

export type RecordRecipeResponse = {
  status: "success";
  recipe: Recipe;
};

export type RenderedContent = PrimitiveValue | {
  [x: string]: RenderedContent;
};

export type RunRecipesRequest = {
  orgID: OrganizationID;
  recipeIDs: RecipeID[];
  evaluationGroupIDs: EvaluationGroupID[];
  evaluationModelID?: string | undefined;
};

export type RunRecipesResponse = {
  status: "success" | "error";
  message?: string | undefined;
};

export type SignupRequest = {
  org: {
    name: string;
  };
  user: {
    fullName: string;
  };
};

export type SignupResponse = {
  organization: Organization;
};

export const TableConfigurationContext = {
  list: "list",
  detail: "detail",
} as const;
export type TableConfigurationContext = typeof TableConfigurationContext[keyof typeof TableConfigurationContext];

export type TableConfigurationRequest = {
  orgID: OrganizationID;
  kind?: (string | null) | undefined;
  context: TableConfigurationContext;
};

export type TableConfigurationResponse = {
  table: TableDescriptor | null;
};

export const TableContents = {
  artifact: "artifact",
  type: "type",
  snapshot: "snapshot",
  generation: "generation",
} as const;
export type TableContents = typeof TableContents[keyof typeof TableContents];

export type TableDescriptor = ColumnDescriptor[];

export type TableWidget = {
  id: WidgetID;
  kind: typeof WidgetKind.table;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHeight?: number | undefined;
  contents: TableContents;
  filter?: Filter | undefined;
  columns: ColumnDescriptor[];
  showsNestedArtifacts: boolean;
};

export type TagValue = {
  tag: string;
  value: string;
};

export type URL = string;

export type UUID = string;

export type UpdateArtifactSnapshotRequest = {
  orgID: OrganizationID;
  artifactPath: ArtifactPath;
  eventSummaryID: EventSummaryID;
  snapshotDelta: ArtifactSnapshotDelta;
};

export type UpdateArtifactSnapshotResponse = {
  status: "success" | "error";
  message: string;
};

export type UserID = string;

export type User = {
  id: UserID;
  email: string;
  fullName: string;
};

export const ValueFilterOperator = {
  equal: "equal",
  notEqual: "notEqual",
  greaterThan: "greaterThan",
  lessThan: "lessThan",
  greaterThanOrEqual: "greaterThanOrEqual",
  lessThanOrEqual: "lessThanOrEqual",
} as const;
export type ValueFilterOperator = typeof ValueFilterOperator[keyof typeof ValueFilterOperator];

export type WidgetID = UUID;

export const WidgetKind = {
  chart: "chart",
  content: "content",
  metrics: "metrics",
  metricsList: "metricsList",
  table: "table",
} as const;
export type WidgetKind = typeof WidgetKind[keyof typeof WidgetKind];

export type Widget = BaseWidget & (ChartWidget | ContentWidget | MetricsWidget | MetricsListWidget | TableWidget);
