/**
 * PII redaction, mirroring the categories Retell's post-call redaction uses.
 *
 * In production Retell does this on its own servers after the call and the
 * practice never stores the raw text. Here we run the same categories in the
 * open so the client can flip between what was said and what gets stored.
 *
 * This is a demonstration of the shape of redaction, not a replacement for
 * Retell's. Real calls rely on the vendor's redaction under the BAA.
 */

import { DEMO_PATIENTS } from "./seed";

export type RedactionCategory =
  | "PERSON_NAME"
  | "DATE_OF_BIRTH"
  | "PHONE_NUMBER"
  | "EMAIL"
  | "ADDRESS"
  | "SSN"
  | "CUSTOMER_ACCOUNT_NUMBER";

export type Redaction = { category: RedactionCategory; index: number; original: string };

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december";

type Rule = { category: RedactionCategory; pattern: RegExp };

const RULES: Rule[] = [
  { category: "SSN", pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g },
  { category: "EMAIL", pattern: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g },
  {
    category: "PHONE_NUMBER",
    pattern: /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  },
  {
    category: "DATE_OF_BIRTH",
    pattern: new RegExp(
      // "April 12th 1986", "4/12/1986", "twelfth of April eighty six"
      `\\b(?:(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*(?:19|20)?\\d{2})?` +
        `|\\d{1,2}[/-]\\d{1,2}[/-](?:19|20)?\\d{2})\\b`,
      "gi",
    ),
  },
  {
    category: "ADDRESS",
    pattern:
      /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Parkway|Pkwy|Boulevard|Blvd|Court|Ct|Way)\b/g,
  },
  { category: "CUSTOMER_ACCOUNT_NUMBER", pattern: /\b(?:member|account|policy)\s*(?:id|number|#)?\s*[:#]?\s*[A-Z0-9-]{6,}\b/gi },
];

/** Patient names from the seed set, longest first so full names win. */
function nameRule(): Rule {
  const names = new Set<string>();
  for (const p of DEMO_PATIENTS) {
    names.add(`${p.first} ${p.last}`);
    names.add(p.first);
    names.add(p.last);
  }
  const alternation = [...names]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return { category: "PERSON_NAME", pattern: new RegExp(`\\b(?:${alternation})\\b`, "g") };
}

/**
 * Replaces each match with a numbered placeholder, the way Retell does:
 * "Sarah Whitfield" becomes "[PERSON_NAME 1]" and stays that number for the
 * rest of the transcript.
 */
export function redact(text: string): { text: string; found: Redaction[] } {
  if (!text) return { text: "", found: [] };

  const counters = new Map<string, Map<string, number>>();
  const found: Redaction[] = [];
  let out = text;

  for (const rule of [nameRule(), ...RULES]) {
    out = out.replace(rule.pattern, (match) => {
      let seen = counters.get(rule.category);
      if (!seen) {
        seen = new Map();
        counters.set(rule.category, seen);
      }
      const key = match.toLowerCase();
      let index = seen.get(key);
      if (index === undefined) {
        index = seen.size + 1;
        seen.set(key, index);
        found.push({ category: rule.category, index, original: match });
      }
      return `[${rule.category} ${index}]`;
    });
  }

  return { text: out, found };
}

export type TranscriptTurn = { role: string; content: string };

/** Redacts a whole transcript and reports what was removed. */
export function redactTranscript(turns: TranscriptTurn[]): {
  turns: TranscriptTurn[];
  found: Redaction[];
} {
  const found: Redaction[] = [];
  const redacted = turns.map((turn) => {
    const result = redact(turn.content ?? "");
    for (const r of result.found) {
      if (!found.some((f) => f.category === r.category && f.index === r.index)) {
        found.push(r);
      }
    }
    return { ...turn, content: result.text };
  });
  return { turns: redacted, found };
}
