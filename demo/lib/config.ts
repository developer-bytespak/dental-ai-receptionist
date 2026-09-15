/**
 * DEMO BRANDING. This is the only file to edit when swapping in the real
 * practice. Everything the client sees on screen reads from here.
 *
 * TODO before the demo: replace practice name, locations, phone numbers,
 * provider names and insurance carriers with the client's real details.
 */

export type Provider = {
  id: string;
  name: string;
  title: string;
  /** CSS custom property suffix, see globals.css for the palette. */
  tone: "teal" | "plum" | "amber" | "slate";
  locationId: string;
};

export type Operatory = { id: string; name: string; locationId: string };

export type Location = {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  parking: string;
};

export const PRACTICE = {
  /** TODO: real practice name. */
  name: "Riverside Family Dental",
  shortName: "Riverside",
  /** Shown under the logo on the demo header. */
  tagline: "Two locations, one front desk that never misses a call",
  /** The number the AI gives out for callbacks. TODO: real number. */
  callbackNumber: "(555) 014-2200",
  timezone: "America/New_York",
};

export const LOCATIONS: Location[] = [
  {
    id: "downtown",
    name: "Downtown",
    address: "148 River Street, Suite 200",
    phone: "(555) 014-2200",
    hours: "Mon to Thu 8:00 to 5:00, Fri 8:00 to 2:00",
    parking: "Free garage under the building, entrance on Mill Lane",
  },
  {
    id: "northside",
    name: "Northside",
    address: "3320 Oak Ridge Parkway",
    phone: "(555) 014-2255",
    hours: "Mon to Fri 7:30 to 4:00, alternate Saturdays 8:00 to 1:00",
    parking: "Surface lot, no permit needed",
  },
];

export const PROVIDERS: Provider[] = [
  { id: "prov_patel", name: "Dr. Patel", title: "General dentistry", tone: "teal", locationId: "downtown" },
  { id: "prov_kim", name: "Dr. Kim", title: "General dentistry", tone: "plum", locationId: "downtown" },
  { id: "prov_hayes", name: "Ms. Hayes", title: "Hygienist", tone: "amber", locationId: "downtown" },
  { id: "prov_okafor", name: "Dr. Okafor", title: "General dentistry", tone: "slate", locationId: "northside" },
];

export const OPERATORIES: Operatory[] = [
  { id: "op_d1", name: "Op 1", locationId: "downtown" },
  { id: "op_d2", name: "Op 2", locationId: "downtown" },
  { id: "op_d3", name: "Hygiene 1", locationId: "downtown" },
  { id: "op_n1", name: "Op 1", locationId: "northside" },
];

export type AppointmentType = {
  id: string;
  name: string;
  minutes: number;
  /** Which providers can take it. */
  providerIds: string[];
};

export const APPOINTMENT_TYPES: AppointmentType[] = [
  { id: "hygiene", name: "Cleaning and exam", minutes: 60, providerIds: ["prov_hayes", "prov_okafor"] },
  { id: "exam", name: "New patient exam", minutes: 45, providerIds: ["prov_patel", "prov_kim", "prov_okafor"] },
  { id: "emergency", name: "Emergency visit", minutes: 30, providerIds: ["prov_patel", "prov_kim", "prov_okafor"] },
  { id: "crown", name: "Crown fitting", minutes: 90, providerIds: ["prov_patel", "prov_kim"] },
];

/** Answered from the knowledge base, never from patient data. */
export const INSURANCE_ACCEPTED = [
  "Delta Dental",
  "Cigna",
  "Aetna",
  "MetLife",
  "Guardian",
  "United Concordia",
  "Principal",
];

/** Clinic day boundaries used to draw the schedule grid. */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 17;
export const SLOT_MINUTES = 20;

/**
 * Demo safety rail. The agent must refuse these topics and offer a transfer,
 * and the compliance panel flags the call when one is detected.
 */
export const OUT_OF_SCOPE_TOPICS = [
  "pain",
  "hurts",
  "bleeding",
  "swollen",
  "infection",
  "antibiotic",
  "medication",
  "prescription",
  "balance",
  "bill",
  "invoice",
  "owe",
  "records",
  "x-ray results",
  "diagnosis",
];

export function locationById(id: string) {
  return LOCATIONS.find((l) => l.id === id);
}

export function providerById(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

export function appointmentTypeById(id: string) {
  return APPOINTMENT_TYPES.find((t) => t.id === id);
}
