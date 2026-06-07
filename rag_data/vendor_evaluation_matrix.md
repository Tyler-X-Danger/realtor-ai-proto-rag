# Vendor Evaluation Matrix — LLM API Cost-Routing Analysis (2026)

**Owner:** AI Platform Team · Portkey Gateway Operations  
**Scope:** Tier-1 and Tier-2 model routing decisions for the AmpAI LLM Gateway  
**Effective:** Q1 2026 · Next review: Q3 2026

---

## Executive Summary

This matrix documents the authoritative model selection and routing logic enforced by the Portkey LLM Gateway at `gateway.internal.realtor.com`. All model API traffic for Realtor.com engineering teams passes through this gateway. Routing decisions are made dynamically based on task type, token volume, latency SLA, and budget tier. This document is the source of truth for cost attribution, capacity planning, and architecture waiver requests.

---

## Model Pricing Reference (2026 Rates)

### Anthropic Claude Sonnet 4.6

| Dimension | Value |
|---|---|
| Input tokens | **$3.00 per million tokens** |
| Output tokens | **$15.00 per million tokens** |
| Context window | **1,000,000 tokens (1M)** |
| Prompt cache write | $3.75 per million tokens |
| Prompt cache read | **$0.30 per million tokens (90% savings vs. standard input)** |
| Tier classification | Tier-1 (requires platform approval) |
| Primary use cases | Architectural refactoring, deep code review, complex reasoning, multi-file git diff generation, long-context test pipeline generation |

**Prompt Caching Economics Deep-Dive:**  
Claude Sonnet 4.6 supports prefix-based prompt caching. For engineering workflows that repeatedly scan the same codebase context — such as daily architecture reviews, incremental diff analysis, or multi-pass refactoring — the cache hit rate on the system prompt + static codebase prefix typically reaches 85–95%. At a cache read cost of $0.30/M tokens (versus $3.00/M for uncached input), a team scanning a 200K-token codebase context 50 times per day reduces that input line item from ~$30/day to ~$3/day — a 90% reduction. Cache TTL is 5 minutes. The gateway automatically maintains cache affinity by routing requests with identical system prompt SHA-256 hashes to the same upstream model instance.

**Why Claude Sonnet 4.6 for Complex Tasks:**  
Claude Sonnet 4.6 leads on multi-step reasoning benchmarks (SWE-bench, HumanEval, MMLU). Its 1M context window allows an entire large repository to be loaded in a single request — eliminating chunking artifacts in architectural refactoring tasks. For Realtor.com use cases, this translates directly to higher-quality output on: data model redesign, MLS schema migration planning, and end-to-end test suite generation from specs.

---

### Google Gemini 1.5 Pro / Gemini 3.1 Pro

| Dimension | Gemini 1.5 Pro | Gemini 3.1 Pro |
|---|---|---|
| Input tokens (text) | **$1.25 per million tokens** | **$2.00 per million tokens** |
| Output tokens | **$5.00 per million tokens** | **$12.00 per million tokens** |
| Context window | 2,000,000 tokens | 1,000,000 tokens |
| Native multimodal | Yes (text, image, video, audio) | Yes |
| Context cache storage | **$4.50 per million tokens/hour** | **$4.50 per million tokens/hour** |
| Tier classification | Tier-2 (self-serve for image/video use cases) | Tier-1 (requires approval) |

**Native Multimodal Capabilities:**  
Gemini 1.5 Pro and 3.1 Pro natively process raw image and video assets without a separate vision pipeline. For Realtor.com, this unlocks: direct ingestion of MLS listing photo feeds for quality scoring and metadata extraction, processing of drone/virtual tour video for room classification, and reading raw floorplan images for square footage extraction. The ultra-low context caching storage cost ($4.50/M tokens/hr) makes it economical to keep large MLS media batch jobs cached across a processing window, avoiding repeated upload costs.

**MLS Media Processing Architecture:**  
MLS listing images are ingested via the RESO v2.0 pipeline and batched in 500-listing windows. The Portkey gateway routes these batches to Gemini 1.5 Pro, uploading assets once to the Files API and reusing the cache handle across the batch window. At average MLS image set sizes (~80 images/listing, ~2MB each), the caching approach reduces per-batch API cost by approximately 60% versus stateless per-request calls.

---

### Google Gemini Flash (High-Velocity Tier)

| Dimension | Value |
|---|---|
| Input tokens | **$0.075 per million tokens** |
| Output tokens | **$0.30 per million tokens** |
| Context window | 1,000,000 tokens |
| Tier classification | Tier-2 (self-serve) |
| Primary use cases | Autocomplete, syntax checking, low-latency inference, high-frequency classification tasks |

---

## Portkey Gateway: Dynamic Routing Logic Architecture

The Portkey LLM Gateway operates as a **dynamic traffic cop** — it evaluates each incoming request against a routing policy ruleset and forwards to the optimal model endpoint based on task classification, latency SLA, and team budget remaining.

### Routing Tiers

**Tier A — High-Velocity / Low-Complexity (→ Gemini Flash or Local Model)**  
Triggered by: autocomplete requests, basic script syntax checking, single-line completions, short classification tasks (<500 input tokens, expected output <100 tokens).  
Route: Gemini Flash at $0.075/M input. For teams with on-prem GPU capacity, the gateway can route to a self-hosted CodeGemma or DeepSeek instance at zero API cost.  
Latency SLA: ≤ 150ms p95.

**Tier B — Mid-Complexity (→ GPT-4o-mini or Gemini 1.5 Pro)**  
Triggered by: summarization, retrieval-augmented Q&A, moderate-length code generation (<8K input tokens, expected output <2K tokens), MLS image batch processing.  
Route: GPT-4o-mini at $0.60/M output for text tasks; Gemini 1.5 Pro for multimodal/image tasks.  
Latency SLA: ≤ 800ms p95.

**Tier C — High-Complexity (→ Claude Sonnet 4.6)**  
Triggered by: git diff generation spanning >10 files, architectural refactoring requests, long-context test pipeline generation, multi-step reasoning chains, requests explicitly tagged `x-ampai-tier: complex`.  
Route: Claude Sonnet 4.6 with prompt cache enabled.  
Latency SLA: ≤ 5s p95 (acceptable for async IDE workflows).

### Routing Decision Algorithm

```
1. Parse request: extract token estimate, task_type header, team_slug
2. Check team daily budget remaining → if <10% remaining: downgrade one tier
3. Classify task_type:
   - "autocomplete" | "syntax" | "classify" → Tier A
   - "summarize" | "rag" | "codegen-short" | "image" → Tier B
   - "refactor" | "diff" | "test-gen" | "architect" → Tier C
4. Apply model override if x-ampai-model header present (requires waiver if Tier-1)
5. Inject cache key: SHA-256(model_id + system_prompt + semantic_embedding(user_message))
6. Forward to resolved endpoint; log attribution to team_slug
```

---

## Cost-Routing Decision Matrix

| Task Type | Recommended Model | Input Cost/M | Output Cost/M | Rationale |
|---|---|---|---|---|
| Autocomplete, syntax check | Gemini Flash | $0.075 | $0.30 | Lowest latency, highest volume |
| RAG-based Q&A | GPT-4o-mini | $0.15 | $0.60 | Good reasoning, low cost at scale |
| MLS image/video processing | Gemini 1.5 Pro | $1.25 | $5.00 | Native multimodal, cache economics |
| Architectural refactoring | Claude Sonnet 4.6 | $0.30* | $15.00 | 1M context, best reasoning; *cached input |
| Multi-file git diff gen | Claude Sonnet 4.6 | $0.30* | $15.00 | Complex reasoning, long output required |
| Complex test pipeline gen | Claude Sonnet 4.6 | $0.30* | $15.00 | Accuracy > speed tradeoff |
| Basic code review | GPT-4o-mini | $0.15 | $0.60 | Cost-effective for < 10-file PRs |

*Assumes prompt cache hit on system prompt + codebase prefix (typical: 85–95% hit rate for IDE workflows)

---

## Architecture Waiver Process

Any deviation from the above routing matrix requires a formal architecture waiver:

- **Waiver required for:** Dropping semantic cache threshold below 0.85, routing Tier-A tasks to Tier-1 models, or using unapproved models not listed in the gateway registry.
- **Approval authority:** AI Platform Lead (priya-v@realtor.com)
- **SLA:** 2 business days for standard waivers; emergency override available via @ampai-oncall Slack with VP Engineering approval.
- **Audit trail:** All waivers are logged in the AmpAI compliance dashboard with expiration dates. Expired waivers trigger automatic routing reversion.

---

## Budget Monitoring & Alerting

- **PagerDuty alert fires at 80% of daily team spend cap**
- **Hard cutoff at 100%:** All Tier-1 requests auto-routed to configured fallback model
- **Fallback model:** GPT-4o-mini ($0.60/M output) — self-serve, no approval required
- **Spend attribution:** All API calls tagged to `team_slug` for chargeback reporting
- **Dashboard:** AmpAI compliance dashboard, retained 90 days; exported to FinOps Snowflake table `ai_spend_daily`
