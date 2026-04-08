import { z } from "zod";

import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

// MARK: - Identifiers

export const MetricIDSchema = z.string().api("MetricID");

// MARK: - Metric Value Aggregation Rule

export const MetricValueAggregationRuleSchema = z
  .enum(["uniqueValues", "uniformValues", "anyTrue", "allTrue", "concatenate"])
  .api("MetricValueAggregationRule");
