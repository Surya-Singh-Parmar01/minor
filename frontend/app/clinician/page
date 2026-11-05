"use client";

import { useState } from "react";
import { Badge, PageHead, bandTone, type Tone } from "@/components/ui";
import { carePlan, cases as initial, type Case } from "@/lib/data";

const statusTone: Record<Case["status"], Tone> = {
  "awaiting review": "blue",
  approved: "green",
  overridden: "gray",
};

function BandBadge({ band }: { band: Case["band"] }) {
  return band === "refer" ? <Badge tone="blue">Refer · uncertain</Badge> : <Badge tone={bandTone[band]}>{band}</Badge>;
}

export default function Clinician() {
  const [cases, setCases] = useState(initial);
  const [openId, setOpenId] = useState(initial[0].id);
  const [note, setNote] = useState("");
  const open = cases.find((c) => c.id === openId)!;

  function decide(status: Case["status"]) {
    // ponytail: local state only; persist via API + audit log once backend exists.
    setCases((cs) => cs.map((c) => (c.id === openId ? { ...c, status } : c)));
    setNote("");
  }

  const pending = cases.filter((c) => c.status === "awaiting review").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <PageHead eyebrow="Clinician dashboard" title="Review queue">
        {pending} case{pending === 1 ? "" : "s"} awaiting review. Patients see care plans only after you approve them.
      </PageHead>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-normal">Case</th>
                <th className="px-5 py-3 font-normal">Risk</th>
                <th className="hidden px-5 py-3 font-normal sm:table-cell">Modalities</th>
                <th className="px-5 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-bone ${c.id === openId ? "bg-bone" : ""}`}
                >
                  <td className="px-5 py-4">
                    <button type="button" className="font-mono text-xs text-ink-strong" onClick={() => setOpenId(c.id)}>
                      {c.id}
                    </button>
                    <p className="text-xs text-muted">{c.age}{c.sex} · {c.submitted}</p>
                  </td>
                  <td className="px-5 py-4"><BandBadge band={c.band} /></td>
                  <td className="hidden px-5 py-4 text-xs text-muted sm:table-cell">{c.modalities.join(", ")}</td>
                  <td className="px-5 py-4"><Badge tone={statusTone[c.status]}>{c.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card p-6">
          <p className="font-mono text-xs text-muted">{open.id}</p>
          <div className="mt-2 flex items-center gap-2">
            <BandBadge band={open.band} />
            <Badge tone={statusTone[open.status]}>{open.status}</Badge>
          </div>
          {open.band === "refer" && (
            <p className="mt-4 rounded-md bg-blue-bg p-3 text-xs text-blue-fg">
              Model abstained: confidence set spans low to high. Specialist assessment recommended; no care plan drafted.
            </p>
          )}

          <h2 className="mt-6 text-sm font-medium text-ink-strong">Draft care plan</h2>
          <ul className="mt-3 space-y-2 text-xs text-muted">
            {carePlan.sections.map((s) => (
              <li key={s.title}>
                <span className="text-ink">{s.title}:</span> {s.items[0]}
              </li>
            ))}
          </ul>

          <label className="mt-6 block text-xs text-muted">
            Note or override reason
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="field mt-1" />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1 justify-center"
              disabled={open.status !== "awaiting review" || open.band === "refer"}
              onClick={() => decide("approved")}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-ghost flex-1 justify-center"
              disabled={open.status !== "awaiting review" || !note.trim()}
              onClick={() => decide("overridden")}
            >
              Override
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted">Every decision is written to the audit log.</p>
        </aside>
      </div>
    </div>
  );
}
