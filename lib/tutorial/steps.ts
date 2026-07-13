export type TutorialStep = {
  /** i18n suffix: Tutorial.<screen>.<id>_title / <id>_body */
  id: string;
  /** data-tutorial attribute value; undefined renders a centered intro card */
  target?: string;
};

export type ScreenId =
  | "dashboard"
  | "products"
  | "stock"
  | "alerts"
  | "purchases"
  | "providers"
  | "receptors"
  | "predictive"
  | "users"
  | "settings";

/**
 * Steps whose target is missing at runtime (role-gated buttons, empty states)
 * are silently dropped by the overlay, so it's safe to register steps that
 * only some users will see.
 */
export const TUTORIALS: Record<ScreenId, TutorialStep[]> = {
  dashboard: [
    { id: "intro" },
    { id: "kpis", target: "kpis" },
    { id: "main", target: "main" },
  ],
  products: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  stock: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "tabs", target: "tabs" },
    { id: "actions", target: "actions" },
  ],
  alerts: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  purchases: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  providers: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  receptors: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  predictive: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  users: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "actions", target: "actions" },
  ],
  settings: [
    { id: "intro" },
    { id: "main", target: "main" },
    { id: "password", target: "password" },
  ],
};

const SCREEN_BY_PATH: Record<string, ScreenId> = {
  "/dashboard": "dashboard",
  "/products": "products",
  "/stock": "stock",
  "/alerts": "alerts",
  "/purchases": "purchases",
  "/providers": "providers",
  "/receptors": "receptors",
  "/predictive": "predictive",
  "/users": "users",
  "/settings": "settings",
};

export function resolveScreenId(pathname: string): ScreenId | null {
  return SCREEN_BY_PATH[pathname] ?? null;
}

export const tutorialStorageKey = (screen: ScreenId) => `medinv.tutorial.v1.${screen}`;
