"""NeuroScreen screening models: voice (PD), MRI (AD), clinical rules, and fusion."""
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

MODELS = Path(__file__).parent / "models"
BACKBONE = "microsoft/resnet-18"

# The 16 UCI Parkinson's columns that Praat can measure from a recording.
VOICE_FEATURES = [
    "MDVP:Fo(Hz)", "MDVP:Fhi(Hz)", "MDVP:Flo(Hz)", "MDVP:Jitter(%)", "MDVP:Jitter(Abs)",
    "MDVP:RAP", "MDVP:PPQ", "Jitter:DDP", "MDVP:Shimmer", "MDVP:Shimmer(dB)",
    "Shimmer:APQ3", "Shimmer:APQ5", "MDVP:APQ", "Shimmer:DDA", "NHR", "HNR",
]


# ---------- voice ----------
def voice_features(wav_path: str) -> dict:
    """Extract UCI-style dysphonia features from a sustained-vowel recording with Praat."""
    import parselmouth
    from parselmouth.praat import call

    snd = parselmouth.Sound(str(wav_path))
    if snd.get_total_duration() < 1.0:
        raise ValueError("Recording too short; record at least 1 second of a sustained 'aaah'.")
    f0 = snd.to_pitch().selected_array["frequency"]
    f0 = f0[f0 > 0]
    if len(f0) < 10:
        raise ValueError("No voiced sound detected; record a steady 'aaah'.")
    pp = call(snd, "To PointProcess (periodic, cc)", 75, 500)
    j = lambda kind: call(pp, f"Get jitter ({kind})", 0, 0, 0.0001, 0.02, 1.3)
    s = lambda kind: call([snd, pp], f"Get shimmer ({kind})", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    hnr = call(call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0), "Get mean", 0, 0)
    vals = [
        f0.mean(), f0.max(), f0.min(), j("local"), j("local, absolute"), j("rap"), j("ppq5"), j("ddp"),
        s("local"), s("local_dB"), s("apq3"), s("apq5"), s("apq11"), s("dda"),
        1 / (10 ** (hnr / 10)),  # ponytail: NHR approximated from HNR; MDVP computes it directly
        hnr,
    ]
    return {k: float(np.nan_to_num(v)) for k, v in zip(VOICE_FEATURES, vals)}


@lru_cache
def _voice_model():
    return joblib.load(MODELS / "voice_pd.joblib")


def predict_voice(features: dict) -> dict:
    m = _voice_model()
    x = np.array([[features[k] for k in VOICE_FEATURES]])
    p = float(m["model"].predict_proba(x)[0, 1])
    top = sorted(zip(VOICE_FEATURES, m["importances"]), key=lambda t: -t[1])[:5]
    return {
        "p_pd": round(p, 3),
        "label": "PD indicators" if p >= m["threshold"] else "no PD indicators",
        "threshold": round(float(m["threshold"]), 3),
        "top_features": [{"name": k, "value": round(features[k], 5), "importance": round(float(w), 3)} for k, w in top],
    }


# ---------- MRI ----------
@lru_cache
def _mri():
    from transformers import AutoImageProcessor, ResNetModel

    proc = AutoImageProcessor.from_pretrained(BACKBONE)
    net = ResNetModel.from_pretrained(BACKBONE).eval()
    return proc, net, joblib.load(MODELS / "mri_ad.joblib")


def mri_embed(images, proc=None, net=None):
    """512-d ResNet-18 embeddings for a list of PIL images."""
    import torch

    if proc is None:
        proc, net, _ = _mri()
    with torch.no_grad():
        inputs = proc([im.convert("RGB") for im in images], return_tensors="pt")
        return net(**inputs).pooler_output.flatten(1).numpy()


def predict_mri(image) -> dict:
    proc, net, head = _mri()
    probs = head["model"].predict_proba(mri_embed([image], proc, net))[0]
    classes = head["classes"]
    by_class = {c: round(float(p), 3) for c, p in zip(classes, probs)}
    return {
        "p_ad": round(1 - by_class["Non_Demented"], 3),
        "stage": classes[int(probs.argmax())],
        "class_probs": by_class,
    }


# ---------- clinical (rule-based) ----------
def score_clinical(c: dict) -> dict:
    """Point score from standard screening cutoffs. Missing fields score 0."""
    ad = pd = 0
    reasons = []
    mmse, moca, upsit, age = c.get("mmse"), c.get("moca"), c.get("upsit"), c.get("age")
    if mmse is not None and mmse <= 23:
        ad += 2; reasons.append("MMSE <= 23 (cognitive impairment cutoff)")
    elif mmse is not None and mmse <= 26:
        ad += 1; reasons.append("MMSE 24-26 (borderline)")
    if moca is not None and moca < 26:
        ad += 1 if moca >= 18 else 2; reasons.append("MoCA < 26 (below normal)")
    if upsit is not None and upsit <= 25:
        pd += 3 if upsit <= 18 else 2; reasons.append("UPSIT <= 25 (reduced smell)")
    if age is not None and age >= 65:
        ad += 1; pd += 1; reasons.append("Age >= 65")
    fam = c.get("family_history", "none")
    if fam in ("alzheimers", "both"):
        ad += 1; reasons.append("Family history of Alzheimer's")
    if fam in ("parkinsons", "both"):
        pd += 1; reasons.append("Family history of Parkinson's")
    motor = [s for s in c.get("symptoms", []) if s in ("tremor", "slowness", "soft_voice", "small_handwriting")]
    pd += len(motor)
    if motor:
        reasons.append("Motor/voice symptoms: " + ", ".join(motor))
    # 6 points ~ certain; ponytail: hand-set weights, replace with a model trained on ADNI/PPMI
    return {"p_ad": round(min(ad / 6, 1), 3), "p_pd": round(min(pd / 6, 1), 3), "reasons": reasons}


# ---------- fusion ----------
def band(p: float) -> str:
    return "low" if p < 0.33 else "moderate" if p < 0.66 else "high"


def fuse(clinical=None, voice=None, mri=None) -> dict:
    """Average the available modules per disease; refer when modules disagree strongly."""
    ad = [x for x in ((clinical or {}).get("p_ad"), (mri or {}).get("p_ad")) if x is not None]
    pd = [x for x in ((clinical or {}).get("p_pd"), (voice or {}).get("p_pd")) if x is not None]
    if not ad and not pd:
        raise ValueError("No modality provided.")
    p_ad = round(float(np.mean(ad)), 3) if ad else None
    p_pd = round(float(np.mean(pd)), 3) if pd else None
    disagree = any(len(v) == 2 and abs(v[0] - v[1]) > 0.5 for v in (ad, pd))
    top = max(p for p in (p_ad, p_pd) if p is not None)
    return {
        "risk_band": "refer" if disagree else band(top),
        "referred": disagree,
        "p_alzheimers": p_ad,
        "p_parkinsons": p_pd,
        "modalities_used": [k for k, v in (("clinical", clinical), ("voice", voice), ("mri", mri)) if v],
        "modules": {"clinical": clinical, "voice": voice, "mri": mri},
        "disclaimer": "Research-use screening aid. Not a diagnosis.",
    }
