/** Conservative extractive draft assistance: no translation, inference or requests. */
const greetings = /^(?:hello|hi|hey|good morning|good afternoon|good evening|नमस्ते|नमस्कार|सुप्रभात)(?:\s*[,，:–—-]\s*|$)/iu;
const filler = /^(?:um|uh|okay|ok|please help|thank you|thanks|i have a complaint|i want to lodge a complaint|धन्यवाद|मुझे शिकायत करनी है|मला तक्रार करायची आहे|कृपया मदद करें|कृपया मदत करा)[\s,]*$/iu;
// Only introductory reporting/existence phrases: never strip locations,
// ownership, quantities, negation or words inside the issue clause.
const introduction = /^(?:there (?:is|are)(?: an?(?!\s+(?:few|little|lot|number)\b))?|i (?:want|would like) to report(?: that)?|मैं (?:बताना|शिकायत करना) (?:चाहता|चाहती) हूँ कि|मला (?:सांगायचे|तक्रार करायची) आहे की)\s+/iu;

export function suggestVoiceTitle(transcript: string): string | null {
  if (typeof Intl.Segmenter !== "function") return null;
  const normalized = transcript.replace(/\s+/gu, " ").trim();
  const sentences = normalized.split(/\.(?!\p{Nd})|(?<!\p{Nd})\.|[!?।]+/u);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const length = (text: string) => [...segmenter.segment(text)].length;
  for (const sentence of sentences) {
    let phrase = sentence.trim();
    while (greetings.test(phrase) || introduction.test(phrase)) {
      phrase = phrase.replace(greetings, "").replace(introduction, "").trim();
    }
    if (!phrase || filler.test(phrase)) continue;
    const words = phrase.split(/\s+/u);
    if (words.length < 2 || (phrase.match(/\p{L}/gu)?.length ?? 0) < 5) continue;
    if (words.length <= 12 && length(phrase) <= 80) return phrase;
    // No safe semantic shortening is available locally. Keep the existing
    // no-suggestion fallback rather than clipping a location/count/qualifier.
    return null;
  }
  return null;
}
