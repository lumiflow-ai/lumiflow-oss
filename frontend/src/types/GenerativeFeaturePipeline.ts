import type { Color } from "./Color";

/**
  A component that represents a generated artifact a human could edit. May or may not be used to feed into further stages.
 */
interface Component {
  id: string;
  name: string;
  isMultiple: boolean;
  output: string | null; // Component ID
}

/**
  A placeholder Stage type to group a feedback cycle between an AI-generation and the artifacts a human can edit.
*/
export interface Stage {
  id: string;
  prompt: string;
  isMultiple: boolean;
  components: Component[];
}

/**
  A set of values for a given metric, keyed by the component in the pipeline they provide values for.
*/
export interface ValueSet {
  [component: string]: number;
}

/**
  The data for a given metric, keyed by the segment the values are linked to.
*/
export interface Metric {
  [segmentID: string]: ValueSet;
}

/**
  A list of metrics, keyed by their type.
*/
export interface MetricCollection {
  [metric: string]: Metric;
}

/**
  A UI-displayable object representing a segment.
*/
export interface SegmentLabel {
  name: string;
  color: Color;
}

/**
  A map of segment IDs as keys to their UI-displayable names as values.
*/
export interface SegmentMap {
  [key: string]: SegmentLabel;
}

/**
  A map of segment IDs as keys to their quantity of data points.

  A single slice should contain no overlapping sets of data points.
*/
export interface Slice {
  [segmentID: string]: number;
}

/**
  A generative feature pipeline, representing all the phases of AI-generation and human-edits for a user's self-contained feature in their product, along with analytics and data metrics to surface insights about how the generative feature is performing.
 */
export interface GenerativeFeaturePipeline {
  /** The ID of the generative feature pipeline. */
  id: string;

  /** The name of the feature to display in the UI or use as reference. */
  name: string;

  /** A list of stages that represent the pipeline. */
  stages: Stage[]; // TODO: Consider how this may look when the model changes over time, perhaps make it versioned?

  /** A map of segment IDs to their UI-displayable names. */
  segmentLabels: SegmentMap;

  /** The metrics attached to the feature pipeline. */
  metrics: MetricCollection; // TODO: This is temporary while the data we generate is manually computed.

  /** The segment dataset counts, organized into slices of non-overlaping datapoints. */
  slices: Slice[];
}
