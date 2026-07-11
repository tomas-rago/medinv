import { RegressionRopModel } from "./regression-rop";
import type { PredictiveModel } from "./base";

// The active model. Swapping in a future ML implementation means changing
// this one assignment; consumers only see the PredictiveModel interface.
export const predictiveModel: PredictiveModel = new RegressionRopModel();

export * from "./base";
