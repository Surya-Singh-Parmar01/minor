import type { ReactNode } from "react";

export type Tone = "red" | "blue" | "green" | "yellow" | "gray";

const tones: Record<Tone, string> = {
  red: "bg-red-bg text-red-fg",
  blue: "bg-blue-bg text-blue-fg",
  green: "bg-green-bg text-green-fg",
  yellow: "bg-yellow-bg text-yellow-fg",
  gray: "bg-bone text-muted",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">{eyebrow}</p>
      <h1 className="serif text-4xl text-ink-strong sm:text-5xl">{title}</h1>
      {children && <p className="mt-4 text-muted">{children}</p>}
    </div>
  );
}

/** Horizontal bar, value in 0..1. */
export function Bar({ value, tone = "gray" }: { value: number; tone?: Tone }) {
  const fill: Record<Tone, string> = {
    red: "bg-red-fg", blue: "bg-blue-fg", green: "bg-green-fg", yellow: "bg-yellow-fg", gray: "bg-ink",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bone">
      <div className={`h-full origin-left rounded-full ${fill[tone]}`} style={{ transform: `scaleX(${value})` }} />
    </div>
  );
}

export const bandTone = { low: "green", moderate: "yellow", high: "red" } as const;
