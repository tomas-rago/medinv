// ---------------------------------------------------------------------------
// THE EDITABLE PART OF THE DEMO SEED.
//
// Everything the demo shows is derived from this file: tweak a number here,
// re-run `npm run seed:demo`, read the prediction table it prints. The
// generator (./generate.ts) never invents products — it only turns these
// profiles into 90 days of movements, purchases and lots.
//
// Category / criticality / unit / patient_type values MUST come from the
// app's fixed vocabularies, or the UI renders raw keys:
//   lib/constants/categories.ts, criticality.ts, receptor-types.ts,
//   and the `Units` namespace in messages/es.json.
// ---------------------------------------------------------------------------

// Which demo story a product is responsible for. The generator pins the end
// state per narrative and the seed script asserts every one of them landed —
// a bland demo is a failed run, not a surprise on stage.
export type Narrative =
  | "steady" // the "nothing to do here" baseline row
  | "order_now" // lands exactly at its reorder point today
  | "rising" // strong upward trend (regression slope > 0)
  | "below_min" // under min_quantity -> low_stock alert
  | "expiring_lot" // short-dated lot -> expiry alert + projected waste
  | "expired_lot" // a lapsed lot still on hand -> usable < current
  | "declining" // negative slope, overstocked
  | "spiky" // bursty demand -> visible variance in the backtest chart
  | "sporadic" // AVERAGE method via the few-events path (< 5 consumption days)
  | "new_short_span" // AVERAGE method via the short-span path (span < 14 days)
  | "brand_new"; // INSUFFICIENT_DATA (< 3 consumption days)

export type ProviderSeed = {
  key: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  // Typical delivery time. Purchases are backdated with this (± jitter), which
  // is what predictive's "lead time automático" averages back out of history
  // (lib/predictive/lead-time.ts) — predictive_settings.lead_time_days is null.
  leadTimeDays: number;
};

export const PROVIDERS: ProviderSeed[] = [
  {
    key: "centro",
    name: "Droguería del Centro",
    contact_name: "Marcela Ibáñez",
    email: "ventas@drogueriadelcentro.com.ar",
    phone: "+54 351 422-8890",
    address: "Av. Colón 1245, Córdoba",
    notes: "Entrega rápida. Pedidos antes de las 11 h salen el mismo día.",
    leadTimeDays: 3,
  },
  {
    key: "farmadis",
    name: "Farmadis S.A.",
    contact_name: "Rubén Sosa",
    email: "pedidos@farmadis.com.ar",
    phone: "+54 351 468-1120",
    address: "Bv. San Juan 780, Córdoba",
    leadTimeDays: 5,
  },
  {
    key: "insumos",
    name: "Insumos Médicos Córdoba SRL",
    contact_name: "Paula Vergara",
    email: "administracion@insumoscba.com.ar",
    phone: "+54 351 155-402-118",
    address: "Ruta 5 km 12, Villa La Bolsa",
    notes: "Descuento del 8 % en pedidos de más de 20 unidades.",
    leadTimeDays: 8,
  },
  {
    key: "sierras",
    name: "Distribuidora Sierras",
    contact_name: "Hernán Ludueña",
    email: "hernan@distsierras.com.ar",
    phone: "+54 3547 42-3311",
    address: "Los Aromos 55, Alta Gracia",
    notes: "Reparte los martes. Confirmar stock por WhatsApp.",
    leadTimeDays: 12,
  },
];

export type ProductSeed = {
  key: string;
  name: string;
  ean: string;
  category: string;
  criticality: "vital" | "essential" | "desirable";
  unit: string;
  presentation: string;
  description?: string;
  narrative: Narrative;

  /** Static alert floor (stock.min_quantity) — drives low_stock + safety stock. */
  minQuantity: number;
  /** Units/day at the start of the window. */
  baseDemand: number;
  /** Units/day², applied linearly across the window. Negative = declining. */
  trendPerDay: number;
  /** Weekend demand as a fraction of a weekday (the clinic runs a Sat guard). */
  weekendFactor: number;
  /** Odds a given day is a burst, and how much it multiplies demand by. */
  spikeChance: number;
  spikeMultiplier: number;
  /** Days from delivery to lot expiry. */
  shelfLifeDays: number;
  /** Days before today that the product enters the catalog (max = window). */
  introducedDaysAgo: number;
  /**
   * Days of cover to land on TODAY. The generator solves the supply schedule
   * backwards from this, so it is the main dial for "how urgent does this row
   * look". Ignored for narratives that pin the end state another way
   * (below_min lands under minQuantity; order_now lands on the reorder point).
   */
  coverDaysTarget: number;
  /** Provider keys; the first is the usual supplier. Enforced in provider_products. */
  providers: string[];
  unitPrice: number;
};

// 13 products. The three low-history rows at the bottom exist so the demo can
// show all three predictive methods side by side — regression, promedio simple,
// and an honest "no alcanza el historial".
export const PRODUCTS: ProductSeed[] = [
  {
    key: "amoxicilina",
    name: "Amoxicilina 500 mg",
    ean: "7791234000015",
    category: "antibiotics",
    criticality: "vital",
    unit: "blister",
    presentation: "Caja x 16 comprimidos",
    description: "Antibiótico betalactámico de primera línea.",
    narrative: "order_now",
    minQuantity: 40,
    baseDemand: 6.5,
    trendPerDay: 0.02,
    weekendFactor: 0.35,
    spikeChance: 0.06,
    spikeMultiplier: 2.1,
    shelfLifeDays: 540,
    introducedDaysAgo: 90,
    coverDaysTarget: 11, // ~= lead (5) + safety (7) - 1 -> at the reorder point
    providers: ["farmadis", "centro"],
    unitPrice: 4200,
  },
  {
    key: "salbutamol",
    name: "Salbutamol aerosol 100 mcg",
    ean: "7791234000022",
    category: "respiratory",
    criticality: "vital",
    unit: "unit",
    presentation: "Aerosol 200 dosis",
    description: "Broncodilatador de rescate.",
    narrative: "rising",
    minQuantity: 15,
    baseDemand: 1.8,
    trendPerDay: 0.055, // winter climb: ~1.8 -> ~6.7/día
    weekendFactor: 0.5,
    spikeChance: 0.1,
    spikeMultiplier: 2.4,
    shelfLifeDays: 480,
    introducedDaysAgo: 90,
    coverDaysTarget: 12, // dentro de la ventana "reponer pronto" (<= 7 días)
    providers: ["centro", "farmadis"],
    unitPrice: 9800,
  },
  {
    key: "omeprazol",
    name: "Omeprazol 20 mg",
    ean: "7791234000039",
    category: "gastrointestinal",
    criticality: "essential",
    unit: "blister",
    presentation: "Caja x 30 cápsulas",
    narrative: "below_min",
    minQuantity: 30,
    baseDemand: 3.4,
    trendPerDay: 0.01,
    weekendFactor: 0.3,
    spikeChance: 0.04,
    spikeMultiplier: 1.8,
    shelfLifeDays: 600,
    introducedDaysAgo: 90,
    coverDaysTarget: 6, // overridden: lands under minQuantity
    providers: ["farmadis"],
    unitPrice: 3100,
  },
  {
    key: "dipirona",
    name: "Dipirona 1 g ampolla",
    ean: "7791234000046",
    category: "analgesics",
    criticality: "essential",
    unit: "ampoule",
    presentation: "Caja x 5 ampollas",
    description: "Analgésico/antipirético inyectable.",
    narrative: "expiring_lot",
    minQuantity: 25,
    baseDemand: 4.2,
    trendPerDay: 0,
    weekendFactor: 0.6,
    spikeChance: 0.05,
    spikeMultiplier: 1.9,
    shelfLifeDays: 300,
    introducedDaysAgo: 90,
    coverDaysTarget: 38, // the surplus is what the short-dated lot will waste
    providers: ["insumos", "farmadis"],
    unitPrice: 1850,
  },
  {
    key: "enalapril",
    name: "Enalapril 10 mg",
    ean: "7791234000053",
    category: "cardiac",
    criticality: "vital",
    unit: "blister",
    presentation: "Caja x 30 comprimidos",
    description: "Antihipertensivo IECA, tratamiento crónico.",
    narrative: "expired_lot",
    minQuantity: 35,
    baseDemand: 5.1,
    trendPerDay: -0.005,
    weekendFactor: 0.25,
    spikeChance: 0.03,
    spikeMultiplier: 1.6,
    shelfLifeDays: 720,
    introducedDaysAgo: 90,
    coverDaysTarget: 34,
    providers: ["farmadis", "insumos"],
    unitPrice: 2650,
  },
  {
    key: "loratadina",
    name: "Loratadina 10 mg",
    ean: "7791234000060",
    category: "antiallergics",
    criticality: "desirable",
    unit: "blister",
    presentation: "Caja x 20 comprimidos",
    narrative: "declining",
    minQuantity: 20,
    baseDemand: 4.6,
    trendPerDay: -0.038, // fin de la temporada de alergias
    weekendFactor: 0.4,
    spikeChance: 0.03,
    spikeMultiplier: 1.7,
    shelfLifeDays: 540,
    introducedDaysAgo: 90,
    coverDaysTarget: 95, // sobrestock heredado de la temporada
    providers: ["centro"],
    unitPrice: 2200,
  },
  {
    key: "ibuprofeno",
    name: "Ibuprofeno 400 mg",
    ean: "7791234000077",
    category: "analgesics",
    criticality: "essential",
    unit: "blister",
    presentation: "Caja x 20 comprimidos",
    narrative: "steady",
    minQuantity: 45,
    baseDemand: 7.2,
    trendPerDay: 0.008,
    weekendFactor: 0.45,
    spikeChance: 0.05,
    spikeMultiplier: 1.9,
    shelfLifeDays: 600,
    introducedDaysAgo: 90,
    coverDaysTarget: 42,
    providers: ["centro", "farmadis"],
    unitPrice: 2900,
  },
  {
    key: "paracetamol",
    name: "Paracetamol 500 mg",
    ean: "7791234000084",
    category: "analgesics",
    criticality: "desirable",
    unit: "blister",
    presentation: "Caja x 24 comprimidos",
    narrative: "steady",
    minQuantity: 50,
    baseDemand: 9.4,
    trendPerDay: 0.015,
    weekendFactor: 0.5,
    spikeChance: 0.07,
    spikeMultiplier: 2,
    shelfLifeDays: 660,
    introducedDaysAgo: 90,
    coverDaysTarget: 50,
    providers: ["centro", "insumos"],
    unitPrice: 1750,
  },
  {
    key: "gasas",
    name: "Gasas estériles 10x10",
    ean: "7791234000091",
    category: "wound_care",
    criticality: "essential",
    unit: "unit",
    presentation: "Sobre x 5 unidades",
    description: "Curaciones y guardia.",
    narrative: "spiky",
    minQuantity: 60,
    baseDemand: 8.5,
    trendPerDay: 0.01,
    weekendFactor: 0.8, // la guardia consume parejo
    spikeChance: 0.16,
    spikeMultiplier: 3.2,
    shelfLifeDays: 900,
    introducedDaysAgo: 90,
    coverDaysTarget: 33,
    providers: ["insumos", "sierras"],
    unitPrice: 950,
  },
  {
    key: "guantes",
    name: "Guantes de nitrilo talle M",
    ean: "7791234000107",
    category: "disposables",
    criticality: "essential",
    unit: "box",
    presentation: "Caja x 100 unidades",
    narrative: "steady",
    minQuantity: 12,
    baseDemand: 2.6,
    trendPerDay: 0.012,
    weekendFactor: 0.7,
    spikeChance: 0.05,
    spikeMultiplier: 1.8,
    shelfLifeDays: 1080,
    introducedDaysAgo: 90,
    coverDaysTarget: 40,
    providers: ["insumos", "sierras"],
    unitPrice: 14500,
  },
  {
    key: "fisiologica",
    name: "Solución fisiológica 500 ml",
    ean: "7791234000114",
    category: "disposables",
    criticality: "vital",
    unit: "unit",
    presentation: "Sachet 500 ml",
    narrative: "steady",
    minQuantity: 30,
    baseDemand: 5.8,
    trendPerDay: 0.006,
    weekendFactor: 0.65,
    spikeChance: 0.08,
    spikeMultiplier: 2.2,
    shelfLifeDays: 420,
    introducedDaysAgo: 90,
    coverDaysTarget: 28,
    providers: ["sierras", "insumos"],
    unitPrice: 1350,
  },

  // --- Low-history rows: the three predictive methods, side by side ----------
  {
    key: "adrenalina",
    name: "Adrenalina 1 mg ampolla",
    ean: "7791234000121",
    category: "cardiac",
    criticality: "vital",
    unit: "ampoule",
    presentation: "Ampolla 1 ml",
    description: "Uso de emergencia. Consumo esporádico, sin patrón semanal.",
    // AVERAGE via the few-events path: 4 consumption days in 90 (< 5 points),
    // so the model refuses to fit a trend and falls back to a flat average.
    narrative: "sporadic",
    minQuantity: 10,
    baseDemand: 0, // demand comes from sporadicDays below, not the daily model
    trendPerDay: 0,
    weekendFactor: 1,
    spikeChance: 0,
    spikeMultiplier: 1,
    shelfLifeDays: 360,
    introducedDaysAgo: 90,
    coverDaysTarget: 0, // pinned by the narrative (see SPORADIC_EVENTS)
    providers: ["farmadis"],
    unitPrice: 3400,
  },
  {
    key: "vendas",
    name: "Vendas elásticas 10 cm",
    ean: "7791234000138",
    category: "wound_care",
    criticality: "essential",
    unit: "unit",
    presentation: "Rollo 10 cm x 4 m",
    description: "Alta reciente en el catálogo.",
    // AVERAGE via the short-span path: consumed on 6 of the last 10 days, so
    // there are enough points but the span (11 days) is under the 14 the
    // regression needs. Upgrades to regression on its own as history grows.
    narrative: "new_short_span",
    minQuantity: 20,
    baseDemand: 3.1,
    trendPerDay: 0,
    weekendFactor: 0.4,
    spikeChance: 0,
    spikeMultiplier: 1,
    shelfLifeDays: 900,
    introducedDaysAgo: 10,
    coverDaysTarget: 22,
    providers: ["insumos"],
    unitPrice: 1200,
  },
  {
    key: "corticoide",
    name: "Crema con corticoide 15 g",
    ean: "7791234000145",
    category: "dermatological",
    criticality: "desirable",
    unit: "unit",
    presentation: "Pomo 15 g",
    description: "Alta reciente. Todavía sin historial suficiente.",
    // INSUFFICIENT_DATA: 2 consumption days, under the 3-day floor the model
    // requires before it will estimate anything at all.
    narrative: "brand_new",
    minQuantity: 8,
    baseDemand: 1.2,
    trendPerDay: 0,
    weekendFactor: 0.3,
    spikeChance: 0,
    spikeMultiplier: 1,
    shelfLifeDays: 480,
    introducedDaysAgo: 5,
    coverDaysTarget: 30,
    providers: ["centro"],
    unitPrice: 5600,
  },
];

// Sporadic/brand-new products get their consumption placed by hand — the daily
// demand model cannot reliably produce "exactly N consumption days", and the
// method each one lands on is the whole point of seeding it.
// Keys are days-ago; values are units dispensed that day.
export const HAND_PLACED_CONSUMPTION: Record<string, Array<{ daysAgo: number; quantity: number }>> = {
  // 4 events -> points < 5 -> average.
  adrenalina: [
    { daysAgo: 78, quantity: 2 },
    { daysAgo: 52, quantity: 1 },
    { daysAgo: 29, quantity: 3 },
    { daysAgo: 6, quantity: 2 },
  ],
  // 2 events -> points < 3 -> insufficient_data.
  corticoide: [
    { daysAgo: 4, quantity: 1 },
    { daysAgo: 1, quantity: 2 },
  ],
};

// Opening stock for the hand-placed products (they have no supply policy).
export const HAND_PLACED_OPENING: Record<string, number> = {
  adrenalina: 24,
  corticoide: 18,
};

export type ReceptorSeed = {
  name: string;
  external_id?: string;
  patient_type: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export const RECEPTORS: ReceptorSeed[] = [
  {
    name: "María Elena Gómez",
    external_id: "DNI 14.882.301",
    patient_type: "social_security",
    phone: "+54 3547 15-441-902",
    notes: "Tratamiento crónico de hipertensión. Retira mensualmente.",
  },
  {
    name: "Carlos Alberto Ferreyra",
    external_id: "DNI 27.104.556",
    patient_type: "independent",
    phone: "+54 3547 15-408-771",
  },
  {
    name: "Ana Lucía Robledo",
    external_id: "DNI 33.920.114",
    patient_type: "prepaid",
    email: "analucia.robledo@gmail.com",
  },
  {
    name: "Jorge Daniel Peralta",
    external_id: "DNI 12.556.890",
    patient_type: "social_security",
    phone: "+54 3547 15-412-330",
    notes: "EPOC. Control cada 15 días.",
  },
  {
    name: "Rosa Mabel Quiroga",
    external_id: "DNI 18.774.202",
    patient_type: "independent",
  },
  {
    name: "Luis Ernesto Bustos",
    external_id: "DNI 30.118.447",
    patient_type: "prepaid",
    email: "lbustos@hotmail.com",
  },
  {
    name: "Sala de Guardia",
    patient_type: "other",
    notes: "Consumo interno del área de guardia (no es un paciente).",
  },
  {
    name: "Vacunatorio Municipal",
    external_id: "CONV-2026-07",
    patient_type: "other",
    phone: "+54 3547 42-0180",
    notes: "Convenio con el municipio. Entregas quincenales.",
  },
];

// Free-text notes sprinkled on a minority of movements, so the movements
// report reads like a log somebody actually kept.
export const ENTRY_NOTES = [
  "Recepción conforme, remito N° 4471.",
  "Faltó una caja, reclamada al proveedor.",
  "Lote controlado con la orden de compra.",
  "Entrega parcial, resto queda pendiente.",
];

export const EXIT_NOTES = [
  "Entrega en mostrador.",
  "Receta archivada.",
  "Consumo de guardia nocturna.",
  "Retira familiar autorizado.",
  "Curación en consultorio 2.",
];
