# NeuroScreen: ML Models

Basic working versions of three screening modules from the synopsis, plus the fusion step that combines them.
They are **research-use screening aids, not diagnostic tools**. The aim at this stage is a working end-to-end
pipeline with honestly reported baseline numbers; accuracy improves in later phases.

| Module | Detects | Model / algorithm | Pretrained part (Hugging Face) | Trained on | Result |
|---|---|---|---|---|---|
| Voice | Parkinson's (PD) | Random Forest classifier on 16 Praat voice features | none | UCI Oxford Parkinson's voice dataset | AUROC 0.74 |
| MRI | Alzheimer's (AD) stage | ResNet-18 image features + Logistic Regression | `microsoft/resnet-18` | `Falah/Alzheimer_MRI` (Hugging Face) | 69% (4 stages), AUROC 0.85 |
| Clinical | AD and PD | Rule-based point score (standard clinical cutoffs) | none | not trained (rules from guidelines) | n/a |
| Fusion | Overall risk | Average per disease + risk-band thresholds | none | n/a | n/a |

---

## 1. Voice module: Parkinson's disease

**Purpose.** Parkinson's affects the muscles used for speech early on. A sustained "aaah" from a person with PD
tends to show more cycle-to-cycle variation in pitch (**jitter**) and loudness (**shimmer**) and more noise
relative to the voice signal (**lower HNR**).

**Pipeline.**
1. **Feature extraction (Praat, via `praat-parselmouth`).** From the uploaded WAV we measure 16 features:
   mean/max/min pitch (Fo, Fhi, Flo), five jitter measures (local %, absolute, RAP, PPQ5, DDP),
   six shimmer measures (local, dB, APQ3, APQ5, APQ11, DDA), HNR, and NHR.
   These are the same measures used in the dataset below, so a live recording can be scored by the trained model.
2. **Classifier: Random Forest** (`scikit-learn`, 300 trees, balanced class weights, min 3 samples per leaf).
   A Random Forest builds many decision trees on random subsets of the data and features and averages their votes;
   it works well on small tabular datasets and gives feature importances that explain which measures mattered.
3. **Output:** `p_pd` (probability of PD indicators), a label at the chosen threshold, and the five most important features.

**Dataset: UCI Oxford Parkinson's Disease Detection** (Little et al., 2008).
195 sustained-vowel recordings, about six per person, from **32 subject IDs** in the file (24 with PD, 8 healthy; the dataset description says 31 people), recorded at the University of Oxford.
Source: <https://archive.ics.uci.edu/dataset/174/parkinsons>. The dataset also contains 6 nonlinear features
(RPDE, DFA, PPE, etc.); we leave them out because they cannot be measured reliably from a live recording with Praat.

**Evaluation.** 4-fold cross-validation **grouped by subject**: a person's recordings are never in both the
training and the test fold. Many published results on this dataset mix recordings of the same person across splits,
which inflates accuracy to 90%+. Our numbers are lower but honest.

| Metric | Value |
|---|---|
| AUROC | 0.739 |
| Accuracy | 0.621 |
| Sensitivity | 0.551 |
| Specificity | 0.833 |
| Decision threshold | 0.753 (chosen to maximise sensitivity + specificity) |

**Limitations.** Only 8 healthy people, all English speakers recorded with lab equipment. Phone recordings
and Indian-language speakers will behave differently; this needs local data (planned: mPower, in-house collection).

---

## 2. MRI module: Alzheimer's disease stage

**Purpose.** Alzheimer's shrinks the hippocampus and enlarges the ventricles, which are visible on structural MRI.

**Pipeline (transfer learning, "linear probe").**
1. **Backbone: [`microsoft/resnet-18`](https://huggingface.co/microsoft/resnet-18)** from Hugging Face.
   ResNet-18 is an 18-layer **convolutional neural network** with residual (skip) connections, pretrained by
   Microsoft on **ImageNet-1k** (1.28 million everyday photos, 1,000 classes). We keep its weights frozen and use it
   as a feature extractor: each MRI slice becomes a 512-number embedding.
2. **Classifier: multinomial Logistic Regression** (`scikit-learn`, standardised inputs, balanced class weights)
   trained on those embeddings to predict 4 stages.
3. **Output:** `stage`, probability of each stage, and `p_ad` = 1 − P(Non_Demented).

Training only the small classifier on top of a frozen pretrained network means the model trains in a few minutes on a
laptop CPU, with no GPU needed.

**Dataset: [`Falah/Alzheimer_MRI`](https://huggingface.co/datasets/Falah/Alzheimer_MRI)** (Hugging Face).
6,400 axial brain MRI slices (128×128, grayscale), already split into **5,120 train / 1,280 test**, labelled
`Non_Demented`, `Very_Mild_Demented`, `Mild_Demented`, `Moderate_Demented`.

| Metric (held-out test split) | Value |
|---|---|
| 4-stage accuracy | 0.690 |
| AUROC, demented vs. non-demented | 0.851 |
| F1: Non_Demented / Very_Mild / Mild / Moderate | 0.762 / 0.642 / 0.571 / 0.828 |

**Limitations.** The dataset gives 2D slices without patient IDs, so slices of the same person may appear in both
train and test, which can make results look better than they are. Slices are pre-processed by the dataset author;
real scans would need skull-stripping and registration first. The final project plans a 3D CNN (MONAI) on ADNI/OASIS-3 volumes.

---

## 3. Clinical module: rule-based score

**Purpose.** Use questionnaire and test scores the patient may already have. No public dataset of these is openly
downloadable (ADNI and PPMI need approved applications), so this version uses **standard screening cutoffs**
instead of a trained model.

| Input | Rule | Points |
|---|---|---|
| MMSE | ≤ 23 (common impairment cutoff) / 24–26 (borderline) | AD +2 / +1 |
| MoCA | < 26 (below normal) / < 18 | AD +1 / +2 |
| UPSIT smell test | ≤ 25 (microsmia) / ≤ 18 (anosmia) | PD +2 / +3 |
| Age | ≥ 65 | AD +1, PD +1 |
| Family history | Alzheimer's / Parkinson's | AD +1 / PD +1 |
| Symptoms | tremor, slowness, soft voice, small handwriting | PD +1 each |

Score per disease = points ÷ 6, capped at 1. The output lists the reasons, which keeps it explainable.
**Planned:** replace with an XGBoost model trained on ADNI and PPMI once access is approved.

---

## 4. Fusion and decision logic

- **Per disease:** average the probabilities of the modules that were provided (AD: clinical + MRI; PD: clinical + voice).
  Missing modules are simply skipped, so any subset works.
- **Risk band** from the higher of the two probabilities: **low** < 0.33 ≤ **moderate** < 0.66 ≤ **high**.
- **Refer:** if two modules disagree by more than 0.5 for the same disease, the result is `refer` (send to a
  specialist) instead of a forced label.

This is a simple baseline. The synopsis's attention-based fusion with calibration and conformal prediction is planned next.

---

## Running it

```bash
cd backend
pip install -r requirements.txt
python train.py               # downloads data, trains both models, writes models/metrics.json (~5 min CPU)
python test_neuroscreen.py    # self-check
uvicorn app:app --port 8000   # API; open http://localhost:8000/docs to try it in the browser
```

Trained models are already in `models/`, so `train.py` is only needed to retrain.

| Endpoint | Input | Returns |
|---|---|---|
| `POST /predict/clinical` | JSON: `age, mmse, moca, upsit, family_history, symptoms` | `p_ad`, `p_pd`, reasons |
| `POST /predict/voice` | WAV file of a sustained "aaah" | `p_pd`, label, top features |
| `POST /predict/mri` | MRI slice image (PNG/JPG) | stage, stage probabilities, `p_ad` |
| `POST /screen` | any of: `clinical` (JSON string), `audio`, `image` | fused risk band and all module outputs |

Sample inputs for a demo are in `samples/`. Example result of `/screen` with all three
(`clinical={"age":68,"mmse":22,"upsit":21}`, the synthetic vowel and the Mild_Demented slice):

```json
{"risk_band": "high", "p_alzheimers": 0.746, "p_parkinsons": 0.561, "modalities_used": ["clinical", "voice", "mri"]}
```

`samples/vowel_synthetic.wav` is a computer-generated vowel used to test the pipeline; record a real "aaah"
(3+ seconds, quiet room) for a meaningful voice result.

## Using it from the website

With the API running on port 8000, start the frontend (`cd frontend && npm run dev`) and open
<http://localhost:4000/screen>. The screening page sends the questionnaire, the sustained-vowel recording
(converted from the browser's format to WAV) and an optional MRI slice (PNG/JPG) to `POST /screen`.
The results page then shows the risk band, both disease probabilities, the most important voice features,
the MRI stage probabilities and the clinical reasons. The API address can be changed with the
`NEXT_PUBLIC_API_URL` environment variable.

## References

1. M. A. Little et al., "Exploiting nonlinear recurrence and fractal scaling properties for voice disorder detection," *BioMedical Engineering OnLine*, 2007; and "Suitability of dysphonia measurements for telemonitoring of Parkinson's disease," *IEEE Trans. Biomed. Eng.*, 2009.
2. K. He et al., "Deep Residual Learning for Image Recognition," CVPR, 2016 (ResNet).
3. L. Breiman, "Random Forests," *Machine Learning*, 2001.
4. *Falah/Alzheimer_MRI* dataset, Hugging Face Hub: <https://huggingface.co/datasets/Falah/Alzheimer_MRI>.
5. Y. Jadoul et al., "Introducing Parselmouth: A Python interface to Praat," *Journal of Phonetics*, 2018.
