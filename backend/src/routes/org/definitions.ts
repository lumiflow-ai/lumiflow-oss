import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

export * from "./configuration/definitions";
export * from "./evaluationModels/definitions";
export * from "./metrics/definitions";
export * from "./users/definitions";
