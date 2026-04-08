// This file is generated. Do not edit. 

export type CancelEvaluationRequest = {
    orgID: string;
    evaluationGroupID: string;
};

export type CancelEvaluationResponse = CancelEvaluationSuccessResponse | ErrorResponse;

export type CancelEvaluationSuccessResponse = {
    type: "success";
    cancelledJobCount: number;
};

export type CreateJobRequest = {
    kind: "evaluateRecipeStep" | "scheduleRecipeEvaluation";
    priority?: number | undefined;
    generationID?: string | undefined;
    orgID: string;
    recipeRunID?: string | undefined;
    eventSummaryID?: string | undefined;
    callbackURL: string | null;
    inputs: {
        [x: string]: unknown;
    };
};

export type CreateJobSuccessResponse = {
    type: "success";
    generationID: string;
};

export type ErrorResponse = {
    type: "error";
    reason: string;
};

export type JobResponse = CreateJobSuccessResponse | ErrorResponse;

export type ResponseType = "success" | "error";