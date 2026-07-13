// Fixed, code-defined patient/receptor types. These stable keys are stored in
// receptors.patient_type; their human labels live in messages/*.json under
// `PatientTypes`. There is no admin UI to manage them — edit this list.
export const RECEPTOR_PATIENT_TYPES = [
  "independent",
  "social_security",
  "prepaid",
  "other",
] as const;

export type ReceptorPatientType = (typeof RECEPTOR_PATIENT_TYPES)[number];
