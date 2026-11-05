"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { DownloadSimple, Info } from "@phosphor-icons/react";
import { Badge, Bar, PageHead, bandTone } from "@/components/ui";
import { loadResult, type ScreenResult } from "@/lib/api";
import { sampleResult } from "@/lib/data";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const label = (s: string) => s.replaceAll("_", " ");

// sessionStorage is client-only; the server render shows the sample, then the real result swaps in.
// The snapshot is the raw JSON string so React can compare it by value.
const subscribe = () => () => {};
const snapshot = () => JSON.stringify(loadResult());

function Probability({ name, p }: { name: string; p: number | null }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-medium text-ink-strong">{name}</span>
        <span className="font-mono text-sm">{p === null ? "not assessed" : pct(p)}</span>
      </div>
      <Bar value={p ?? 0} />
    </div>
  );
}

export default function Results() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "null");
  const stored = useMemo(() => JSON.parse(raw) as ReturnType<typeof loadResult>, [raw]);
  const r: ScreenResult = stored ?? sampleResult;
  const { clinical, voice, mri } = r.modules;
  const modules = [
    { name: "Clinical & cognitive", out: clinical && `AD ${pct(clinical.p_ad)} · PD ${pct(clinical.p_pd)}` },
    { name: "Voice", out: voice && `PD ${pct(voice.p_pd)}` },
    { name: "Structural MRI", out: mri && `AD ${pct(mri.p_ad)}` },
    { name: "Gait", out: null },
    { name: "Facial expressivity", out: null },
    { name: "Retina", out: null },
  ];
  const maxImp = Math.max(...(voice?.top_features.map((f) => f.importance) ?? [1]));
  const fhir = {
    resourceType: "RiskAssessment",
    status: "preliminary",
    prediction: [
      { outcome: { text: "Alzheimer's disease" }, probabilityDecimal: r.p_alzheimers },
      { outcome: { text: "Parkinson's disease" }, probabilityDecimal: r.p_parkinsons },
    ].filter((p) => p.probabilityDecimal !== null),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <PageHead
        eyebrow={stored ? `Screened ${new Date(stored.at).toLocaleString()}` : "Sample result"}
        title="Your screening result"
      >
        {stored
          ? "This is a risk estimate from the NeuroScreen models, not a diagnosis. A clinician will review it before any care plan is shared."
          : "No screening has been run in this browser yet, so this shows a sample. Run a screening to see your own result."}
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card reveal p-7">
          <p className="text-sm text-muted">Overall risk band</p>
          <p className="serif mt-3 text-5xl capitalize text-ink-strong">{r.referred ? "Refer" : r.risk_band}</p>
          <div className="mt-4">
            {r.referred ? <Badge tone="blue">Modules disagree</Badge> : <Badge tone={bandTone[r.risk_band as keyof typeof bandTone]}>{r.risk_band} risk</Badge>}
          </div>
          <p className="mt-6 text-sm text-muted">
            {r.referred
              ? "The modules gave conflicting signals, so the system refers you to a specialist instead of guessing."
              : r.risk_band === "low"
                ? "No strong indicators found. Re-screen in 12 months."
                : "Recommended: neurologist consultation."}
          </p>
        </div>

        <div className="card reveal space-y-6 p-7 sm:col-span-2">
          <p className="text-sm text-muted">Per-disease probability</p>
          <Probability name="Alzheimer's disease" p={r.p_alzheimers} />
          <Probability name="Parkinson's disease" p={r.p_parkinsons} />
          <p className="flex items-center gap-2 text-xs text-muted">
            <Info weight="bold" /> Average of the modules provided for each disease.
          </p>
        </div>

        <div className="card reveal space-y-8 p-7 sm:col-span-2">
          <p className="text-sm text-muted">What drove this result</p>

          {voice && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-ink-strong">Voice: most important features</h3>
              <ul className="space-y-3">
                {voice.top_features.map((f) => (
                  <li key={f.name} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[11rem_1fr_5rem]">
                    <span className="font-mono text-xs text-ink-strong">{f.name}</span>
                    <span className="font-mono text-xs text-muted sm:order-last sm:text-right">{f.value}</span>
                    <div className="col-span-2 sm:col-span-1"><Bar value={f.importance / maxImp} tone="blue" /></div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Model verdict: {voice.label}
                {voice.threshold !== undefined && ` (flags PD at ${pct(voice.threshold)} or above)`}.
              </p>
            </section>
          )}

          {mri && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-ink-strong">MRI: predicted stage {label(mri.stage)}</h3>
              <ul className="space-y-3">
                {Object.entries(mri.class_probs).map(([k, p]) => (
                  <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[11rem_1fr_3rem]">
                    <span className="text-xs text-ink-strong">{label(k)}</span>
                    <span className="font-mono text-xs text-muted sm:order-last sm:text-right">{pct(p)}</span>
                    <div className="col-span-2 sm:col-span-1"><Bar value={p} tone={k === "Non_Demented" ? "green" : "red"} /></div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {clinical && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-ink-strong">Clinical answers</h3>
              {clinical.reasons.length ? (
                <ul className="space-y-1.5 text-sm">
                  {clinical.reasons.map((x) => <li key={x}>· {x}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted">No clinical risk factors from your answers.</p>
              )}
            </section>
          )}
        </div>

        <div className="card reveal p-7">
          <p className="mb-6 text-sm text-muted">Modules</p>
          <ul className="space-y-4">
            {modules.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-2 text-sm">
                <span className={m.out ? "text-ink-strong" : "text-muted"}>{m.name}</span>
                {m.out ? <span className="font-mono text-xs">{m.out}</span> : <Badge>not provided</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={stored ? "/assistant" : "/screen"} className="btn btn-primary">
          {stored ? "Ask about this result" : "Run a screening"}
        </Link>
        <a
          className="btn btn-ghost"
          download="neuroscreen.fhir.json"
          href={`data:application/json,${encodeURIComponent(JSON.stringify(fhir, null, 2))}`}
        >
          <DownloadSimple weight="bold" /> Export FHIR R4
        </a>
      </div>
    </div>
  );
}
