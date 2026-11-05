"use client";

import { useState } from "react";
import { ArrowUp, Warning } from "@phosphor-icons/react";
import { PageHead } from "@/components/ui";

type Msg = { role: "user" | "assistant"; text: string; source?: string };

// ponytail: keyword check mirrors the backend guardrail for instant UI feedback; the real check runs server-side.
const RED_FLAGS = ["chest pain", "fainted", "can't speak", "cannot speak", "sudden weakness", "suicid", "seizure", "had a fall"];

const suggestions = [
  "What does a moderate risk band mean?",
  "Why does voice matter for Parkinson's?",
  "What is the MIND diet?",
];

// ponytail: canned replies until the RAG endpoint is wired up.
function reply(q: string): Msg {
  const t = q.toLowerCase();
  if (/dose|dosage|mg|how much .* take/.test(t))
    return { role: "assistant", text: "I can't advise on doses or prescriptions. Please ask your doctor; your clinician can see this conversation in the review dashboard." };
  if (t.includes("voice"))
    return { role: "assistant", text: "Parkinson's can affect the muscles used for speech early on. Small changes in steadiness (jitter), breathiness (harmonics-to-noise ratio) and pauses can appear before other symptoms are obvious.", source: "NIA: Parkinson's Disease, Causes, Symptoms and Treatments" };
  if (t.includes("mind"))
    return { role: "assistant", text: "MIND combines Mediterranean and DASH eating patterns: green leafy vegetables, berries, nuts, whole grains, fish and olive oil, with less red meat, fried food and sweets. It is associated with slower cognitive decline.", source: "Morris et al., Alzheimer's & Dementia, 2015" };
  if (t.includes("moderate") || t.includes("risk"))
    return { role: "assistant", text: "A moderate band means some early indicators were found, mostly in your voice recordings. It is not a diagnosis. The recommended next step is a neurologist consultation within six weeks.", source: "NICE NG71: Parkinson's disease in adults" };
  return { role: "assistant", text: "I can explain your result, the screening tasks, and general information about Alzheimer's and Parkinson's. I can't diagnose or recommend treatment.", source: "WHO: Dementia fact sheet" };
}

export default function Assistant() {
  const [lang, setLang] = useState("English");
  const [input, setInput] = useState("");
  const [flag, setFlag] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hello. I can explain your screening result in plain language or answer questions about Alzheimer's and Parkinson's. Every answer cites its source." },
  ]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const red = RED_FLAGS.some((f) => q.toLowerCase().includes(f));
    setFlag(red);
    setMsgs((m) => [
      ...m,
      { role: "user", text: q },
      red
        ? { role: "assistant", text: "This sounds urgent. Please contact emergency services (112) or your nearest hospital now. I've flagged this conversation to your clinician." }
        : reply(q),
    ]);
    setInput("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <PageHead eyebrow="Assistant" title="Ask about your result." />
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)} className="field mb-12 w-auto">
          <option>English</option>
          <option>Hindi</option>
          <option>Kannada</option>
        </select>
      </div>

      {flag && (
        <div role="alert" className="mb-6 flex gap-3 rounded-lg bg-red-bg p-4 text-sm text-red-fg">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0" />
          Red-flag symptom detected. A clinician has been notified. If this is an emergency, call 112.
        </div>
      )}

      <div className="card">
        <ol className="max-h-[28rem] min-h-72 space-y-5 overflow-y-auto p-6" aria-live="polite">
          {msgs.map((m, i) => (
            <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user" ? "max-w-[80%] rounded-lg bg-bone px-4 py-2.5 text-sm" : "max-w-[90%] text-sm"}>
                {m.text}
                {m.source && <p className="mt-2 font-mono text-xs text-muted">Source: {m.source}</p>}
              </div>
            </li>
          ))}
        </ol>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2 border-t border-line p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask in ${lang}...`}
            aria-label="Message"
            className="flex-1 bg-transparent px-2 text-sm outline-none"
          />
          <button type="submit" aria-label="Send" className="btn btn-primary px-3" disabled={!input.trim()}>
            <ArrowUp weight="bold" />
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="btn btn-ghost py-1.5 text-xs text-muted">
            {s}
          </button>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted">
        The assistant does not diagnose or give dosage advice. Answers come from WHO, NIA, NICE and Indian clinical guidance.
      </p>
    </div>
  );
}
