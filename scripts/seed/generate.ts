// ---------------------------------------------------------------------------
// Deterministic demo-history generator.
//
// Turns the profiles in ./catalog.ts into N days of movements, purchases and
// lots. Nothing here talks to the database — it returns a plain plan that
// scripts/seed-demo.ts writes. That split is what makes the narrative
// assertions cheap: the plan can be checked before a single row is inserted.
//
// Three rules it exists to honour:
//   1. FEFO. Exits are allocated earliest-expiry-first, one movement row per
//      lot touched, exactly like register_stock_exit (20260629000002).
//   2. The RPC invariant. stock.quantity == sum(batches) == signed sum of
//      movements, per product. Both derived tables are computed FROM the
//      movement list rather than tracked alongside it, so they cannot drift.
//   3. Never dispense stock that isn't there. The supply plan is solved so the
//      balance is provably non-negative every day (see reconcileSupply).
// ---------------------------------------------------------------------------

import {
  HAND_PLACED_CONSUMPTION,
  HAND_PLACED_OPENING,
  ENTRY_NOTES,
  EXIT_NOTES,
  PRODUCTS,
  PROVIDERS,
  RECEPTORS,
  type ProductSeed,
} from "./catalog";

const MS_PER_DAY = 86_400_000;

// Coverage the ordering policy aims for, mirroring predictive_settings
// (coverage_days = 30) so the seeded history looks like it was run by somebody
// following the app's own advice.
const POLICY_COVERAGE_DAYS = 30;

export type Role = "chief_doctor" | "doctor" | "nurse" | "administrative";

export type PlannedMovement = {
  id: string;
  product_id: string;
  user_id: string;
  type: "entry" | "exit" | "adjustment" | "expiry";
  quantity: number;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  corrects_movement_id: string | null;
  receptor_id: string | null;
  purchase_id: string | null;
};

export type PlannedPurchase = {
  id: string;
  provider_id: string | null;
  status: "draft" | "confirmed" | "received" | "cancelled";
  supplier: string | null;
  notes: string | null;
  created_at: string;
  received_at: string | null;
  created_by: string;
  items: {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    accepted_quantity: number | null;
    expiry_date: string | null;
  }[];
};

export type PlanDiagnostic = {
  key: string;
  name: string;
  narrative: string;
  consumptionDays: number;
  spanDays: number;
  expectedMethod: "regression" | "average" | "insufficient_data";
  endStock: number;
  usableStock: number;
  expiredStock: number;
  minQuantity: number;
  avgDemandNow: number;
  deliveries: number;
};

export type SeedPlan = {
  providerRows: { id: string; key: string; created_at: string }[];
  productRows: { id: string; key: string; created_at: string }[];
  receptorRows: { id: string; created_at: string }[];
  purchases: PlannedPurchase[];
  movements: PlannedMovement[];
  stock: { product_id: string; quantity: number; min_quantity: number }[];
  batches: { product_id: string; expiry_date: string | null; quantity: number }[];
  providerProducts: { provider_id: string; product_id: string }[];
  diagnostics: PlanDiagnostic[];
};

// --- determinism ------------------------------------------------------------

// mulberry32: small, fast and stable across Node versions — the same --seed
// always produces the same history, so iterating on the catalog changes only
// what you meant to change.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
};

function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: <T,>(items: readonly T[]) => items[int(0, items.length - 1)],
    chance: (p: number) => next() < p,
  };
}

// --- dates ------------------------------------------------------------------

// Day 0 is the oldest day of the window; day `days - 1` is today.
function makeCalendar(days: number) {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayStart = (i: number) => todayUtc - (days - 1 - i) * MS_PER_DAY;
  return {
    days,
    todayIndex: days - 1,
    /** Index of the day that many days before today (clamped into the window). */
    index: (daysAgo: number) => Math.max(0, Math.min(days - 1, days - 1 - daysAgo)),
    date: (i: number) => new Date(dayStart(i)).toISOString().slice(0, 10),
    /** Calendar date `offset` days after day `i` (offset may be negative). */
    dateOffset: (i: number, offset: number) =>
      new Date(dayStart(i) + offset * MS_PER_DAY).toISOString().slice(0, 10),
    weekday: (i: number) => new Date(dayStart(i)).getUTCDay(),
    /**
     * A working-hours timestamp inside day `i` (11:00–19:00 UTC = 08:00–16:00
     * in Argentina). Both readings land on the same calendar day, so
     * buildConsumptionSeries' created_at.slice(0, 10) cannot drift a day.
     *
     * Clamped to just before now: "today" is the UTC date, which rolls over
     * while it is still yesterday evening in Argentina — without the clamp the
     * last day's movements would be stamped hours into the future.
     */
    stamp: (i: number, rng: Rng) => {
      const wanted = dayStart(i) + 11 * 3600_000 + Math.floor(rng.next() * 8 * 3600_000);
      return new Date(Math.min(wanted, Date.now() - 60_000)).toISOString();
    },
  };
}

type Calendar = ReturnType<typeof makeCalendar>;

// --- demand -----------------------------------------------------------------

// Effective units/day around `dayIndex`, averaged over a week (Sundays closed,
// Saturdays a reduced guard). This is what the predictive model will estimate,
// so it is also the unit the catalog's coverDaysTarget is denominated in.
function avgDemandAt(p: ProductSeed, dayIndex: number): number {
  const level = Math.max(0, p.baseDemand + p.trendPerDay * dayIndex);
  return (level * (5 + p.weekendFactor)) / 7;
}

function buildDemandSeries(p: ProductSeed, cal: Calendar, rng: Rng): number[] {
  const series = new Array<number>(cal.days).fill(0);

  const handPlaced = HAND_PLACED_CONSUMPTION[p.key];
  if (handPlaced) {
    for (const event of handPlaced) series[cal.index(event.daysAgo)] += event.quantity;
    return series;
  }

  // The short-span product needs an exact number of consumption days (6 of its
  // last 10) — enough points for regression, too short a span for it to fire.
  if (p.narrative === "new_short_span") {
    for (const daysAgo of [9, 8, 6, 4, 2, 1]) {
      series[cal.index(daysAgo)] = Math.max(1, Math.round(p.baseDemand + (rng.next() - 0.5) * 2));
    }
    return series;
  }

  const firstDay = cal.index(p.introducedDaysAgo);
  for (let i = firstDay; i < cal.days; i++) {
    const weekday = cal.weekday(i);
    if (weekday === 0) continue; // cerrado los domingos
    const level = Math.max(0, p.baseDemand + p.trendPerDay * i);
    let value = weekday === 6 ? level * p.weekendFactor : level;
    value *= 0.65 + rng.next() * 0.7; // noise around the trend
    if (rng.chance(p.spikeChance)) value *= p.spikeMultiplier;
    // Rounding quiet days down to 0 keeps consumption days (the model's
    // `points`) below the calendar days, the way real logs look.
    series[i] = Math.max(0, Math.round(value - 0.15));
  }

  // The lapsed lot has to survive to today, so nothing may be dispensed in the
  // final days — otherwise FEFO would hand out the expired units, which is
  // exactly what register_stock_exit would really do.
  if (p.narrative === "expired_lot") {
    for (let i = cal.index(2); i < cal.days; i++) series[i] = 0;
  }

  return series;
}

// --- supply planning --------------------------------------------------------

type PlannedDelivery = {
  productKey: string;
  /** Day the goods land (and the entry movement is stamped). */
  arrivalIndex: number;
  /** Day the order was placed — created_at of the purchase. */
  orderIndex: number;
  providerKey: string;
  quantity: number;
  expiry: string | null;
  /** Ordered more than what arrived (partial-acceptance demo). */
  shortfall: number;
  /**
   * Narrative lots are sized to leave an exact remnant at an exact expiry, so
   * the reconciliation below must not resize them and grouping must not move
   * them.
   */
  fixed: boolean;
};

type WriteOff = { productKey: string; dayIndex: number; quantity: number; expiry: string };

type ProductPlan = {
  product: ProductSeed;
  demand: number[];
  firstDay: number;
  openingQty: number;
  openingExpiry: string;
  deliveries: PlannedDelivery[];
  writeOffs: WriteOff[];
  adjustment: { dayIndex: number; quantity: number } | null;
  targetEnd: number;
};

function sum(values: number[], from = 0, to = values.length - 1): number {
  let total = 0;
  for (let i = Math.max(0, from); i <= Math.min(values.length - 1, to); i++) total += values[i] ?? 0;
  return total;
}

// Where each product must land today. The supply plan is solved backwards from
// this, which is why the demo states are guaranteed rather than hoped for.
function targetEndStock(p: ProductSeed, cal: Calendar): number {
  switch (p.narrative) {
    case "below_min":
      // Comfortably under the floor so low_stock fires without hitting zero.
      return Math.max(1, Math.floor(p.minQuantity * 0.65));
    default:
      return Math.max(1, Math.round(avgDemandAt(p, cal.todayIndex) * p.coverDaysTarget));
  }
}

/**
 * Makes the plan land on `targetEnd` exactly, without ever going negative.
 *
 * The trick is to only ever adjust the LAST delivery. With no delivery after
 * it, the balance on any later day is `targetEnd + (outflow still to come)`,
 * which is >= targetEnd >= 0 — so the tail is safe by construction, and the
 * days before it are untouched by the free-running policy that already fed
 * them. If the last delivery would have to go non-positive, it is dropped
 * entirely and the next one back becomes the adjustable one.
 */
function reconcileSupply(plan: ProductPlan, key: string): void {
  const totalOut = sum(plan.demand) + plan.writeOffs.reduce((a, w) => a + w.quantity, 0);
  const adjustmentIn = plan.adjustment?.quantity ?? 0;

  for (;;) {
    const candidate = plan.deliveries[plan.deliveries.length - 1];

    if (!candidate) {
      // Nothing to tune but the opening stock. Balance is then
      // targetEnd + remaining outflow on every day — safe.
      const opening = plan.targetEnd + totalOut - adjustmentIn;
      if (opening < 1) {
        throw new Error(
          `[${key}] opening stock would be ${opening}. Lower coverDaysTarget or raise baseDemand.`
        );
      }
      plan.openingQty = opening;
      return;
    }

    const others =
      plan.openingQty +
      adjustmentIn +
      plan.deliveries.slice(0, -1).reduce((a, d) => a + d.quantity, 0);
    const needed = plan.targetEnd + totalOut - others;

    // A narrative lot is sized to leave an exact remnant at an exact date:
    // it can be neither resized nor dropped. planProduct guarantees a
    // non-fixed delivery is last, so reaching one here means the surplus is
    // larger than the whole tail of the plan.
    if (candidate.fixed) {
      throw new Error(
        `[${key}] only a narrative lot is left to reconcile against (needs ${needed}). ` +
          `Raise coverDaysTarget in catalog.ts.`
      );
    }

    if (needed >= 1) {
      candidate.quantity = needed;
      return;
    }

    // Oversupplied even with this delivery at its minimum: drop it entirely.
    plan.deliveries.pop();
  }
}

function planProduct(p: ProductSeed, cal: Calendar, rng: Rng): ProductPlan {
  const demand = buildDemandSeries(p, cal, rng);
  const firstDay = cal.index(p.introducedDaysAgo);

  // Hand-placed products (sporadic / brand-new) get one opening delivery and
  // nothing else — a supply policy over four events would be fiction.
  if (HAND_PLACED_CONSUMPTION[p.key]) {
    const opening = HAND_PLACED_OPENING[p.key] ?? Math.round(sum(demand) * 3);
    return {
      product: p,
      demand,
      firstDay,
      openingQty: opening,
      openingExpiry: cal.dateOffset(firstDay, p.shelfLifeDays),
      deliveries: [],
      writeOffs: [],
      adjustment: null,
      targetEnd: opening - sum(demand),
    };
  }

  const provider = PROVIDERS.find((x) => x.key === p.providers[0])!;
  const leadTime = provider.leadTimeDays;

  const plan: ProductPlan = {
    product: p,
    demand,
    firstDay,
    openingQty: Math.max(1, Math.round(avgDemandAt(p, firstDay) * 30)),
    openingExpiry: cal.dateOffset(firstDay, p.shelfLifeDays),
    deliveries: [],
    writeOffs: [],
    adjustment:
      p.key === "paracetamol" ? { dayIndex: cal.index(12), quantity: 6 } : null,
    targetEnd: targetEndStock(p, cal),
  };

  // --- narrative lots, planned before the policy so reconciliation absorbs them

  if (p.narrative === "expired_lot") {
    // A lot delivered short-dated and oversized: FEFO drains it first, and what
    // it could not absorb before lapsing (2 days ago) is still on the shelf
    // today — usable_stock < current_stock, the distinction the UI leads with.
    // Nothing writes it off, which is precisely the point.
    const arrival = cal.index(40);
    const expiryIndex = cal.index(2);
    const remnant = 30;
    plan.deliveries.push({
      productKey: p.key,
      arrivalIndex: arrival,
      orderIndex: Math.max(0, arrival - leadTime),
      providerKey: provider.key,
      quantity: sum(demand, arrival, expiryIndex) + remnant,
      expiry: cal.date(expiryIndex),
      shortfall: 0,
      fixed: true,
    });
    plan.targetEnd += remnant; // stock.quantity still counts the lapsed units
  }

  if (p.narrative === "spiky") {
    // Near-expiry delivery that lapsed and WAS written off — the compliant
    // counterpart to the lot above, and the only `expiry`-type movement in the
    // log (ignored by the demand model, visible in the movements report).
    const arrival = cal.index(26);
    const expiryIndex = cal.index(21);
    const remnant = 18;
    plan.deliveries.push({
      productKey: p.key,
      arrivalIndex: arrival,
      orderIndex: Math.max(0, arrival - leadTime),
      providerKey: provider.key,
      quantity: sum(demand, arrival, expiryIndex) + remnant,
      expiry: cal.date(expiryIndex),
      shortfall: 0,
      fixed: true,
    });
    plan.writeOffs.push({
      productKey: p.key,
      dayIndex: cal.index(20),
      quantity: remnant,
      expiry: cal.date(expiryIndex),
    });
  }

  // --- ordering policy ------------------------------------------------------
  // Order when the projected balance — counting what is already in transit —
  // would fall inside the lead time, in roughly (lead + coverage) days' worth:
  // what the app itself suggests. reconcileSupply then trims the tail to land
  // the narrative, and its no-stockout proof rests on this run never going
  // negative, so the balance is asserted here rather than assumed.

  let balance = plan.openingQty;

  for (let i = firstDay; i < cal.days; i++) {
    for (const d of plan.deliveries) {
      if (d.arrivalIndex === i) balance += d.quantity;
    }
    if (plan.adjustment?.dayIndex === i) balance += plan.adjustment.quantity;
    for (const w of plan.writeOffs) {
      if (w.dayIndex === i) balance -= w.quantity;
    }

    const demandAround = Math.max(0.2, avgDemandAt(p, i));
    const orderSize = Math.max(1, Math.round(demandAround * (leadTime + POLICY_COVERAGE_DAYS)));
    const inTransit = plan.deliveries
      .filter((d) => d.arrivalIndex > i)
      .reduce((a, d) => a + d.quantity, 0);

    const newOrder = (arrival: number, quantity: number, orderIndex: number) => {
      plan.deliveries.push({
        productKey: p.key,
        arrivalIndex: arrival,
        orderIndex,
        providerKey: rng.chance(0.75) ? provider.key : rng.pick(p.providers),
        quantity,
        expiry: cal.dateOffset(arrival, p.shelfLifeDays),
        shortfall: 0,
        fixed: false,
      });
    };

    if (balance + inTransit - demand[i] < demandAround * (leadTime + 4) && i + leadTime < cal.days) {
      const arrival = Math.min(cal.days - 1, i + Math.max(1, leadTime + rng.int(-1, 1)));
      newOrder(arrival, orderSize, i);
    }

    // A burst outran the lead time: the clinic buys locally the same day rather
    // than turning a patient away. Rare, and it keeps the balance honest — the
    // reconciliation below depends on this series never going negative.
    if (balance - demand[i] < 0) {
      const emergency = Math.max(orderSize, demand[i] - balance);
      newOrder(i, emergency, Math.max(firstDay, i - 1));
      balance += emergency;
    }

    balance -= demand[i];
    if (balance < 0) throw new Error(`[${p.key}] policy simulation went negative on day ${i}`);
  }

  plan.deliveries.sort((a, b) => a.arrivalIndex - b.arrivalIndex);

  // reconcileSupply tunes the LAST delivery, and a narrative lot must not be
  // tuned — its quantity is what leaves the exact remnant its story depends on.
  // If one ended up last, give the reconciliation a fresh top-up delivery to
  // work with instead (a recent resupply, which is what it looks like anyway).
  const last = plan.deliveries[plan.deliveries.length - 1];
  if (last?.fixed) {
    const arrival = Math.max(last.arrivalIndex + 1, cal.days - 3);
    plan.deliveries.push({
      productKey: p.key,
      arrivalIndex: Math.min(cal.days - 1, arrival),
      orderIndex: Math.max(0, arrival - leadTime),
      providerKey: provider.key,
      quantity: 1,
      expiry: cal.dateOffset(arrival, p.shelfLifeDays),
      shortfall: 0,
      fixed: false,
    });
  }

  reconcileSupply(plan, p.key);

  // The short-dated lot the model must warn about: the newest delivery is
  // re-dated so part of it cannot be consumed before it lapses
  // (projectedWaste > 0) and it falls inside the 30-day expiry alert window.
  if (p.narrative === "expiring_lot" && plan.deliveries.length) {
    plan.deliveries[plan.deliveries.length - 1].expiry = cal.dateOffset(cal.todayIndex, 18);
  }

  // One received order arrives short of what was ordered, to show reconciliation.
  if (p.key === "gasas") {
    const line = plan.deliveries.find((d) => !d.fixed);
    if (line) line.shortfall = 15;
  }

  return plan;
}

// --- FEFO simulation --------------------------------------------------------

type Lot = { expiry: string | null; quantity: number };

// Earliest expiry first, nulls last — the order register_stock_exit consumes
// in and the order the predictive model projects in.
function fefoSort(lots: Lot[]): Lot[] {
  return [...lots].sort((a, b) => {
    if (a.expiry === b.expiry) return 0;
    if (a.expiry === null) return 1;
    if (b.expiry === null) return -1;
    return a.expiry.localeCompare(b.expiry);
  });
}

type OrderGroup = {
  id: string;
  providerKey: string;
  arrivalIndex: number;
  orderIndex: number;
  deliveries: PlannedDelivery[];
};

// Deliveries from the same provider landing within a few days are one order,
// so Purchases reads like a clinic ordering rather than a script looping.
// Arrivals are only ever pulled EARLIER (never later) — moving one later could
// starve the product it belongs to, and the plan's no-stockout guarantee with
// it. Narrative lots keep their exact date.
function groupIntoOrders(plans: ProductPlan[]): OrderGroup[] {
  const groups: OrderGroup[] = [];
  const deliveries = plans
    .flatMap((p) => p.deliveries)
    .sort((a, b) => a.arrivalIndex - b.arrivalIndex);

  for (const d of deliveries) {
    const group = d.fixed
      ? undefined
      : groups.find(
          (g) =>
            g.providerKey === d.providerKey &&
            !g.deliveries[0].fixed &&
            d.arrivalIndex - g.arrivalIndex >= 0 &&
            d.arrivalIndex - g.arrivalIndex <= 3 &&
            !g.deliveries.some((x) => x.productKey === d.productKey)
        );

    if (group) {
      d.arrivalIndex = group.arrivalIndex;
      group.orderIndex = Math.min(group.orderIndex, d.orderIndex);
      group.deliveries.push(d);
    } else {
      groups.push({
        id: crypto.randomUUID(),
        providerKey: d.providerKey,
        arrivalIndex: d.arrivalIndex,
        orderIndex: d.orderIndex,
        deliveries: [d],
      });
    }
  }
  return groups;
}

export type GenerateInput = {
  days: number;
  seed: number;
  usersByRole: Record<Role, string>;
};

export function generatePlan({ days, seed, usersByRole }: GenerateInput): SeedPlan {
  const rng = makeRng(seed);
  const cal = makeCalendar(days);

  const providerIds = new Map(PROVIDERS.map((p) => [p.key, crypto.randomUUID()]));
  const productIds = new Map(PRODUCTS.map((p) => [p.key, crypto.randomUUID()]));
  const receptorIds = RECEPTORS.map(() => crypto.randomUUID());

  const exitUsers: Role[] = [
    "nurse",
    "nurse",
    "nurse",
    "nurse",
    "doctor",
    "doctor",
    "chief_doctor",
    "administrative",
  ];
  const entryUsers: Role[] = ["nurse", "administrative", "administrative", "chief_doctor"];
  const wardReceptors = [6, 7];
  const patientReceptors = [0, 1, 2, 3, 4, 5];

  const plans = PRODUCTS.map((p) => planProduct(p, cal, rng));
  const groups = groupIntoOrders(plans);
  const purchaseByDelivery = new Map<PlannedDelivery, string>();
  for (const g of groups) for (const d of g.deliveries) purchaseByDelivery.set(d, g.id);

  const movements: PlannedMovement[] = [];

  for (const plan of plans) {
    const productId = productIds.get(plan.product.key)!;
    const lots: Lot[] = [];
    const addLot = (expiry: string | null, quantity: number) => {
      const existing = lots.find((l) => l.expiry === expiry);
      if (existing) existing.quantity += quantity;
      else lots.push({ expiry, quantity });
    };

    // Opening stock: an entry with no purchase behind it — stock that already
    // existed when the window starts, which is what a real go-live looks like.
    addLot(plan.openingExpiry, plan.openingQty);
    movements.push({
      id: crypto.randomUUID(),
      product_id: productId,
      user_id: usersByRole[rng.pick(entryUsers)],
      type: "entry",
      quantity: plan.openingQty,
      expiry_date: plan.openingExpiry,
      notes: "Carga inicial de existencias.",
      created_at: cal.stamp(plan.firstDay, rng),
      corrects_movement_id: null,
      receptor_id: null,
      purchase_id: null,
    });

    for (let i = plan.firstDay; i < cal.days; i++) {
      // 1. arrivals
      for (const d of plan.deliveries) {
        if (d.arrivalIndex !== i) continue;
        addLot(d.expiry, d.quantity);
        movements.push({
          id: crypto.randomUUID(),
          product_id: productId,
          user_id: usersByRole[rng.pick(entryUsers)],
          type: "entry",
          quantity: d.quantity,
          expiry_date: d.expiry,
          notes: rng.chance(0.25) ? rng.pick(ENTRY_NOTES) : null,
          created_at: cal.stamp(i, rng),
          corrects_movement_id: null,
          receptor_id: null,
          purchase_id: purchaseByDelivery.get(d) ?? null,
        });
      }

      // 2. inventory adjustment (positive only, like register_stock_movement)
      if (plan.adjustment?.dayIndex === i) {
        addLot(null, plan.adjustment.quantity);
        movements.push({
          id: crypto.randomUUID(),
          product_id: productId,
          user_id: usersByRole.administrative,
          type: "adjustment",
          quantity: plan.adjustment.quantity,
          expiry_date: null,
          notes: "Ajuste por recuento físico de depósito.",
          created_at: cal.stamp(i, rng),
          corrects_movement_id: null,
          receptor_id: null,
          purchase_id: null,
        });
      }

      // 3. expiry write-offs
      for (const w of plan.writeOffs) {
        if (w.dayIndex !== i) continue;
        const lot = lots.find((l) => l.expiry === w.expiry);
        if (!lot || lot.quantity < w.quantity) {
          throw new Error(`[${plan.product.key}] write-off exceeds its lot on day ${i}`);
        }
        lot.quantity -= w.quantity;
        movements.push({
          id: crypto.randomUUID(),
          product_id: productId,
          user_id: usersByRole.nurse,
          type: "expiry",
          quantity: w.quantity,
          expiry_date: w.expiry,
          notes: "Lote vencido — descarte según protocolo.",
          created_at: cal.stamp(i, rng),
          corrects_movement_id: null,
          receptor_id: null,
          purchase_id: null,
        });
      }

      // 4. the day's dispensing, split into 1–2 handovers, allocated FEFO
      const dayDemand = plan.demand[i] ?? 0;
      if (dayDemand <= 0) continue;

      const portions: number[] = [];
      if (dayDemand >= 6 && rng.chance(0.6)) {
        const first = Math.max(1, Math.round(dayDemand * (0.35 + rng.next() * 0.3)));
        portions.push(first, dayDemand - first);
      } else {
        portions.push(dayDemand);
      }

      for (const portion of portions) {
        if (portion <= 0) continue;
        let left = portion;
        const receptorId = pickReceptor(
          plan.product,
          rng,
          receptorIds,
          wardReceptors,
          patientReceptors
        );
        const note = rng.chance(0.18) ? rng.pick(EXIT_NOTES) : null;
        const userId = usersByRole[rng.pick(exitUsers)];

        for (const lot of fefoSort(lots)) {
          if (left <= 0) break;
          if (lot.quantity <= 0) continue;
          const take = Math.min(lot.quantity, left);
          lot.quantity -= take;
          left -= take;
          movements.push({
            id: crypto.randomUUID(),
            product_id: productId,
            user_id: userId,
            type: "exit",
            quantity: take,
            expiry_date: lot.expiry,
            notes: note,
            created_at: cal.stamp(i, rng),
            corrects_movement_id: null,
            receptor_id: receptorId,
            purchase_id: null,
          });
        }

        if (left > 0) {
          throw new Error(
            `[${plan.product.key}] ran out of stock on day ${i} (${left} units short). ` +
              `Raise coverDaysTarget or lower baseDemand in catalog.ts.`
          );
        }
      }
    }
  }

  // One rectified exit: a compensating entry tagged with corrects_movement_id,
  // which the demand series nets back into the original day
  // (lib/predictive/data.ts) and the movements report shows as rectified.
  addRectification(movements, productIds.get("ibuprofeno")!, usersByRole, cal);

  // --- derived tables, computed FROM the movements ---------------------------
  const batchMap = new Map<string, number>();
  const stockMap = new Map<string, number>();
  for (const m of movements) {
    const delta = m.type === "entry" || m.type === "adjustment" ? m.quantity : -m.quantity;
    const key = `${m.product_id}|${m.expiry_date ?? ""}`;
    batchMap.set(key, (batchMap.get(key) ?? 0) + delta);
    stockMap.set(m.product_id, (stockMap.get(m.product_id) ?? 0) + delta);
  }

  const batches = [...batchMap]
    .filter(([, quantity]) => quantity !== 0)
    .map(([key, quantity]) => {
      const [product_id, expiry] = key.split("|");
      return { product_id, expiry_date: expiry === "" ? null : expiry, quantity };
    });
  for (const b of batches) {
    if (b.quantity < 0) throw new Error(`negative batch for product ${b.product_id}`);
  }

  const stock = PRODUCTS.map((p) => ({
    product_id: productIds.get(p.key)!,
    quantity: stockMap.get(productIds.get(p.key)!) ?? 0,
    min_quantity: p.minQuantity,
  }));

  const purchases = buildPurchases(groups, cal, rng, providerIds, productIds, usersByRole);

  const today = cal.date(cal.todayIndex);
  const diagnostics = plans.map((plan): PlanDiagnostic => {
    const productId = productIds.get(plan.product.key)!;
    const productBatches = batches.filter((b) => b.product_id === productId);
    const expired = productBatches
      .filter((b) => b.expiry_date !== null && b.expiry_date < today)
      .reduce((a, b) => a + b.quantity, 0);
    const endStock = productBatches.reduce((a, b) => a + b.quantity, 0);
    const consumptionDays = plan.demand.filter((q) => q > 0).length;
    const firstConsumption = plan.demand.findIndex((q) => q > 0);
    const spanDays = firstConsumption < 0 ? 0 : cal.days - firstConsumption;

    return {
      key: plan.product.key,
      name: plan.product.name,
      narrative: plan.product.narrative,
      consumptionDays,
      spanDays,
      expectedMethod:
        consumptionDays < 3
          ? "insufficient_data"
          : consumptionDays >= 5 && spanDays >= 14
            ? "regression"
            : "average",
      endStock,
      usableStock: endStock - expired,
      expiredStock: expired,
      minQuantity: plan.product.minQuantity,
      avgDemandNow: avgDemandAt(plan.product, cal.todayIndex),
      deliveries: plan.deliveries.length,
    };
  });

  const providerProducts = PRODUCTS.flatMap((p) =>
    p.providers.map((key) => ({
      provider_id: providerIds.get(key)!,
      product_id: productIds.get(p.key)!,
    }))
  );

  return {
    providerRows: PROVIDERS.map((p) => ({
      id: providerIds.get(p.key)!,
      key: p.key,
      created_at: cal.stamp(0, rng),
    })),
    productRows: PRODUCTS.map((p) => ({
      id: productIds.get(p.key)!,
      key: p.key,
      created_at: cal.stamp(cal.index(p.introducedDaysAgo), rng),
    })),
    receptorRows: receptorIds.map((id, i) => ({
      id,
      created_at: cal.stamp(cal.index(cal.days - 1 - Math.min(cal.days - 1, i * 6)), rng),
    })),
    purchases,
    movements: movements.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    stock,
    batches,
    providerProducts,
    diagnostics,
  };
}

function pickReceptor(
  product: ProductSeed,
  rng: Rng,
  receptorIds: string[],
  ward: number[],
  patients: number[]
): string | null {
  // ~25% of exits are internal consumption with no receptor recorded.
  if (rng.chance(0.25)) return null;
  const wardLeaning = ["gasas", "guantes", "fisiologica", "dipirona", "adrenalina"].includes(
    product.key
  );
  const pool = wardLeaning && rng.chance(0.6) ? ward : patients;
  return receptorIds[rng.pick(pool)];
}

function addRectification(
  movements: PlannedMovement[],
  productId: string,
  usersByRole: Record<Role, string>,
  cal: Calendar
): void {
  const cutoff = cal.date(cal.index(24));
  const target = movements.find(
    (m) =>
      m.product_id === productId &&
      m.type === "exit" &&
      m.quantity >= 4 &&
      m.created_at.slice(0, 10) >= cutoff
  );
  if (!target) return;

  movements.push({
    id: crypto.randomUUID(),
    product_id: productId,
    user_id: usersByRole.chief_doctor,
    // Undoing part of an exit puts units back: an 'entry' pointing at the
    // movement it corrects, exactly what rectify_stock_movement emits.
    type: "entry",
    quantity: 3,
    expiry_date: target.expiry_date,
    notes: "Corrección: se había cargado de más en la salida original.",
    created_at: new Date(Date.parse(target.created_at) + 3 * 3600_000).toISOString(),
    corrects_movement_id: target.id,
    receptor_id: null,
    purchase_id: null,
  });
}

function buildPurchases(
  groups: OrderGroup[],
  cal: Calendar,
  rng: Rng,
  providerIds: Map<string, string>,
  productIds: Map<string, string>,
  usersByRole: Record<Role, string>
): PlannedPurchase[] {
  const priceOf = (key: string) => PRODUCTS.find((p) => p.key === key)!.unitPrice;
  const purchases: PlannedPurchase[] = [];

  for (const g of groups) {
    const provider = PROVIDERS.find((p) => p.key === g.providerKey)!;
    // created_at → received_at is what fetchAutoLeadTimes averages per product,
    // so this gap IS the "lead time automático" the predictive page shows.
    const orderIndex = Math.max(0, Math.min(g.orderIndex, g.arrivalIndex - 1));
    purchases.push({
      id: g.id,
      provider_id: providerIds.get(g.providerKey)!,
      status: "received",
      supplier: provider.name,
      notes: rng.chance(0.2) ? "Pedido telefónico, confirmado por mail." : null,
      created_at: cal.stamp(orderIndex, rng),
      received_at: cal.stamp(g.arrivalIndex, rng),
      created_by: usersByRole[rng.chance(0.5) ? "administrative" : "nurse"],
      items: g.deliveries.map((d) => ({
        id: crypto.randomUUID(),
        product_id: productIds.get(d.productKey)!,
        // Ordered = what arrived + the shortfall, so the partially accepted
        // line shows a real discrepancy against accepted_quantity.
        quantity: d.quantity + d.shortfall,
        unit_price: Math.round(priceOf(d.productKey) * (0.95 + rng.next() * 0.15)),
        accepted_quantity: d.quantity,
        expiry_date: d.expiry,
      })),
    });
  }

  // Open + cancelled orders: the dashboard's "pedidos pendientes" tile counts
  // draft + confirmed, and none of these touch stock.
  const standalone = (
    status: "draft" | "confirmed" | "cancelled",
    providerKey: string,
    daysAgo: number,
    items: { key: string; quantity: number }[],
    notes: string | null
  ): PlannedPurchase => ({
    id: crypto.randomUUID(),
    provider_id: providerIds.get(providerKey)!,
    status,
    supplier: PROVIDERS.find((p) => p.key === providerKey)!.name,
    notes,
    created_at: cal.stamp(cal.index(daysAgo), rng),
    received_at: null,
    created_by: usersByRole.administrative,
    items: items.map((it) => ({
      id: crypto.randomUUID(),
      product_id: productIds.get(it.key)!,
      quantity: it.quantity,
      unit_price: priceOf(it.key),
      accepted_quantity: null,
      expiry_date: null,
    })),
  });

  purchases.push(
    standalone(
      "confirmed",
      "centro",
      4,
      [
        { key: "paracetamol", quantity: 180 },
        { key: "ibuprofeno", quantity: 120 },
      ],
      "Confirmado por el proveedor, entrega estimada esta semana."
    ),
    standalone("confirmed", "insumos", 2, [{ key: "gasas", quantity: 250 }], null),
    standalone("draft", "sierras", 1, [{ key: "guantes", quantity: 40 }], "Falta confirmar precio."),
    standalone(
      "cancelled",
      "centro",
      33,
      [{ key: "loratadina", quantity: 150 }],
      "Anulado: ya teníamos stock suficiente de la temporada."
    )
  );

  return purchases.sort((a, b) => a.created_at.localeCompare(b.created_at));
}
