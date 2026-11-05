"""NeuroScreen API. Run: uvicorn app:app --port 8000  (interactive docs at /docs)"""
import json
import tempfile
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

import neuroscreen as ns

app = FastAPI(title="NeuroScreen API", description="Research-use screening aid. Not a diagnosis.")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://[a-z0-9-]+\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",  # deployed + local frontend
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,  # Chrome asks before a public site (Vercel) calls this API on localhost
)


class Clinical(BaseModel):
    age: int | None = None
    mmse: int | None = None
    moca: int | None = None
    upsit: int | None = None
    family_history: str = "none"  # none | alzheimers | parkinsons | both
    symptoms: list[str] = []  # tremor | slowness | soft_voice | small_handwriting


async def _voice(f: UploadFile) -> dict:
    with tempfile.NamedTemporaryFile(suffix=Path(f.filename or "a.wav").suffix, delete=False) as tmp:
        tmp.write(await f.read())
    try:
        feats = ns.voice_features(tmp.name)
    except ValueError as e:
        raise HTTPException(422, str(e))
    finally:
        Path(tmp.name).unlink(missing_ok=True)
    return ns.predict_voice(feats)


async def _mri(f: UploadFile) -> dict:
    try:
        img = Image.open(BytesIO(await f.read()))
    except Exception:
        raise HTTPException(422, "Not a readable image.")
    return ns.predict_mri(img)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/predict/clinical")
def predict_clinical(c: Clinical):
    return ns.score_clinical(c.model_dump())


@app.post("/predict/voice")
async def predict_voice(audio: UploadFile = File(..., description="WAV of a sustained 'aaah'")):
    return await _voice(audio)


@app.post("/predict/mri")
async def predict_mri(image: UploadFile = File(..., description="Axial brain MRI slice (PNG/JPG)")):
    return await _mri(image)


@app.post("/screen")
async def screen(
    clinical: str = Form(None, description='JSON, e.g. {"age":68,"mmse":22,"upsit":20}'),
    audio: UploadFile = File(None),
    image: UploadFile = File(None),
):
    c = ns.score_clinical(Clinical(**json.loads(clinical)).model_dump()) if clinical else None
    v = await _voice(audio) if audio else None
    m = await _mri(image) if image else None
    try:
        return ns.fuse(c, v, m)
    except ValueError as e:
        raise HTTPException(422, str(e))
