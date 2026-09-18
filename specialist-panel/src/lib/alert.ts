// Red-case alert (TZ §6 F-13): a short tone plus a browser notification.
// The tone is synthesised with the Web Audio API so the panel ships no asset file.

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

/** Browsers block audio until the user interacts; call this from a click. */
export function unlockAudio(): void {
  const ctx = context();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Two short rising beeps — recognisable across a noisy demo room. */
export function playRedAlert(): void {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const start = ctx.currentTime;
  const tones = [
    { at: 0, freq: 880 },
    { at: 0.22, freq: 1245 },
  ];
  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.freq, start + tone.at);
    gain.gain.setValueAtTime(0.0001, start + tone.at);
    gain.gain.exponentialRampToValueAtTime(0.3, start + tone.at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + 0.18);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + tone.at);
    oscillator.stop(start + tone.at + 0.2);
  }
}

export function notificationsAllowed(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* the user dismissed the prompt */
    }
  }
}

export function showRedNotification(title: string, body: string): void {
  if (!notificationsAllowed()) return;
  try {
    new Notification(title, { body, tag: "nazar-red", requireInteraction: false });
  } catch {
    /* some browsers refuse notifications outside a service worker */
  }
}
