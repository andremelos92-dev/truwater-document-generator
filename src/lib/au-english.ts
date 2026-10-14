/**
 * US -> Australian spellings, fixed when a text box is left. Only words that are always spelt the Australian way in
 * our documents: "meter" (a flow meter), "program" and "license" are left alone.
 */

const WORDS: Record<string, string> = {
  color: "colour", colors: "colours", colored: "coloured", coloring: "colouring",
  favor: "favour", favors: "favours", favorable: "favourable", favorite: "favourite",
  behavior: "behaviour", behaviors: "behaviours",
  labor: "labour", honor: "honour", neighbor: "neighbour", neighboring: "neighbouring",
  harbor: "harbour", vapor: "vapour", odor: "odour", rumor: "rumour", endeavor: "endeavour",
  center: "centre", centers: "centres", centered: "centred",
  liter: "litre", liters: "litres", kiloliter: "kilolitre", kiloliters: "kilolitres",
  fiber: "fibre", fibers: "fibres", fiberglass: "fibreglass",
  aluminum: "aluminium",
  gray: "grey",
  mold: "mould", molds: "moulds", molded: "moulded", molding: "moulding",
  catalog: "catalogue", catalogs: "catalogues",
  defense: "defence",
  fulfill: "fulfil", fulfillment: "fulfilment", enrollment: "enrolment",
  modeling: "modelling", modeled: "modelled",
  labeled: "labelled", labeling: "labelling",
  canceled: "cancelled", canceling: "cancelling",
  traveled: "travelled", traveling: "travelling",
  leveled: "levelled", leveling: "levelling",
  fueled: "fuelled", signaled: "signalled", totaled: "totalled", channeled: "channelled",
  installment: "instalment", installments: "instalments",
  maneuver: "manoeuvre",
  sulfate: "sulphate",
};

/** "-ize" verbs written "-ise" (not every "-ize" word: size, seize and prize stay). */
const IZE_STEMS = [
  "organ", "author", "final", "optim", "custom", "standard", "recogn", "minim", "maxim", "util", "priorit", "summar",
  "galvan", "anod", "energ", "special", "emphas", "real", "apolog", "critic", "harmon", "stabil", "synchron",
  "sanit", "mobil", "demobil", "local", "categor", "item", "capital", "visual", "character", "neutral", "pressur",
  "steril", "subsid", "symbol", "util", "vapor",
];

for (const stem of IZE_STEMS) {
  for (const [us, au] of [
    ["ize", "ise"], ["ized", "ised"], ["izes", "ises"], ["izing", "ising"], ["ization", "isation"], ["izations", "isations"],
  ]) {
    WORDS[stem + us] = stem + au;
  }
}
WORDS.analyze = "analyse";
WORDS.analyzed = "analysed";
WORDS.analyzes = "analyses";
WORDS.analyzing = "analysing";
WORDS.vaporize = "vaporise";

/** Keeps the case it was typed in: "Color" -> "Colour", "COLOR" -> "COLOUR". */
function matchCase(typed: string, fixed: string): string {
  if (typed === typed.toUpperCase() && typed.length > 1) return fixed.toUpperCase();
  if (typed[0] === typed[0].toUpperCase()) return fixed[0].toUpperCase() + fixed.slice(1);
  return fixed;
}

/** The text with US spellings changed to Australian ones. */
export function toAustralian(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const fixed = WORDS[word.toLowerCase()];
    return fixed ? matchCase(word, fixed) : word;
  });
}

/**
 * Corrects a text box when it's left, through the same change event as typing, so the form sees the new value.
 * Returns true when something was changed.
 */
export function correctField(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  const fixed = toAustralian(element.value);
  if (fixed === element.value) return false;
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, fixed);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
