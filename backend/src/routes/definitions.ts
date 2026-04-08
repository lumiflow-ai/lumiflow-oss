import { installAPIExtensions } from "@/lib/apiGeneration";

installAPIExtensions();

export * from "./account/definitions";
export * from "./artifacts/definitions";
export * from "./configuration/definitions";
export * from "./dashboards/definitions";
export * from "./org/definitions";
export * from "./orgs/definitions";
export * from "./recipe/definitions";
export * from "./signup/definitions";
