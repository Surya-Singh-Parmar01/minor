import { SealCheck } from "@phosphor-icons/react/ssr";
import { PageHead } from "@/components/ui";
import { carePlan } from "@/lib/data";

export const metadata = { title: "Care plan · NeuroScreen" };

export default function CarePlan() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <PageHead eyebrow="Care plan" title="What to do next.">
        General guidance based on your screening. It does not replace advice from your own doctor.
      </PageHead>

      <p className="mb-12 flex items-center gap-2 text-sm text-green-fg">
        <SealCheck size={18} weight="fill" /> Reviewed and approved by {carePlan.reviewer} on {carePlan.approved}
      </p>

      {carePlan.sections.map((s) => (
        <section key={s.title} className="reveal grid gap-4 border-t border-line py-8 sm:grid-cols-[10rem_1fr]">
          <h2 className="serif text-2xl text-ink-strong">{s.title}</h2>
          <ul className="space-y-3 text-sm">
            {s.items.map((it) => (
              <li key={it} className="flex gap-3">
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-muted" />
                {it}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
