# Feature Specification: Alerts, Order Management, Providers, Predictive Management, LLM Assistance, Home/UI

## Purpose of this document

This spec defines **what** needs to be built and **why**, along with the business rules, edge cases, and open decisions that affect the plan. It intentionally does **not** prescribe file structure, component names, database schema, or code patterns — those already exist in this codebase and follow established conventions (multi-tenant RLS via `app_metadata`, Server Actions + Zod, `useActionState`, minimal `'use client'`, server-side pagination, the abstract predictive-model interface, the existing token quota system, etc.).

**Instruction to Claude Code:** Before producing a plan, explore the current codebase and confirm the assumptions and open questions listed in each section below against what actually exists (schema, roles, existing patterns for stock ingress, quota tracking, etc.). Where an assumption is wrong or a question is unanswered, surface it in the plan rather than guessing.

---

## Cross-cutting concerns (apply to every module below)

- **Multi-tenancy:** every new table/entity must be scoped by `organization_id` and follow the existing RLS pattern (`app_metadata` as source of truth, not profile joins).
- **Roles:** current roles are admin / operator / read-only. Any feature below that references a role not in this set (see Dashboard, below) must have that resolved before implementation — either mapped onto an existing role or added as a new one, which has downstream effects on every RLS policy and the home screen shortcut matrix.
- **LLM feature gating:** confirm whether the chatbot and "explain" features are gated by the existing Mercado Pago plan-based access control, same as other LLM features, or available to all plans.
- **Token quota:** confirm whether chatbot and "explain" usage both count against the existing per-user monthly quota (`uso_tokens` / `consumo_mensual`), and whether they need separate sub-limits.
- **Reuse over new patterns:** stock changes resulting from order acceptance should reuse the existing stock ingress flow/logic rather than introduce a parallel path.
- **Testing:** new tables need RLS policy test coverage, consistent with the existing testing priority.

---

## 1. Alerts & Notifications Module

### Goal
Configurable alerts for low stock and near-expiration supplies, surfaced in-app and optionally via email.

### Business rules to define
- **Scope of configuration:** per-organization default thresholds, with optional per-product override — or global-only? Who can configure (admin only, or operator too)?
- **Expiration tracking:** current stock is tracked at box level with no batch/lot concept, and expiration dates are manually entered. A single product can arrive in multiple orders with different expiration dates. Decide: does an expiry alert apply per-batch (requires introducing lot-level expiry tracking) or per-product (a single expiry date per product, simpler but less accurate)? This is a real data-model decision, not just a UI one.
- **Alert lifecycle:** states needed — e.g. active / acknowledged / dismissed / resolved. Should an alert re-trigger daily until resolved, or fire once?
- **Recipients:** which roles receive which alert types? Is email opt-in per user, or role-driven?
- **Email delivery:** real-time per alert, or digest (e.g. daily summary)? What email-sending mechanism is available in the project already (if any) — this needs to be confirmed during Explore.
- **Dedup:** avoid re-sending identical alerts repeatedly for the same underlying condition.

### Acceptance criteria (draft — refine after decisions above)
- Admin can configure low-stock and expiry thresholds, globally and/or per product.
- In-app alert list is visible to relevant roles, scoped to their organization.
- Alerts can be marked as read/dismissed.
- If email is enabled, matching users receive email notifications for triggered alerts.

### Out of scope (MVP)
- SMS/push notifications.
- Alert escalation workflows (e.g. auto-escalate to admin after N days unacknowledged) — unless explicitly requested later.

### Open questions
- Batch/lot-level expiry tracking: in or out for this pass?
- Email provider/infrastructure availability — confirm during Explore.
- Notification digest vs real-time.

---

## 2. Order Management (Compras) Module

### Goal
Create and manage purchase orders for supplies, optionally tied to a provider, through to reconciliation with what's actually received.

### State machine to define
Minimum states implied by the request: **Created → (sent to provider, optional) → Received → Accepted or Declined.**
Decisions needed:
- Is provider optional at creation only, or can an order exist with no provider through its whole lifecycle (e.g. informal/manual restocking logged as an "order" for record-keeping)?
- **Partial receipt:** real-world receiving is rarely all-or-nothing. Does the spec support partial acceptance per line item (some products match the order, some don't), or is it strictly all-or-nothing per order? This materially changes the acceptance flow and should be decided before planning.
- **Decline behavior:** what actually happens on decline — is the order marked declined with no stock impact, or is there a follow-up correction/dispute step? Does declined data still get logged for audit/predictive purposes even though it wasn't accepted?
- **Accept behavior:** confirmed to optionally add stock of received supplies — should reuse the existing stock ingress flow.
- **Cost data:** does an order line item carry a cost/price per unit? This is needed later for EOQ (ordering cost) even if not required for the order flow itself. Decide now to avoid a schema addition later.

### Acceptance criteria (draft)
- User with appropriate role can create an order specifying supplies, quantities, and optionally a provider.
- Order can be marked as received, triggering a reconciliation step against the original order.
- On accept, stock increases via the existing ingress mechanism (respecting box-level MVP unit assumption).
- On decline, no stock change occurs, and the discrepancy is recorded.
- Order history is visible and filterable per organization.

### Out of scope (MVP)
- Automated sending of the order to the provider (email/API) — unless explicitly desired; clarify whether "provider" is just a record for tracking or an active communication target.
- Multi-currency or tax handling.

### Open questions
- Partial acceptance: in or out?
- Does an order need cost/pricing fields now for future EOQ use?
- Does "provider" receive any communication when an order is created, or is this purely internal record-keeping?

---

## 3. Provider Management

### Goal
Track providers and which supplies each one provides.

### Business rules to define
- Can a supply have multiple providers? (Likely yes — needed for order creation and future EOQ cost comparison.)
- Does the provider-supply relationship carry a price, or is pricing only captured at order time?
- Minimum provider fields needed for order creation (contact info, etc.) — driven by whether order communication (see Module 2) is in scope.

### Acceptance criteria (draft)
- Admin can add/edit providers.
- Admin can associate providers with the supplies they provide.
- Provider list is filterable/searchable when creating an order.

### Out of scope (MVP)
- Provider performance scoring/rating.
- Automated provider communication (unless decided otherwise above).

---

## 4. Predictive Management (Regression + EOQ)

### Goal
Extend the existing predictive interface (`modelos/base.ts` abstraction, already established) with a mathematical model that produces restocking guidance using consumption regression and Economic Order Quantity (EOQ).

### Business rules to define
- **Data source:** regression runs against historical stock movement (consumption rate) — confirm sufficient history exists per product; define fallback behavior when a product has too little history (e.g. default to simple average, or omit from predictions until enough data exists).
- **EOQ inputs:** EOQ requires demand rate, ordering cost, and holding cost per unit — none of which currently exist in the schema. These need a source: either manual configuration per organization/product, or derived from order cost data (see Module 2's open question about order-line cost).
- **Output:** define exactly what predictive management produces — e.g. reorder point, suggested order quantity, suggested order date/frequency — and where each output is consumed (dashboard, alerts, chatbot, or all three).
- **Model swap path:** must conform to the existing abstract interface pattern so a future ML-based model can replace the formula-based one without touching calling code.

### Acceptance criteria (draft)
- System calculates, per product, a suggested reorder point and order quantity based on consumption history and EOQ inputs.
- Predictions are exposed via an endpoint consumable by both the dashboard and the chatbot.
- Predictions respect multi-tenancy (organization-scoped).

### Out of scope (MVP)
- Machine-learning-based forecasting (explicitly deferred — this is why the abstract interface exists).
- Seasonality modeling, unless specifically requested.

### Open questions
- Where do ordering cost and holding cost come from?
- Minimum data threshold and fallback behavior for new/low-history products.

---

## 5. LLM Chatbot (Stock & Predictive Assistant)

### Goal
A chatbot that can query stock and predictive endpoints to answer questions and make stock-management suggestions.

### Business rules to define
- **Action boundary:** is the chatbot strictly read-only (queries data, suggests actions in text) for this pass, or can it take actions directly (e.g. create a draft order)? Given this is a health-adjacent system, defaulting to read-only-with-human-confirmation is the safer MVP scope unless you specify otherwise.
- **Tool scope:** which specific endpoints/tools should it have access to (stock levels, predictive suggestions, alerts) — confirm this list explicitly rather than leaving it open-ended.
- **Role access:** which roles can use the chatbot?
- **Quota:** confirm it shares the existing per-user token quota system rather than needing a separate one.

### Acceptance criteria (draft)
- Chatbot can answer questions about current stock levels and predictive suggestions using tool calls to the relevant endpoints.
- Chatbot usage is metered against the existing quota system.
- Chatbot respects organization scoping (cannot see or reference another organization's data).

### Out of scope (MVP)
- Autonomous order creation without human confirmation (unless explicitly requested).

---

## 6. LLM Inline Context Analysis ("Explain" Button)

### Goal
A per-screen contextual analysis feature that summarizes or suggests actions based on the current screen's state, using a system prompt built for that context.

### Business rules to define
- **Screen scope:** which screens get this button in the first pass — all screens, or specifically inventory/predictive/dashboard screens where analysis adds the most value?
- **Interaction model:** one-shot generation (no back-and-forth), likely streamed similarly to the existing assistant route.
- **Quota:** shares the same quota system as the chatbot, or separately tracked?

### Acceptance criteria (draft)
- On supported screens, a button triggers a contextual summary/suggestion using the current screen's data as context.
- Response is streamed to the user.
- Usage is metered consistently with the rest of the LLM quota system.

### Out of scope (MVP)
- Screens not explicitly listed as in-scope for this feature.

---

## 7. Predictive Dashboard (Chief Doctor role)

### Goal
A dashboard summarizing predictive stock status for a "chief doctor" persona.

### Open question — blocking
Current roles are admin / operator / read-only. "Chief doctor" is not one of them. Before this can be planned, decide:
- Does "chief doctor" map onto the existing **read-only** role, or does it require a new role in the role model (with the corresponding RLS and permission-matrix updates that implies)?

### Acceptance criteria (draft, pending role decision)
- Dashboard surfaces predictive management output (reorder points, at-risk products, trends) in a summary view appropriate for a non-operational, oversight-focused user.
- Scoped to the viewer's organization.

---

## 8. UI: Home Section & Responsiveness

### Home section
- Role-appropriate shortcuts to relevant actions, with user-friendly (non-technical) messaging.
- **Depends on** the final permission matrix across all modules above (alerts, orders, providers, predictive, chatbot) — this should be one of the last things planned, once role/permission decisions elsewhere are settled.

### Responsiveness
- Make existing screens responsive.
- Define scope: all existing screens, or a prioritized subset? Define target viewport breakpoints/devices if there's a specific expectation (e.g. tablet use in a dispensary setting is common — confirm if that's a driving use case).

---

## Suggested build order (dependency-driven)

1. **Providers** — no dependencies, needed by Orders.
2. **Order Management** — depends on Providers; also produces cost data potentially needed by Predictive (EOQ).
3. **Alerts & Notifications** — can proceed in parallel with Orders; expiry-tracking decision should be resolved early since it may require a data-model change.
4. **Predictive Management** — depends on Order cost data (if that's the chosen source for EOQ inputs) and sufficient stock movement history.
5. **Predictive Dashboard** — depends on Predictive Management and the "chief doctor" role decision.
6. **LLM Chatbot** — depends on Predictive Management and Alerts endpoints being available to query.
7. **LLM Explain button** — can proceed independently once scope of screens is confirmed.
8. **Home section shortcuts** — depends on the finalized permission matrix from all of the above.
9. **Responsiveness pass** — can proceed independently, ideally last, so it covers the newly added screens too.

---

## Before planning: checklist for Claude Code's Explore phase

- Confirm current role enum and how "chief doctor" should map onto it.
- Confirm whether `stock_movements` (or equivalent) has any batch/lot concept, or whether expiry tracking requires a model addition.
- Confirm whether any email-sending infrastructure already exists in the project.
- Confirm whether order/provider data currently has any cost/pricing fields.
- Confirm current volume of historical stock movement data available for regression (affects fallback design).
- Confirm how the existing token quota system is structured, to determine how chatbot and explain-button usage should be metered.
- Confirm plan-gating mechanism for existing LLM features, to determine if new LLM features should follow the same gate.
