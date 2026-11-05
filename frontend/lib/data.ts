// ponytail: static demo data for pages without a backend endpoint yet (clinician queue, care plan).
import type { ScreenResult } from "@/lib/api";

export type Band = "low" | "moderate" | "high";

export const modalities = [
  { key: "clinical", name: "Clinical & cognitive", signals: "MMSE, MoCA, CDR, MDS-UPDRS, UPSIT smell test, age, family history", model: "Rule-based score (XGBoost planned)", aux: false },
  { key: "mri", name: "Structural MRI", signals: "Hippocampal and entorhinal atrophy, ventricle enlargement, cortical thinning", model: "ResNet-18 (Hugging Face) + logistic regression", aux: false },
  { key: "voice", name: "Voice", signals: "Jitter, shimmer, HNR, pitch variation, pause ratio, MFCCs", model: "Random Forest on Praat voice features", aux: false },
  { key: "gait", name: "Gait", signals: "Stride-time variability, cadence, asymmetry, freezing episodes", model: "1D-CNN temporal model", aux: false },
  { key: "face", name: "Facial expressivity", signals: "Hypomimia, blink rate, facial-muscle movement", model: "MediaPipe Face Mesh + temporal classifier", aux: true },
  { key: "retina", name: "Retina", signals: "RNFL thinning, vascular calibre and tortuosity", model: "RETFound (fine-tuned)", aux: true },
] as const;

// Shown on /results before any screening has been run (real API output from backend/samples).
export const sampleResult: ScreenResult = {
  risk_band: "high",
  referred: false,
  p_alzheimers: 0.746,
  p_parkinsons: 0.561,
  modalities_used: ["clinical", "voice", "mri"],
  modules: {
    clinical: { p_ad: 0.5, p_pd: 0.5, reasons: ["MMSE <= 23 (cognitive impairment cutoff)", "UPSIT <= 25 (reduced smell)", "Age >= 65"] },
    voice: {
      p_pd: 0.622, label: "no PD indicators", threshold: 0.753,
      top_features: [
        { name: "MDVP:Fo(Hz)", value: 130.1, importance: 0.13 }, { name: "MDVP:Flo(Hz)", value: 126.9, importance: 0.12 },
        { name: "MDVP:Shimmer", value: 0.004, importance: 0.07 }, { name: "MDVP:APQ", value: 0.003, importance: 0.07 },
        { name: "HNR", value: 38.2, importance: 0.06 },
      ],
    },
    mri: { p_ad: 0.993, stage: "Mild_Demented", class_probs: { Mild_Demented: 0.647, Moderate_Demented: 0, Non_Demented: 0.007, Very_Mild_Demented: 0.345 } },
  },
};

export type Case = {
  id: string;
  age: number;
  sex: "F" | "M";
  band: Band | "refer";
  modalities: string[];
  submitted: string;
  status: "awaiting review" | "approved" | "overridden";
};

export const cases: Case[] = [
  { id: "NS-2026-0142", age: 61, sex: "M", band: "moderate", modalities: ["Clinical", "Voice", "Gait"], submitted: "26 Oct, 10:42", status: "awaiting review" },
  { id: "NS-2026-0139", age: 72, sex: "F", band: "refer", modalities: ["Clinical", "Voice"], submitted: "26 Oct, 09:15", status: "awaiting review" },
  { id: "NS-2026-0137", age: 68, sex: "F", band: "high", modalities: ["Clinical", "MRI", "Voice"], submitted: "25 Oct, 16:30", status: "awaiting review" },
  { id: "NS-2026-0131", age: 55, sex: "M", band: "low", modalities: ["Voice", "Clinical"], submitted: "25 Oct, 11:02", status: "approved" },
  { id: "NS-2026-0128", age: 64, sex: "M", band: "moderate", modalities: ["Clinical", "Gait", "Face"], submitted: "24 Oct, 14:48", status: "overridden" },
];

export const carePlan = {
  reviewer: "Dr. Kavya Rao, Neurology",
  approved: "26 Oct 2026",
  sections: [
    {
      title: "Diet",
      items: [
        "Follow a MIND / Mediterranean pattern: leafy greens most days, berries twice a week, whole grains, legumes.",
        "Prefer fish, dal and nuts over red and processed meat; cook with olive or mustard oil.",
        "Limit fried snacks, sweets and refined flour.",
      ],
    },
    {
      title: "Exercise",
      items: [
        "150 minutes of moderate aerobic activity a week, such as brisk walking or cycling.",
        "Balance and stretching twice a week; yoga or tai chi are suitable.",
      ],
    },
    {
      title: "Therapy",
      items: [
        "Daily 10-minute voice exercise: sustained vowels and reading aloud at a strong volume.",
        "Physiotherapy assessment for gait and posture.",
      ],
    },
    {
      title: "Follow-up",
      items: [
        "Re-screen voice and questionnaire in 3 months (due 26 Jan 2027).",
        "Neurologist consultation within 6 weeks to review MRI result.",
      ],
    },
    {
      title: "About medicines",
      items: [
        "Levodopa-based drugs and dopamine agonists are the main classes used for Parkinson's symptoms. Only a doctor can decide whether you need them.",
        "Do not start, stop or change any medicine based on this plan.",
      ],
    },
  ],
};
