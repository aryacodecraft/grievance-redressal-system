/**
 * Voice guidance / warning speaker using browser SpeechSynthesis.
 * 
 * Provides an audible voice warning to citizens to submit genuine public grievances
 * and warns about non-civic or fake complaints (DEC-049).
 */

export function speakWarning(text: string, language?: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (language) {
      utterance.lang = language.includes("-") ? language : `${language}-IN`;
    } else {
      utterance.lang = "en-IN";
    }
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    // Non-critical: browsers without speech synthesis silently skip audio
    console.warn("speechSynthesis error:", err);
  }
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}
