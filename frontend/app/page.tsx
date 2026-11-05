import Link from "next/link";
import { ArrowRight, Brain, Microphone, Footprints, Smiley, Eye, ClipboardText } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui";
import { modalities } from "@/lib/data";

const icons = { clinical: ClipboardText, mri: Brain, voice: Microphone, gait: Footprints, face: Smiley, retina: Eye };

// Asymmetric bento, rows of 2+1 / 1+2 / 2+1.
const span = ["sm:col-span-2", "", "", "sm:col-span-2", "sm:col-span-2", ""];

const steps = [
  { n: "01", title: "Use what you have", body: "Voice and a questionnaire are enough to start. MRI, gait, face video and retinal images add evidence when available." },
  { n: "02", title: "Fuse and calibrate", body: "An attention-based fusion model combines modalities. Temperature scaling makes a 0.7 risk mean 0.7." },
  { n: "03", title: "Refuse to guess", body: "Conformal prediction gives a confidence set. When it is too wide, the case goes to a specialist instead of getting a label." },
  { n: "04", title: "Doctor in the loop", body: "Care plans are drafts. A registered doctor approves or overrides every one before the patient sees it." },
];

const faq = [
  { q: "Is this a diagnosis?", a: "No. NeuroScreen is a research-use screening aid. It estimates risk and refers you to a clinician; it does not diagnose and is not a certified medical device." },
  { q: "What do I need for a screening?", a: "A phone or laptop with a microphone, and about ten minutes. Voice and questionnaire results arrive in under ten seconds; imaging results are processed in the background." },
  { q: "Which languages are supported?", a: "Voice tasks and the assistant support English, Hindi and Kannada." },
  { q: "How is my data handled?", a: "Encrypted in transit and at rest, de-identified for storage, and processed only with your explicit consent under the DPDP Act, 2023. You can request deletion at any time." },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-24 sm:px-6 sm:pt-32">
        <div className="stagger max-w-3xl">
          <div style={{ "--i": 0 } as React.CSSProperties}>
            <Badge tone="blue">Alzheimer&apos;s · Parkinson&apos;s</Badge>
          </div>
          <h1 style={{ "--i": 1 } as React.CSSProperties} className="serif mt-6 text-5xl text-ink-strong sm:text-7xl">
            Early signs, explained.
          </h1>
          <p style={{ "--i": 2 } as React.CSSProperties} className="mt-6 max-w-xl text-lg text-muted">
            NeuroScreen screens for early indicators of neurodegenerative disease from voice, cognitive scores, gait,
            MRI and more, and shows exactly which biomarkers drove each result.
          </p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="mt-10 flex flex-wrap gap-3">
            <Link href="/screen" className="btn btn-primary">
              Start a screening <ArrowRight weight="bold" />
            </Link>
            <Link href="/results" className="btn btn-ghost">See a sample result</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
        <h2 className="serif reveal mb-10 text-3xl text-ink-strong">Six screening modules</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {modalities.map((m, i) => {
            const Icon = icons[m.key];
            return (
              <div key={m.key} className={`card reveal p-7 ${span[i]}`}>
                <div className="mb-6 flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-bone text-ink-strong">
                    <Icon size={20} weight="bold" />
                  </span>
                  {m.aux && <Badge tone="yellow">Auxiliary</Badge>}
                </div>
                <h3 className="font-medium text-ink-strong">{m.name}</h3>
                <p className="mt-2 text-sm text-muted">{m.signals}</p>
                <p className="mt-4 font-mono text-xs text-muted">{m.model}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <h2 className="serif reveal mb-12 text-3xl text-ink-strong">How a screening works</h2>
          <div className="grid gap-10 sm:grid-cols-2">
            {steps.map((s) => (
              <div key={s.n} className="reveal border-t border-line pt-6">
                <p className="font-mono text-xs text-muted">{s.n}</p>
                <h3 className="mt-2 font-medium text-ink-strong">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <h2 className="serif reveal mb-8 text-3xl text-ink-strong">Questions</h2>
        {faq.map((f) => (
          <details key={f.q} className="reveal group border-b border-line py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ink-strong">
              {f.q}
              <span className="font-mono text-muted group-open:hidden">+</span>
              <span className="hidden font-mono text-muted group-open:inline">-</span>
            </summary>
            <p className="mt-3 text-sm text-muted">{f.a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
