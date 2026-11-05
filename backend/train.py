"""Train the voice (PD) and MRI (AD) models and write metrics.json.

Usage: python train.py
"""
import json
import urllib.request
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score, roc_curve
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from neuroscreen import BACKBONE, MODELS, VOICE_FEATURES, mri_embed

DATA = Path(__file__).parent / "data"
UCI = "https://archive.ics.uci.edu/ml/machine-learning-databases/parkinsons/parkinsons.data"


def train_voice():
    path = DATA / "parkinsons.data"
    if not path.exists():
        DATA.mkdir(exist_ok=True)
        urllib.request.urlretrieve(UCI, path)
    df = pd.read_csv(path)
    subject = df["name"].str.rsplit("_", n=1).str[0]
    X, y = df[VOICE_FEATURES].values, df["status"].values

    # Subject-level 4-fold CV: no person's recordings in both train and test of a fold.
    model = RandomForestClassifier(n_estimators=300, class_weight="balanced", min_samples_leaf=3, random_state=42)
    p = np.zeros(len(y))
    for tr, te in StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=42).split(X, y, subject):
        p[te] = model.fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    # Threshold that maximises sensitivity + specificity (Youden's J) on out-of-fold predictions.
    fpr, tpr, thr = roc_curve(y, p)
    threshold = float(thr[np.argmax(tpr - fpr)])
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    metrics = {
        "dataset": "UCI Oxford Parkinson's Disease Detection (Little et al., 2008)",
        "recordings": int(len(df)), "subjects": int(subject.nunique()),
        "evaluation": "4-fold cross-validation grouped by subject",
        "accuracy": round(accuracy_score(y, pred), 3),
        "auroc": round(roc_auc_score(y, p), 3),
        "sensitivity": round(float(tp / (tp + fn)), 3),
        "specificity": round(float(tn / (tn + fp)), 3),
        "threshold": round(threshold, 3),
    }
    model.fit(X, y)  # final model on all subjects
    joblib.dump({"model": model, "importances": model.feature_importances_, "threshold": threshold}, MODELS / "voice_pd.joblib")
    return metrics


def train_mri():
    from datasets import load_dataset
    from transformers import AutoImageProcessor, ResNetModel

    ds = load_dataset("Falah/Alzheimer_MRI")
    classes = ds["train"].features["label"].names
    proc = AutoImageProcessor.from_pretrained(BACKBONE)
    net = ResNetModel.from_pretrained(BACKBONE).eval()

    def embed(split):
        imgs, feats = ds[split]["image"], []
        for i in range(0, len(imgs), 64):
            feats.append(mri_embed(imgs[i:i + 64], proc, net))
            print(f"  {split}: {min(i + 64, len(imgs))}/{len(imgs)}", end="\r")
        print()
        return np.vstack(feats), np.array(ds[split]["label"])

    Xtr, ytr = embed("train")
    Xte, yte = embed("test")
    head = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced", C=0.5))
    head.fit(Xtr, ytr)
    pred = head.predict(Xte)
    non = classes.index("Non_Demented")
    p_ad = 1 - head.predict_proba(Xte)[:, non]
    metrics = {
        "dataset": "Falah/Alzheimer_MRI (Hugging Face)",
        "backbone": BACKBONE,
        "train_images": int(len(ytr)), "test_images": int(len(yte)),
        "accuracy_4class": round(accuracy_score(yte, pred), 3),
        "auroc_demented_vs_not": round(roc_auc_score(yte != non, p_ad), 3),
        "per_class": {k: round(v["f1-score"], 3) for k, v in classification_report(yte, pred, target_names=classes, output_dict=True).items() if k in classes},
    }
    joblib.dump({"model": head, "classes": classes}, MODELS / "mri_ad.joblib")
    return metrics


if __name__ == "__main__":
    import sys

    MODELS.mkdir(exist_ok=True)
    which = sys.argv[1:] or ["voice", "mri"]  # e.g. `python train.py voice` retrains only voice
    path = MODELS / "metrics.json"
    out = json.loads(path.read_text()) if path.exists() else {}
    if "voice" in which:
        out["voice_pd"] = train_voice()
        print("voice:", out["voice_pd"])
    if "mri" in which:
        out["mri_ad"] = train_mri()
        print("mri:", out["mri_ad"])
    path.write_text(json.dumps(out, indent=2))
