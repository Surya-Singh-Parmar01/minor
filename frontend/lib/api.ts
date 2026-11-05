// Client for the NeuroScreen FastAPI backend (backend/app.py).

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ScreenResult = {
  risk_band: "low" | "moderate" | "high" | "refer";
  referred: boolean;
  p_alzheimers: number | null;
  p_parkinsons: number | null;
  modalities_used: string[];
  modules: {
    clinical: { p_ad: number; p_pd: number; reasons: string[] } | null;
    voice: { p_pd: number; label: string; threshold?: number; top_features: { name: string; value: number; importance: number }[] } | null;
    mri: { p_ad: number; stage: string; class_probs: Record<string, number> } | null;
  };
};

export async function screen(form: FormData): Promise<ScreenResult> {
  const res = await fetch(`${API_URL}/screen`, { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.detail ?? `Screening service returned ${res.status}`);
  return body;
}

const KEY = "neuroscreen:result";

export function saveResult(r: ScreenResult) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...r, at: new Date().toISOString() })); } catch {}
}

export function loadResult(): (ScreenResult & { at: string }) | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { return null; }
}

/** MediaRecorder gives webm/ogg, which Praat can't read; re-encode as 16-bit mono WAV. */
export async function toWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const pcm = buf.getChannelData(0);
  const v = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([v], { type: "audio/wav" });
}
