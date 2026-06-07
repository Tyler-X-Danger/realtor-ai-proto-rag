# AmpAI Hub Platform AI Playbook
**Version:** 3.4.1 | **Owner:** Platform Engineering — AmpAI Hub | **Last Updated:** 2026-05-15

---

## Section 1: LLM Gateway Rules & Portkey Configuration

### 1.1 Overview
All AI/ML feature traffic at Realtor.com that touches an external LLM provider **must** route through our internal LLM Gateway, powered by **Portkey** (self-hosted, k8s cluster `ai-gateway-prod-us-west-2`). Direct outbound calls from application pods to OpenAI, Anthropic, or any other LLM provider are blocked at the network policy layer (Cilium `NetworkPolicy: egress-llm-deny-direct`).

**Gateway Base URL (internal):** `https://ai-gateway.internal.realtor.com/v1`

### 1.2 Portkey Authentication & Routing Headers
Every request sent to the gateway must include the following headers:

```
x-portkey-api-key: <team-scoped-portkey-virtual-key>
x-portkey-provider: openai | anthropic | azure-openai
x-portkey-config: <config-id-from-portkey-dashboard>
x-portkey-metadata: {"team": "<team-slug>", "feature": "<feature-slug>", "env": "prod|staging"}
```

Virtual keys are provisioned per-team and rotated every 90 days. Request a key via the `#ai-infra` Slack channel, tagging `@platform-ai-oncall`. Do NOT hardcode virtual keys in source code — store them in Vault at path `secret/ai-gateway/<team-slug>/portkey-vk`.

### 1.3 Semantic Caching — MANDATORY for Tier-1 Models
**Semantic caching is mandatory** for any endpoint using Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`), GPT-4o (`gpt-4o-2024-08-06`), or any model designated Tier-1. Disabling semantic caching for these models requires a formal waiver approved by the VP of Platform Engineering.

**Cache Configuration in Portkey Config JSON:**
```json
{
  "cache": {
    "mode": "semantic",
    "similarity_threshold": 0.92,
    "max_age": 3600,
    "namespace": "<team-slug>-<feature-slug>"
  }
}
```

- `similarity_threshold: 0.92` is the platform standard. Lowering below `0.85` requires a waiver.
- Cache keys are hashed using a combination of the model ID, system prompt SHA256, and the semantic embedding of the user message.
- Cache hits are logged to the `ai_gateway_cache_hits` table in Snowflake (pipeline: `dbt_ai_observability`) and visible in the AmpAI Hub Token Analytics dashboard.

### 1.4 Token Budget Caps — Per Model Tier
The AmpAI Hub enforces hard daily token budget caps enforced at the gateway layer (not advisory):

| Model Tier | Example Models | Daily Cap (per team) | Overage Behavior |
|---|---|---|---|
| **Tier-1 High** | Claude 3.5 Sonnet, GPT-4o | **$50.00 / day** | Requests rejected with HTTP 429, Slack alert to team lead |
| **Tier-2 Mid** | Claude 3 Haiku, GPT-4o-mini | $1.50 / day | Soft warning at 80%, hard cap at 100% |
| **Tier-3 Fast** | Claude 3 Haiku (streaming), Llama 3.1 8B (self-hosted) | $0.25 / day | No hard cap, monitored |

The **$50/day cap for Tier-1 models** (Claude 3.5 Sonnet) resets at **00:00 UTC** daily. Budget burn is tracked in real-time by the gateway and surfaced in the AmpAI Hub Token Analytics panel.

To request a cap increase, file a ticket in Jira project `AIINFRA` with component `budget-cap-increase`. Approvals require sign-off from your engineering manager and the AmpAI Hub team.

### 1.5 PII Scrubbing Policies
All prompts routed through the LLM Gateway are intercepted by the **PII Scrubbing Layer** (microservice: `pii-scrubber-sidecar`, deployed as an Envoy sidecar on the gateway pods).

**Automatically scrubbed before the prompt reaches the LLM:**
- Social Security Numbers (regex + ML classifier, confidence threshold: 0.97)
- Credit card numbers (Luhn algorithm validated)
- Full legal names combined with date of birth
- IP addresses (IPv4 and IPv6)
- Email addresses (unless feature is explicitly whitelisted via `pii_policy: allow_email`)
- MLS Agent License IDs (pattern: 2 uppercase letters + 7 digits, e.g., `CA1234567`)

**Scrubbing behavior:** Matched entities are replaced with typed placeholders: `[REDACTED_SSN]`, `[REDACTED_EMAIL]`, `[REDACTED_MLS_AGENT_ID]`.

**Logging:** PII scrub events (not the PII itself) are logged to the `pii_scrub_audit` Snowflake table and retained for 365 days per compliance policy `COMP-2024-041`.

**Bypass:** Bypassing PII scrubbing is strictly prohibited for production environments. Staging environments may bypass with flag `pii_scrub_override: true` in the Portkey config, which generates an audit log entry and requires your manager's Okta approval.

---

## Section 2: Cryptic MLS Schema Mappings

### 2.1 Overview
Realtor.com ingests MLS (Multiple Listing Service) data feeds from over 600 regional MLS boards. These feeds use legacy RETS (Real Estate Transaction Standard) or proprietary XML/CSV formats with opaque, abbreviated column names defined decades ago. The **MLS Integration Microservice** (`mls-integration-svc`, repo: `realtor/mls-integration`) is responsible for mapping raw feed columns to the Realtor.com Canonical Property Schema (RCPS).

**Never** query raw MLS tables directly from application code. Always consume data via the RCPS views in Snowflake (`db: PROD_LISTINGS`, `schema: CANONICAL`) or the MLS Integration REST API (`https://mls-integration.internal.realtor.com/v2`).

### 2.2 Property Classification Mappings

| Raw MLS Column | RCPS Canonical Field | Notes |
|---|---|---|
| `L_PropTypeKind` | `property_type` | Integer enum; see Section 2.3 for value map |
| `L_TypeCode` | `listing_type` | `1`=For Sale, `2`=For Rent, `3`=Sold |
| `L_ListingID` | `mls_listing_id` | String; prefix varies by board (e.g., `CRMLS-`, `MFRMLS-`) |
| `L_Status` | `listing_status` | See Section 2.4 for status codes |
| `L_AskingPrice` | `list_price_cents` | Raw value is in dollars; multiply by 100 to store as cents |
| `L_SoldPrice` | `sale_price_cents` | Raw value is in dollars; multiply by 100 to store as cents |
| `L_AddressNumber` | `street_number` | |
| `L_AddressStreet` | `street_name` | |
| `L_AddressCity` | `city` | |
| `L_AddressState` | `state_code` | 2-letter USPS code |
| `L_AddressZip` | `zip_code` | May contain ZIP+4 format; strip to 5 digits |
| `L_Latitude` | `latitude` | WGS84 decimal degrees |
| `L_Longitude` | `longitude` | WGS84 decimal degrees |

### 2.3 Property Type Enum Mappings (`L_PropTypeKind`)

| Raw Integer Value | RCPS `property_type` String |
|---|---|
| `1` | `single_family_residential` |
| `2` | `condominium` |
| `3` | `townhouse` |
| `4` | `multi_family_2_to_4_units` |
| `5` | `manufactured_mobile_home` |
| `6` | `land_lot` |
| `7` | `commercial` |
| `8` | `farm_ranch` |
| `9` | `co_op` |
| `10` | `new_construction` |
| `11` | `luxury_estate` |
| `12` | `55_plus_community` |

### 2.4 Listing Status Code Mappings (`L_Status`)

| Raw Code | RCPS `listing_status` | Description |
|---|---|---|
| `A` | `active` | Currently listed and available |
| `P` | `pending` | Under contract, awaiting close |
| `S` | `sold` | Transaction completed |
| `W` | `withdrawn` | Removed from market by seller |
| `E` | `expired` | Listing contract expired without sale |
| `C` | `cancelled` | Cancelled by agent/broker |
| `H` | `hold` | Temporarily off market |
| `B` | `backup` | Accepting backup offers while primary pending |

### 2.5 Room & Bathroom Mappings

| Raw MLS Column | RCPS Canonical Field | Notes |
|---|---|---|
| `Bth_Tot` | `total_bathrooms` | Includes full and partial baths; float (e.g., `2.5`) |
| `Bth_Full` | `full_bathrooms` | Integer |
| `Bth_Half` | `half_bathrooms` | Integer |
| `Bth_Qtr` | `quarter_bathrooms` | Rare; used by some luxury boards |
| `LFT_Sqft` | `living_area_sqft` | Interior livable square footage |
| `Grg_Sqft` | `garage_sqft` | May be null if no garage |
| `Lot_Sqft` | `lot_size_sqft` | Full parcel; convert acres if `Lot_AcreKind=1` (multiply by 43560) |
| `Bd_Tot` | `total_bedrooms` | Integer |
| `Str_TotFlr` | `total_stories` | Integer; null for land |
| `YB_BuiltEff` | `year_built` | Use `YB_BuiltEff` (effective year) over `YB_Built` (original) when available |

### 2.6 Financial & HOA Mappings

| Raw MLS Column | RCPS Canonical Field | Notes |
|---|---|---|
| `HOA_YN` | `has_hoa` | `Y`=true, `N`=false |
| `HOA_Fee` | `hoa_fee_monthly_cents` | Raw is monthly in dollars; multiply by 100 |
| `HOA_FeeFreq` | `hoa_fee_frequency` | `M`=Monthly, `Q`=Quarterly, `A`=Annual; normalize to monthly for RCPS |
| `Tx_AnnualAmt` | `annual_tax_cents` | Raw in dollars; multiply by 100 |
| `Tx_Year` | `tax_assessment_year` | Year the tax assessment applies to |
| `LD_DaysOnMkt` | `days_on_market` | Integer; recalculated daily by the RCPS pipeline |
| `PR_PriceChg` | `price_reduction_count` | Number of price reductions since original listing |

### 2.7 MLS Integration Microservice API
To resolve a raw MLS listing to RCPS format programmatically:

```http
POST https://mls-integration.internal.realtor.com/v2/transform
Content-Type: application/json
x-api-key: <service-account-key-from-vault>

{
  "mls_board_id": "CRMLS",
  "raw_listing": {
    "L_ListingID": "CRMLS-23456789",
    "L_PropTypeKind": 2,
    "Bth_Tot": 2.5,
    "Bd_Tot": 3,
    "L_AskingPrice": 750000
  }
}
```

Response returns a fully validated RCPS object. Validation errors are returned in the `errors` array and should be surfaced to the ingestion pipeline dead-letter queue (`sqs://mls-dlq-prod`).

---

## Section 3: Automated UAT Compliance

### 3.1 Overview
Realtor.com operates a Zero-Manual-UAT policy for all consumer-facing and internal UI features. Automated UAT compliance gates run natively inside the CI/CD deployment pipeline (GitHub Actions + Argo Rollouts) and **must pass before any canary promotion beyond 10% traffic**. This eliminates manual verification latency from the release cycle.

The automation suite is maintained by the **Developer Experience (DevEx)** team, repo: `realtor/ui-compliance-suite`.

### 3.2 UI Layout Validation
Automated layout compliance uses **Playwright** with custom Realtor.com assertions layered on top. The test suite is triggered by the `layout-compliance` GitHub Actions workflow on every PR targeting `main`.

**Enforced Layout Rules:**
- **Grid Baseline:** All page layouts must conform to the Realtor Design System (RDS) 12-column grid. Violations flagged via pixel-diff comparison against golden screenshots stored in S3 (`s3://rdc-ui-compliance-golden-screens`).
- **Component Spacing:** All RDS components must use 4px base-unit spacing tokens (defined in `@realtor/design-tokens`). Hard-coded pixel values in JSX `style` props fail the lint gate (`eslint-plugin-realtor-design-system`).
- **Viewport Coverage:** Tests must pass at three standard breakpoints: `375px` (mobile), `768px` (tablet), `1440px` (desktop).
- **Z-Index Coherence:** No element may use a z-index above `1000` without a documented exception in the `z-index-registry.json` config file.

### 3.3 Copy & Content Validation
The **AI Copy Compliance Bot** (`ai-copy-bot`, runs as a GitHub Action step) validates all user-facing strings against:

1. **Fair Housing Act Compliance:** Any listing description or search result copy is scanned for prohibited language (source list: `fair-housing-prohibited-terms.json`). Violations block the PR merge with a required review from the Legal team.
2. **Trademark Correctness:** "Realtor.com" must always be written with the registered trademark mark (`®`) on first mention per page. "realtor" (lowercase) in non-trademark contexts is allowed.
3. **Reading Level:** Consumer-facing copy must score ≤ 8th grade on the Flesch-Kincaid scale (enforced via `readability-score` npm package in the pipeline).
4. **CTA Button Labels:** Call-to-action buttons must follow the RDS verb-first convention: "Schedule Tour", "Save Home", "Contact Agent" — not "Tour Scheduling" or "Home Saved".

### 3.4 Accessibility Testing Guardrails
Accessibility compliance is gated at **WCAG 2.1 AA** level. The following tools run in the pipeline:

| Tool | Scope | Gate Level |
|---|---|---|
| `axe-core` (via `@axe-core/playwright`) | All pages at all 3 breakpoints | **Blocking** — PR cannot merge |
| `color-contrast-checker` (custom RDS wrapper) | All text elements against background | **Blocking** |
| `aria-label-audit` (custom) | Interactive elements without visible labels | **Blocking** |
| Lighthouse CI (`--preset=accessibility`) | Score ≥ 92/100 required | **Blocking for main**, advisory for feature branches |
| Screen Reader Smoke Test (NVDA + Chrome via BrowserStack) | 10 critical user flows | **Blocking for production releases only** |

**Running Locally:**
```bash
# From any UI repo root
npm run compliance:a11y          # axe-core + color contrast
npm run compliance:layout        # Playwright layout diffs
npm run compliance:copy          # AI copy bot (requires OPENAI_API_KEY)
npm run compliance:all           # Full suite (~8 min)
```

### 3.5 Deployment Pipeline Integration
The compliance suite integrates with Argo Rollouts:

```yaml
# argo-rollout.yaml snippet
canarySteps:
  - setWeight: 10
  - pause: { duration: 2m }
  - analysis:
      templates:
        - templateName: ui-compliance-analysis
      args:
        - name: service-url
          value: "https://canary.realtor.com"
  - setWeight: 50  # Only reached if compliance analysis passes
```

The `ui-compliance-analysis` AnalysisTemplate runs the full Playwright suite against the live canary endpoint. A failure at this stage triggers an automatic rollback and pages the on-call team via PagerDuty integration (`pd-service: realtor-ui-oncall`).

### 3.6 Bypassing Compliance (Emergency Only)
In a P0 incident requiring an emergency hotfix, compliance gates may be bypassed using the `COMPLIANCE_BYPASS=true` secret in the GitHub Actions environment. This action:
1. Requires a second approver with `bypass-approver` role in GitHub CODEOWNERS.
2. Automatically creates a Jira ticket in project `COMP` with `Priority: High`.
3. Sends a Slack notification to `#compliance-alerts` and `#engineering-leadership`.
4. Schedules an automated follow-up compliance run within 24 hours.

---

## Section 4: AmpAI Hub Team Directory & Escalation Paths

| Role | Name | Slack Handle | Responsibility |
|---|---|---|---|
| Platform AI Lead | Priya Venkataraman | `@priya-v` | LLM Gateway strategy, Portkey config ownership |
| AI Infra Engineer | Marcus Okonkwo | `@marcus-o` | Gateway k8s ops, PII scrubber, budget enforcement |
| MLS Integration Lead | Sofia Reyes | `@sofia-r` | RCPS schema ownership, MLS board onboarding |
| DevEx / Compliance Lead | Jin-ho Park | `@jinho-p` | UI compliance suite, Playwright framework |
| AmpAI Hub Product | Rachel Goldstein | `@rachel-g` | Roadmap, stakeholder communication |

**On-call rotation:** `#ai-infra-oncall` — check PagerDuty schedule at `https://realtor.pagerduty.com/schedules/PAMPAI1`

---

## Section 5: Quick Reference Cheat Sheet

- **Gateway URL:** `https://ai-gateway.internal.realtor.com/v1`
- **Tier-1 Daily Cap:** $50.00 (Claude 3.5 Sonnet, GPT-4o) — resets 00:00 UTC
- **Semantic Cache Threshold:** 0.92 similarity (standard); waiver required below 0.85
- **PII Scrubbing:** Automatic on all gateway traffic; bypass blocked in prod
- **MLS Raw → RCPS:** Never query raw MLS tables; use `mls-integration-svc` or RCPS Snowflake views
- **`L_PropTypeKind` = 2:** Maps to `condominium`
- **`Bth_Tot`:** Maps to `total_bathrooms` (float, includes half baths)
- **UAT Compliance:** Runs in CI/CD; WCAG 2.1 AA blocking gate; Lighthouse ≥ 92/100
- **Emergency Bypass:** Requires second approver + auto-creates Jira + Slack alert
