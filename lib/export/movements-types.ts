// Shared between the export server action and the client exporters.
// (Lives outside actions.ts because "use server" modules may only export
// async functions.)

export const EXPORT_MAX_ROWS = 5000;

// Raw codes (category/criticality/type/patient_type) travel over the wire;
// the client resolves them to labels via i18n so es.json stays the single
// label source.
export type MovementExportRow = {
  created_at: string;
  product_name: string;
  category: string | null;
  criticality: string | null;
  type: string;
  quantity: number;
  expiry_date: string | null;
  user_name: string;
  provider_name: string | null;
  receptor_name: string | null;
  notes: string | null;
};

export type MovementsExportResult =
  | { ok: true; rows: MovementExportRow[]; truncated: boolean }
  | { ok: false; error: string };
