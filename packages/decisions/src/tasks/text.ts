// Small lexical helpers shared by the tasks' on-device rules.

const STOP = new Set(
  `a an the and or but if of to in on at for with by from is are was were be been being it its this that these those
  i you he she we they me him her us them my your our their do does did so as not no yes ok okay just really very
  can could would should will shall may might must have has had get got go going let lets let's about into over
  what which who whom when where why how there here then than too also any some all more most much many one two
  thing things well right sure yeah good great thanks thank please hi hello bit lot like think know want need`.split(
    /\s+/,
  ),
)

export function stem(w: string): string {
  if (w.length <= 4) return w
  return w.replace(/(ations?|ing|ed|es|s|ly|ment|ion)$/, '')
}

/** Lowercased, stemmed content words (stopwords and 1–2 letter tokens dropped). */
export function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  )
}

export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n
}

/** Something was agreed, decided, answered or closed. */
export const SETTLE_CUE =
  /\b(agreed|agree|settled|deal|decided|decision is|let'?s (do|go with|keep|use|ship|make)|sounds good|works for me|that works|will do|book it|approve[ds]?|confirmed?|go ahead|makes sense|done|locked in|final answer|we'?ll go with|owns?|signed off|good choice|perfect|noted|then that'?s)\b|\byes[.,!]/i

/** Explicitly left open. */
export const DEFER_CUE =
  /\b(let me check|check (the|with)|get back to you|come back to|later|next week|park (it|that|this)|parked|not sure|maybe|before we lock|table (it|this|that)|revisit|offline|follow up|no decision|undecided|not yet|hold off|think about it)\b/i

/** A refusal to give the information asked for. */
export const DEFLECT_CUE =
  /\b(rather not|can'?t (share|say|tell)|not able to (share|say)|not at liberty|later (in|after) the process|after the (technical|final|next) round|not (something )?i can|don'?t know yet|to be confirmed|tbd|depends|we'?ll see)\b/i

export const QUESTION =
  /\?\s*$|^(what|how|when|who|where|which|why|is|are|do|does|did|can|could|would|will)\b/i

/** Short values worth extracting: money / numbers / ranges / dates / durations. */
export const VALUE =
  /(\$?\d[\d,.]*\s?(k|m|%|percent|thousand|million)?(\s?(to|-|–|and)\s?\$?\d[\d,.]*\s?(k|thousand|million)?)?(\s?(people|engineers|weeks?|days?|months?|years?|hours?|pm|am))?)|\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\b[\w\s-]{0,40}\b(thousand|people|engineers|weeks?|days?|months?)\b|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b[\w\s,]{0,20}/i

export const FILLER =
  /^\s*(yeah|yes|yep|ok(ay)?|right|sure|mm+|uh+|um+|hmm+|great|cool|thanks?( you)?|got it|can you hear me\??|hello\??|sorry)[.!?,\s]*$/i
