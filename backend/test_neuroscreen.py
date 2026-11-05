"""Self-check: python test_neuroscreen.py (needs trained models in models/)."""
import tempfile

import numpy as np
import soundfile as sf

import neuroscreen as ns


def synthetic_vowel(path, seconds=3, f0=130, sr=16000):
    t = np.arange(int(seconds * sr)) / sr
    wobble = 1 + 0.01 * np.sin(2 * np.pi * 5 * t)  # slight vibrato so pitch tracking has work to do
    phase = 2 * np.pi * np.cumsum(f0 * wobble) / sr
    sig = sum(np.sin(k * phase) / k for k in range(1, 8)) * 0.2
    sf.write(path, sig, sr)


def test_clinical_rules():
    healthy = ns.score_clinical({"age": 45, "mmse": 29, "moca": 28, "upsit": 36})
    assert healthy["p_ad"] == 0 and healthy["p_pd"] == 0
    risky = ns.score_clinical({"age": 70, "mmse": 20, "moca": 16, "upsit": 15, "symptoms": ["tremor"]})
    assert risky["p_ad"] > 0.5 and risky["p_pd"] > 0.5


def test_fusion():
    r = ns.fuse({"p_ad": 0.1, "p_pd": 0.2}, {"p_pd": 0.3}, None)
    assert r["risk_band"] == "low" and r["p_parkinsons"] == 0.25
    assert ns.fuse({"p_ad": 0.0, "p_pd": 0.0}, {"p_pd": 0.9}, None)["risk_band"] == "refer"


def test_voice_pipeline():
    with tempfile.TemporaryDirectory() as d:
        synthetic_vowel(f"{d}/a.wav")
        r = ns.predict_voice(ns.voice_features(f"{d}/a.wav"))
    assert 0 <= r["p_pd"] <= 1 and len(r["top_features"]) == 5


if __name__ == "__main__":
    for t in (test_clinical_rules, test_fusion, test_voice_pipeline):
        t()
        print("ok", t.__name__)
