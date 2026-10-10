/**
 * Camera stream management utilities.
 *
 * Ensures all MediaStream tracks are reliably stopped across success,
 * failure, timeout, visibility loss, and component unmount.
 */

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}
