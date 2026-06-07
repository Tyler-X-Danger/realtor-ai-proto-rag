import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# Validate key is present before importing LlamaIndex so the error is readable.
if not os.getenv("OPENAI_API_KEY"):
    raise RuntimeError("OPENAI_API_KEY is not set — add it to .env")

from llama_index.core import Document, Settings, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

Settings.llm = OpenAI(
    model="gpt-4o-mini",
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.1,
)
Settings.embed_model = OpenAIEmbedding(
    model="text-embedding-3-small",
    api_key=os.getenv("OPENAI_API_KEY"),
)

query_engine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global query_engine
    rag_dir = Path(__file__).parent / "rag_data"
    print(f"[AmpAI] Loading knowledge base from {rag_dir} ...")
    documents = [
        Document(text=f.read_text(encoding="utf-8"), id_=f.stem)
        for f in sorted(rag_dir.glob("*.md"))
    ]
    print(f"[AmpAI] Loaded {len(documents)} document(s). Building vector index...")
    index = VectorStoreIndex.from_documents(documents, show_progress=True)
    query_engine = index.as_query_engine(similarity_top_k=3)
    print("[AmpAI] RAG index ready.")
    yield
    query_engine = None


app = FastAPI(title="AmpAI Hub RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if query_engine is None:
        raise HTTPException(status_code=503, detail="RAG index not ready yet.")
    response = query_engine.query(req.message)
    return ChatResponse(reply=str(response))


@app.get("/health")
async def health():
    return {"status": "ok", "index_ready": query_engine is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
