"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Microphone, Stop, Check, UploadSimple } from "@phosphor-icons/react";
import { Badge, PageHead } from "@/components/ui";
import { API_URL, saveResult, screen, toWav } from "@/lib/api";

// value = key the backend's clinical rules understand
const symptoms = [
  ["Tremor at rest", "tremor"], ["Slower movements", "slowness"], ["Softer or monotone voice", "soft_voice"],
  ["Reduced sense of smell", "reduced_smell"], ["Forgetting recent events", "memory"], ["Difficulty finding words", "word_finding"],
  ["Getting lost in familiar places", "disorientation"], ["Smaller handwriting", "small_handwriting"],
];

const uploads = [
  { key: "mri", label: "Structural MRI slice", accept: "image/png,image/jpeg", hint: "Axial slice as PNG or JPG.", live: true },
  { key: "gait", label: "Gait recording", accept: ".csv", hint: "Not analysed in this version." },
  { key: "face", label: "Face video", accept: "video/*", hint: "Not analysed in this version." },
  { key: "retina", label: "Fundus / OCT image", accept: "image/*", hint: "Not analysed in this version." },
];

const MIN_SECONDS = 3;

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

function VoiceTask({ prompt, onDone }: { prompt: string; onDone: (audio: Blob | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const started = Date.now();
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer.current);
        const ok = (Date.now() - started) / 1000 >= MIN_SECONDS;
        setState(ok ? "done" : "error");
        onDone(ok ? new Blob(chunks, { type: r.mimeType }) : null);
      };
      r.start();
      rec.current = r;
      setSeconds(0);
      setState("recording");
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-4 border-b border-line py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-ink-strong">{prompt}</p>
        {state === "error" && (
          <p className="mt-1 text-xs text-red-fg">Recording too short or microphone blocked. Try again for at least {MIN_SECONDS} seconds.</p>
        )}
      </div>
      {state === "recording" ? (
        <button type="button" className="btn btn-primary" onClick={() => rec.current?.stop()}>
          <Stop weight="fill" /> Stop · <span className="font-mono">{seconds}s</span>
        </button>
      ) : state === "done" ? (
        <span className="flex items-center gap-2 text-sm text-green-fg"><Check weight="bold" /> Recorded</span>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={start}>
          <Microphone weight="bold" /> Record
        </button>
      )}
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-12 sm:grid-cols-[12rem_1fr]">
      <div>
        <p className="font-mono text-xs text-muted">{n}</p>
        <h2 className="mt-1 font-medium text-ink-strong">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function Screen() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [voice, setVoice] = useState<{ vowel: Blob | null; read: Blob | null }>({ vowel: null, read: null });
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const missing = [!consent && "tick the consent box", !voice.vowel && "record or upload the “aaah”"].filter(Boolean);
  const ready = missing.length === 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const clinical = {
      age: num(f.get("age")), mmse: num(f.get("mmse")), moca: num(f.get("moca")), upsit: num(f.get("upsit")),
      family_history: f.get("family"), symptoms: f.getAll("symptoms"),
    };
    const body = new FormData();
    body.append("clinical", JSON.stringify(clinical));
    try {
      // The voice model is trained on sustained vowels, so only the "aaah" task is scored.
      body.append("audio", await toWav(voice.vowel!), "vowel.wav");
      if (files.mri) body.append("image", files.mri);
      saveResult(await screen(body));
      router.push("/results");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? `Can't reach the screening service at ${API_URL}. Check it is running (cd backend; python -m uvicorn app:app --port 8000). On the deployed site, also allow local network access in the browser, or use the local site at http://localhost:4000/screen.`
          : (err as Error).message
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      <PageHead eyebrow="New screening" title="About ten minutes.">
        Voice and the questionnaire are required. Everything else is optional and only adds evidence.
      </PageHead>

      <Section n="01" title="Consent">
        <label className="flex gap-3 text-sm">
          <input type="checkbox" className="mt-1 accent-ink-strong" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I consent to NeuroScreen processing my voice, answers and any files I upload for screening, as described in the
            privacy notice under the DPDP Act, 2023. I understand this is not a diagnosis and I can request deletion at any time.
          </span>
        </label>
      </Section>

      <Section n="02" title="About you">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Age</span>
            <input name="age" type="number" min={18} max={110} required className="field" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Sex</span>
            <select name="sex" required className="field">
              <option value="">Select</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Family history</span>
            <select name="family" className="field">
              <option value="none">None known</option>
              <option value="alzheimers">Alzheimer&apos;s</option>
              <option value="parkinsons">Parkinson&apos;s</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">MMSE <span className="text-xs">(if known)</span></span>
            <input name="mmse" type="number" min={0} max={30} className="field" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">MoCA <span className="text-xs">(if known)</span></span>
            <input name="moca" type="number" min={0} max={30} className="field" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">UPSIT smell score <span className="text-xs">(if known)</span></span>
            <input name="upsit" type="number" min={0} max={40} className="field" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Language</span>
            <select name="lang" className="field">
              <option>English</option>
              <option>Hindi</option>
              <option>Kannada</option>
            </select>
          </label>
        </div>
        <fieldset className="mt-8">
          <legend className="mb-3 text-sm text-muted">Noticed in the last year</legend>
          <div className="flex flex-wrap gap-2">
            {symptoms.map(([label, value]) => (
              <label key={value} className="cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-sm has-checked:border-ink-strong has-checked:bg-bone">
                <input type="checkbox" name="symptoms" value={value} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section n="03" title="Voice">
        <p className="mb-2 text-sm text-muted">Find a quiet room. Hold the device about 20 cm from your mouth.</p>
        <VoiceTask prompt={`Say "aaah" steadily for as long as you comfortably can.`} onDone={(a) => setVoice((v) => ({ ...v, vowel: a }))} />
        <label className="flex cursor-pointer flex-wrap items-center gap-2 border-b border-line py-4 text-sm text-muted">
          <UploadSimple weight="bold" />
          Or upload a recording of the &ldquo;aaah&rdquo; (WAV, MP3, M4A):
          <input
            type="file"
            accept="audio/*"
            className="text-xs"
            onChange={(e) => setVoice((v) => ({ ...v, vowel: e.target.files?.[0] ?? null }))}
          />
        </label>
        <VoiceTask prompt="Optional, read aloud: The north wind and the sun were disputing which was the stronger." onDone={(a) => setVoice((v) => ({ ...v, read: a }))} />
      </Section>

      <Section n="04" title="Optional data">
        <div className="grid gap-3 sm:grid-cols-2">
          {uploads.map((u) => (
            <label key={u.key} className="card flex cursor-pointer flex-col gap-2 p-5">
              <span className="flex items-center justify-between text-sm font-medium text-ink-strong">
                {u.label}
                {files[u.key] ? <Badge tone="green">Added</Badge> : u.live ? <UploadSimple weight="bold" className="text-muted" /> : <Badge>Coming soon</Badge>}
              </span>
              <span className="truncate text-xs text-muted">{files[u.key]?.name ?? u.hint}</span>
              <input
                type="file"
                accept={u.accept}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFiles((prev) => ({ ...prev, [u.key]: f }));
                }}
              />
            </label>
          ))}
        </div>
      </Section>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-red-bg p-4 text-sm text-red-fg">{error}</p>
      )}
      <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {ready ? "Ready. Voice and questionnaire results take under 10 seconds." : `To continue, ${missing.join(" and ")}.`}
        </p>
        <button type="submit" disabled={!ready || busy} className="btn btn-primary">
          {busy ? "Analysing..." : "Run screening"}
        </button>
      </div>
    </form>
  );
}
