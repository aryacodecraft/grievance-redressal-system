#!/usr/bin/env node
/**
 * One-time generation of the pre-recorded question clips (DEC-039).
 *
 * Every question the voice intake can ask is a fixed template, so each one is
 * synthesized ONCE per language and committed under
 * `public/voice/questions/`. At runtime the browser just plays a static file —
 * no TTS call, no credits, and it still works when Sarvam is unreachable.
 *
 * Run manually (never as part of build/test):
 *   SARVAM_API_KEY=... node scripts/generate-question-audio.mjs [--force]
 *
 * Sarvam TTS (bulbul:v3) is used with a 16 kHz mono WAV output, matching the
 * STT contract so both directions sound consistent. Total one-time spend is
 * roughly 2,000 characters across 24 short clips.
 *
 * Text must match the i18n templates in `lib/i18n/voice.ts`; the completeness
 * test (`scripts/voice-speech.test.mjs`) asserts every file exists, and this
 * script refuses to run if a clip is missing text.
 */

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "voice", "questions");
const ENDPOINT = "https://api.sarvam.ai/text-to-speech";
const MODEL = "bulbul:v3";
const FORCE = process.argv.includes("--force");

/** Question text per kind per language. Mirrors lib/i18n/voice.ts. */
const QUESTIONS = {
  "en-IN": {
    intro: "Namaste. Please tell me what the problem is. You can speak after this prompt.",
    details: "Could you describe the problem in a little more detail? What exactly is happening?",
    location: "Where exactly is the issue located? Mention a landmark, street or area.",
    clarify: "Could you clarify a little more?",
    when: "When did this problem start? Roughly how many days ago?",
    frequency: "Is this happening all the time, or only sometimes? How often?",
    affected: "Who or what is affected by this problem? For example, how many homes or people?",
    danger: "Is anyone in danger because of this? For example, is it near a school or are wires exposed?",
    landmark: "Which well-known place is it closest to? A landmark helps the team find it.",
  },
  "hi-IN": {
    intro: "नमस्ते। कृपया बताएँ कि क्या समस्या है। इस संदेश के बाद आप बोल सकते हैं।",
    details: "कृपया समस्या थोड़ा और विस्तार से बताएँ — ठीक-ठीक क्या हो रहा है?",
    location: "यह समस्या ठीक कहाँ है? कोई लैंडमार्क, गली या इलाक़ा बताएँ।",
    clarify: "क्या थोड़ा और स्पष्ट कर सकते हैं?",
    when: "यह समस्या कब शुरू हुई? लगभग कितने दिन पहले?",
    frequency: "यह हर समय हो रहा है या कभी-कभी? कितनी बार?",
    affected: "इस समस्या से कौन या क्या प्रभावित है? जैसे कितने घर या लोग?",
    danger: "क्या इससे किसी को खतरा है? जैसे स्कूल के पास है या तार खुले हैं?",
    landmark: "यह किस जानी-मानी जगह के सबसे नज़दीक है? लैंडमार्क से टीम को ढूँढने में मदद मिलेगी।",
  },
  "mr-IN": {
    intro: "नमस्ते. कृपया सांगा नक्की काय समस्या आहे. या संदेशानंतर तुम्ही बोलू शकता.",
    details: "कृपया समस्या थोडी अधिक तपशिलात सांगा — नक्की काय घडत आहे?",
    location: "ही समस्या नेमकी कुठे आहे? एखादा लँडमार्क, गल्ली किंवा भाग सांगा.",
    clarify: "थोडे अधिक स्पष्ट करू शकता का?",
    when: "ही समस्या कधी सुरू झाली? अंदाजे किती दिवसांपूर्वी?",
    frequency: "हे सतत होत आहे की कधीतरी? किती वेळा?",
    affected: "या समस्येमुळे कोण किंवा काय प्रभावित आहे? उदा. किती घरे किंवा लोक?",
    danger: "यामुळे कोणाला धोका आहे का? उदा. शाळेजवळ आहे किंवा तारा उघड्या आहेत?",
    landmark: "हे कोणत्या प्रसिद्ध जागेच्या सर्वात जवळ आहे? लँडमार्कमुळे टीमला शोधायला मदत होईल.",
  },
};

/** Speaker per language (bulbul:v3 voice names; all support these locales). */
const SPEAKERS = { "en-IN": "shubh", "hi-IN": "shubh", "mr-IN": "shubh" };

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error("SARVAM_API_KEY is required (set it inline; never commit it).");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let generated = 0;
let skipped = 0;

for (const [language, kinds] of Object.entries(QUESTIONS)) {
  for (const [kind, text] of Object.entries(kinds)) {
    const file = path.join(OUT_DIR, `${kind}.${language}.wav`);
    if (fs.existsSync(file) && !FORCE) {
      skipped += 1;
      continue;
    }
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language_code: language,
        speaker: SPEAKERS[language],
        model: MODEL,
        output_audio_codec: "wav",
        speech_sample_rate: 16000,
      }),
    });
    if (!response.ok) {
      console.error(`${kind}.${language}: HTTP ${response.status} ${await response.text()}`);
      process.exit(1);
    }
    const payload = await response.json();
    const audio = Array.isArray(payload?.audios) ? payload.audios[0] : null;
    if (typeof audio !== "string" || !audio) {
      console.error(`${kind}.${language}: provider returned no audio`);
      process.exit(1);
    }
    fs.writeFileSync(file, Buffer.from(audio, "base64"));
    generated += 1;
    console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(1)} kB`);
  }
}

console.log(`\ngenerated ${generated}, skipped ${skipped} existing (use --force to redo).`);
