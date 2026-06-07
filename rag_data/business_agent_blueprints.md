# Business Agent Blueprints — Multi-Agent Orchestration Architecture

**Owner:** AI Platform Team · AI Engineering  
**Stack:** LangGraph (orchestration) + LlamaIndex (RAG/retrieval) + Portkey LLM Gateway  
**Status:** Internal pilot — Q1 2026

---

## Overview

This document describes the three production-grade multi-agent workflows deployed for non-technical business units at Realtor.com. Each agent is built on a shared infrastructure layer: LangGraph for stateful multi-step orchestration, LlamaIndex for retrieval-augmented context injection, and the Portkey gateway for LLM routing, spend tracking, and PII scrubbing.

All agents operate under the same gateway policy as engineering teams: PII scrubbing is mandatory, all prompts are attributed to the owning team slug, and Tier-1 model usage (Claude Sonnet 4.6) requires platform approval.

---

## Agent 1: Client Revenue Agent

**Business Unit:** Revenue Operations / Agent Success  
**Team Slug:** `revenue-ops-agent`  
**LLM Routing:** Claude Sonnet 4.6 (Tier-1 — complex reasoning, approved)  
**Trigger:** Daily batch at 06:00 UTC + on-demand via Revenue Ops Slack slash command

### Purpose

The Client Revenue Agent ingests historic CRM customer data, sales interaction logs, and local property transaction histories to dynamically forecast commission pipelines and generate automated risk-mitigation plays for real estate agents experiencing drop-offs in transaction velocity.

### Data Sources Ingested

- **CRM Data:** Salesforce export — contact records, opportunity stages, last-touch timestamps, agent assignment history
- **Sales Interaction Logs:** Call transcripts (auto-transcribed via Whisper), email thread summaries, showing schedules from ShowingTime API
- **Transaction Histories:** Local MLS closed transaction feed — zip code, buyer segment, sale price, days-on-market, agent commission rate, concession flag
- **Market Context:** Realtor.com hotness scores, inventory counts, price-per-sqft trends (from `realtor_context` table in the canonical data warehouse)

### LangGraph Orchestration Flow

```
[Trigger] → [Data Ingest Node]
               → Snowflake: pull last 90 days transactions for agent's zip codes
               → Salesforce API: pull open opportunities + last-touch dates
            → [RAG Context Node]
               → LlamaIndex VectorStoreIndex query: retrieve relevant market context
               → Inject retrieved context into LLM prompt
            → [Forecast Generation Node]
               → Claude Sonnet 4.6: generate 30/60/90-day commission pipeline forecast
               → Identify agents with >20% MoM velocity drop-off (risk cohort)
            → [Risk Mitigation Node]
               → For each at-risk agent: generate 3 specific outreach plays
               → Format as structured JSON: { agent_id, risk_score, plays: [...] }
            → [Delivery Node]
               → POST to Revenue Ops Slack channel (#revenue-agent-alerts)
               → Write forecast to Snowflake: ai_revenue_forecasts table
               → Update CRM opportunity stage if confidence > 0.85
```

### Key Outputs

- **Commission Pipeline Forecast:** 30/60/90-day projected close volume per agent, cohort, and zip code
- **Risk Cohort Report:** Ranked list of agents by transaction velocity drop-off with root cause tags (e.g., "inventory shortage in primary zip," "lead quality decline," "increased competitor closings")
- **Automated Plays:** Concrete, personalized outreach scripts and recommended listing price adjustments for each at-risk agent
- **Snowflake Write:** All forecasts archived in `ai_revenue_forecasts` for FinOps and Sales leadership dashboards

### SLA & Monitoring

- **Daily batch completion:** ≤ 45 minutes from trigger
- **Slack delivery:** ≤ 5 minutes after batch completes
- **PagerDuty alert:** If batch fails or Snowflake write errors — pages `revenue-ops-agent` on-call

---

## Agent 2: Consumer Marketing Agent

**Business Unit:** Consumer Marketing / Growth  
**Team Slug:** `consumer-mktg-agent`  
**LLM Routing:** GPT-4o-mini (creative copy generation) + Claude Sonnet 4.6 (compliance validation)  
**Trigger:** Continuous — triggered on new MLS listing ingestion event (Kafka topic: `mls.listing.canonical`)

### Purpose

An automated workflow asset that transforms messy MLS listing metadata descriptions into polished, cross-channel social ad creative. Critically, it includes an automated compliance check block that validates all generated copy against the Fair Housing Act and local real estate advertising laws before any asset is published or handed off to the media buying platform.

### Data Sources Ingested

- **MLS Listing Metadata:** Raw `ListingDescription`, structured fields (`Bth_Tot`, `Sq_Feet`, `Lst_Price`, `L_PropTypeKind`, `property_features`, neighborhood tags) from the RESO v2.0 normalized canonical schema
- **Brand Guidelines:** LlamaIndex-indexed brand voice guide, approved adjective list, banned terms registry (e.g., exclusionary language flagged by Fair Housing)
- **Compliance Corpus:** LlamaIndex-indexed Fair Housing Act full text, HUD guidance documents, state-level advertising regulations for TX, CA, FL, NY, IL (the five highest-volume Realtor.com markets)
- **Historical Ad Performance:** Engagement rate, CTR, conversion rate by ad variant from Meta Ads API and Google Ads API — used to bias copy generation toward high-performing patterns

### LangGraph Orchestration Flow

```
[Kafka Event: new listing] → [Metadata Enrichment Node]
               → Fetch canonical listing record from data warehouse
               → Enrich with neighborhood hotness score, school district data, walkability index
            → [Copy Generation Node]
               → GPT-4o-mini: generate 3 variants per channel (Facebook, Instagram, Google Display)
               → Each variant: headline (≤30 chars), body (≤125 chars), CTA
               → Inject brand voice context from LlamaIndex retrieval
            → [Compliance Check Node]  ← BLOCKING GATE
               → Claude Sonnet 4.6: validate all 9 generated variants against:
                  1. Fair Housing Act — screen for steering language, discriminatory descriptors,
                     protected class references (race, religion, national origin, sex, disability,
                     familial status)
                  2. HUD advertising guidance — check for neighborhood characterizations that
                     imply demographic composition
                  3. State-specific rules — validate against jurisdiction's advertising
                     disclosure requirements
               → If any variant fails: flag with specific violation code, regenerate that variant
               → If all variants pass: mark as `compliance_status: approved`
            → [Publishing Node]  ← Only runs if compliance_status = approved
               → POST approved variants to Meta Marketing API (campaign draft)
               → POST to Google Ads API (responsive display ad asset group)
               → Write asset record to `ai_marketing_assets` Snowflake table
            → [Audit Log Node]
               → Write compliance check result + flagged variants (if any) to
                 `ai_compliance_audit` table — retained 24 months per legal requirement
```

### Fair Housing Compliance Logic

The compliance check uses Claude Sonnet 4.6 with a specialized system prompt trained on HUD's "Fair Housing Advertising" guidance (24 CFR Part 109). It screens for:

- **Direct violations:** Explicit reference to protected class characteristics
- **Indirect steering:** Language that implies neighborhood demographic composition (e.g., describing a neighborhood's "character" in ways that signal racial or religious makeup)
- **Familial status violations:** Language that discourages families with children or implies age restrictions on non-age-restricted communities
- **Disability violations:** Failure to mention accessibility features when the listing has them, or language that could discourage buyers with disabilities

Any flagged variant returns a structured violation object: `{ variant_id, channel, violation_type, hud_section, suggested_fix }`. The agent automatically attempts one regeneration pass with the violation context injected. If the regenerated variant still fails, the listing is escalated to the Consumer Marketing compliance review queue (#mktg-compliance-review Slack channel) for human review before any publication.

### Key Outputs

- **Ad Variants:** 3 per channel (Facebook, Instagram, Google Display) × all listings that pass compliance = fully automated campaign creative at scale
- **Compliance Audit Trail:** Full record of every check, violation, and resolution — searchable in the AmpAI compliance dashboard
- **Escalation Queue:** Human review required for <2% of listings (those with regeneration failures)

---

## Agent 3: HR & Talent Enablement Agent

**Business Unit:** People Operations / Talent Acquisition  
**Team Slug:** `hr-enablement-agent`  
**LLM Routing:** GPT-4o-mini (Tier-2 — Q&A retrieval tasks)  
**Access:** Internal Slack bot (`@ampai-hr`) + AmpAI Hub web interface (HR portal section)  
**Trigger:** On-demand — responds to staff queries in real time

### Purpose

An internal query tool that allows Realtor.com staff to interrogate dense corporate policy handbooks, Texas leave-of-absence rules, and engineering interview rubrics to instantly standardize answers and eliminate escalation loops to the HR inbox for routine policy questions.

### Data Sources Indexed (LlamaIndex VectorStoreIndex)

- **Employee Handbook:** Full-text, updated quarterly — 180-page PDF covering benefits, PTO policy, conduct standards, remote work policy, equipment stipends
- **Texas Leave-of-Absence Rules:** State-specific statutes and Realtor.com's internal leave administration guide covering FMLA, PFML, military leave, jury duty, bereavement
- **Engineering Interview Rubrics:** Standardized scorecards for all engineering levels (L3–L7) — problem-solving criteria, system design evaluation rubric, behavioral competency definitions, calibration guidelines
- **Performance Review Framework:** Level expectations matrix, rating scale definitions, calibration session guide, promotion criteria by discipline
- **Benefits Summary Plan Description:** Health, dental, vision, 401(k) match, HSA/FSA limits, ESPP details

### LangGraph Orchestration Flow

```
[Staff query via Slack or AmpAI Hub] → [Intent Classification Node]
               → GPT-4o-mini: classify query into domain bucket
                 (leave_policy | benefits | interview | performance | general_hr)
            → [RAG Retrieval Node]
               → LlamaIndex: query the indexed HR document corpus
               → Retrieve top-5 relevant chunks, rerank by semantic similarity
               → Inject retrieved context + source citations into LLM prompt
            → [Response Generation Node]
               → GPT-4o-mini: generate answer grounded in retrieved context
               → Format: plain-language answer + source document citation
               → Flag if query touches gray-area topics requiring HR rep review
            → [Confidence Gate]
               → If confidence < 0.75 OR topic flagged as high-sensitivity
                 (termination, discrimination, medical leave accommodations):
                 → Append: "For this question, please contact People Ops directly
                   at people-ops@realtor.com or book time via Calendly link."
            → [Delivery Node]
               → Reply in Slack thread (ephemeral — visible only to requester)
               → Log query + response to `ai_hr_queries` Snowflake table (anonymized)
```

### Standardization Impact

The HR & Talent Enablement Agent eliminates inconsistent verbal guidance from hiring managers on interview rubrics — a common calibration failure mode. By surfacing the exact rubric language and level expectations from the canonical document corpus, it ensures all interviewers and candidates receive the same definition of "meets bar" at each level. For leave-of-absence queries, it replaces a previously manual 2–3 business day email response SLA with instant, policy-grounded answers — with a clear escalation path for edge cases.

### Privacy & Compliance

- All queries are anonymized before logging — no PII in the `ai_hr_queries` table
- Sensitive topics (termination, accommodation requests, discrimination concerns) are never fully answered by the agent — always escalated to People Ops
- HR corpus documents are access-controlled via the AmpAI Hub RBAC layer — only staff with HR Portal access can invoke this agent

---

## Shared Infrastructure Notes

All three agents share the following platform-level guarantees:

| Concern | Implementation |
|---|---|
| PII scrubbing | Portkey gateway Presidio layer — auto-redacts SSN, email, phone, full names |
| Spend attribution | All calls tagged to `team_slug` — chargeback to business unit budget |
| Audit logging | All agent runs logged to AmpAI compliance dashboard, 90-day retention |
| Failure alerting | PagerDuty integration — batch failures and compliance gate errors page on-call |
| Model fallback | If Tier-1 (Claude Sonnet 4.6) budget exhausted → auto-route to GPT-4o-mini |
| RAG index refresh | LlamaIndex VectorStoreIndex rebuilt nightly at 02:00 UTC from source documents |
