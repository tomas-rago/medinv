import { RegressionEoqModel } from "./regression-eoq";
import type { PredictiveModel } from "./base";

// The active model. Swapping in a future ML implementation means changing
// this one assignment; consumers only see the PredictiveModel interface.
export const predictiveModel: PredictiveModel = new RegressionEoqModel();

export * from "./base";
