/**
 * Matching a spoken identity to a record.
 *
 * The model is asked for first name, last name and a YYYY-MM-DD date, but a
 * real call rarely arrives that neatly. Speech to text hands over "Marcus
 * Delgado" as one string with an empty last name, a spelled surname comes
 * back as "D E L G A D O", and a date can be "November 30th 1974" or
 * "11/30/1974". Identification stays two factor, full name and date of
 * birth, but the comparison forgives the shape of the input.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Normalises a spoken or typed date of birth to YYYY-MM-DD, or null. */
export function parseDob(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  // 11/30/1974 or 11-30-1974, United States order.
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[1])}-${pad(+m[2])}`;

  // "november 30th 1974", "30 november 1974", "nov 30, 1974".
  const words = s.replace(/,/g, " ").replace(/(\d+)(st|nd|rd|th)\b/g, "$1").split(/\s+/);
  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;
  for (const w of words) {
    if (MONTHS[w] !== undefined) month = MONTHS[w];
    else if (/^\d{4}$/.test(w)) year = +w;
    else if (/^\d{1,2}$/.test(w) && day === undefined) day = +w;
  }
  if (month && day && year) return `${year}-${pad(month)}-${pad(day)}`;
  return null;
}

/** Letters only, lower case: "D E L G A D O" and "Delgado" both become "delgado". */
const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Turns whatever the model put in first_name and last_name into name tokens.
 * Single letters are joined, so a spelled surname becomes one token.
 */
export function nameTokens(first: unknown, last: unknown): string[] {
  const raw = `${String(first ?? "")} ${String(last ?? "")}`.toLowerCase();
  const parts = raw.split(/[^a-z]+/).filter(Boolean);
  const out: string[] = [];
  let spelled = "";
  for (const p of parts) {
    if (p.length === 1) {
      spelled += p;
      continue;
    }
    if (spelled) {
      out.push(spelled);
      spelled = "";
    }
    out.push(p);
  }
  if (spelled) out.push(spelled);
  return out;
}

/**
 * True when the spoken name carries this record's last name, and either its
 * first name or nothing that contradicts it. The date of birth is checked
 * separately and exactly, so a surname plus date is still two factors.
 */
export function nameMatches(tokens: string[], first: string, last: string): boolean {
  const f = letters(first);
  const l = letters(last);
  if (!tokens.includes(l)) return false;
  const others = tokens.filter((t) => t !== l);
  return others.length === 0 || others.includes(f) || others.some((t) => f.startsWith(t) && t.length >= 3);
}
