# Qazaq Lens Evidence Platform Design

Date: 2026-07-26  
Status: Approved product design; implementation planning pending  
Owner: Dulat Nurlanuly

## 1. Product decision

Qazaq Lens will evolve from an article library into a hybrid of international evidence media and open public evidence infrastructure.

The project will continue publishing readable explainers and visual stories, but each publication will also participate in a reusable evidence system:

1. detect recurring claims;
2. match them to a stable claim registry;
3. verify them through a transparent evidence ledger;
4. expose review status and limitations;
5. publish readable and machine-readable outputs;
6. accept corrections and update downstream outputs.

The system must be useful to ordinary readers, journalists, teachers, researchers, external reviewers and software systems without presenting Qazaq Lens as a final authority.

## 2. Existing foundation

The implementation must preserve the working production system:

- Astro static site deployed through Cloudflare Workers;
- 33 public-beta explainers;
- MDX content with structured claims and sources;
- generated `claims.json`;
- searchable evidence library and Visual Story;
- D1-backed comments and correction reports;
- HMAC-based rate limiting;
- public methodology, review status and change history;
- existing QA, content, image, function and build audits.

MDX remains the editorial source of truth. Generated indexes, APIs, cards and dashboards must derive from MDX or from explicitly moderated D1 records.

## 3. First release scope

The first release adds four connected capabilities.

### 3.1 Ask Qazaq Lens

Readers can paste a claim, question or URL into a dedicated interface.

The system will:

- normalize punctuation, case and common wording differences;
- compare the input with registered myth statements, claim statements, titles, summaries, topics and curated aliases;
- return up to five ranked matches;
- explain why each result matched;
- require a minimum confidence threshold before calling a result a match;
- show a clear “not found” state when evidence is insufficient;
- allow an unmatched claim to be submitted for editorial consideration.

The first release will use deterministic local matching. It will not use an LLM to assign verdicts, generate factual answers or infer evidence.

Unknown submissions will never receive an automatic verdict.

### 3.2 Evidence Health

Every article receives transparent evidence-health signals rather than a synthetic quality score.

Signals include:

- date of the last editorial check;
- source freshness, with different expectations for historical and current claims;
- source-type distribution;
- publisher and independence-group diversity;
- number and confidence of critical claims;
- broken, blocked or transient source links;
- external-review status;
- warnings for time-sensitive claims;
- archived-source coverage where available.

The interface must explain that these signals support editorial review and do not prove that a conclusion is correct.

### 3.3 Verified Cards

Each explainer can produce a reusable claim card containing:

- myth statement;
- verdict;
- concise summary;
- claim ID or article slug;
- last-reviewed date;
- Qazaq Lens identity;
- canonical article URL;
- visible source count;
- public-beta or independently reviewed status.

Outputs:

- canonical share URL;
- downloadable SVG;
- downloadable PNG where browser support permits reliable conversion;
- copyable short citation;
- embeddable HTML card.

Cards must not imply independent review when none exists. Every exported card must link to the full article and include a review date.

### 3.4 Impact Dashboard

The public dashboard will report verifiable impact and editorial accountability:

- article, claim, source and reviewer counts;
- accepted, rejected and resolved corrections;
- updates caused by reader reports;
- data-download and embed-use totals;
- verified external citations entered by the editor;
- most requested existing topics;
- anonymized unmatched-claim demand;
- evidence freshness and review backlog.

Raw HTTP requests, bots, service-worker traffic and other vanity metrics must not be presented as user counts.

## 4. User journeys

### Reader

1. Paste or search a claim.
2. Receive a clear match or a transparent not-found result.
3. Read the 20-second answer.
4. Inspect evidence, uncertainty and review date.
5. Share a dated verified card or challenge the conclusion.

### Journalist or teacher

1. Find a topic.
2. Review the claim ledger and source list.
3. Copy a citation, download a card or use an embed.
4. Follow the canonical article for limitations and updates.

### External reviewer

The first release exposes review status but does not yet implement the full reviewer workflow. A later release will allow a scoped reviewer invitation, claim-level decision, signed review record and public status transition.

## 5. Components and boundaries

### Content registry

Build-time module that converts MDX into a normalized registry. It owns aliases, searchable fields, canonical URLs and evidence-health inputs.

### Claim matcher

Pure, testable module with no database or network dependency. It accepts normalized registry entries and user text and returns scored candidates plus match reasons.

### Ask interface

Client-side interface that performs local matching. It sends data to the Worker only when a user explicitly submits an unmatched claim.

### Evidence-health calculator

Build-time module that returns concrete signals and warnings. It does not return a single numerical trust score.

### Card renderer

Deterministic renderer using article metadata. It produces accessible HTML and SVG from the same input model.

### Impact store

D1-backed aggregate event store. It records bounded event categories and optional article slugs, not raw IP addresses or arbitrary referrer strings.

### Public dashboard

Read-only presentation of aggregated impact and editorial records.

These components communicate through typed data structures. No UI component should parse MDX frontmatter directly.

## 6. Data flow

### Build-time

MDX → schema validation → normalized registry → search data, `claims.json`, evidence-health data, article pages and card metadata.

### Claim lookup

User input → local normalization → local matcher → matched articles or not-found state.

### Unknown claim submission

Explicit user action → same-origin Worker endpoint → validation, honeypot and rate limit → D1 moderation queue → aggregated demand count after moderation.

### Impact event

Allowed event type → same-origin endpoint → validation and HMAC-based rate limiting → D1 aggregate update → public dashboard query.

## 7. Security and privacy

- Never place admin credentials in URLs or generated HTML.
- Moderation endpoints continue requiring a Bearer secret.
- All write endpoints require same-origin requests and bounded JSON bodies.
- User text is escaped and never inserted as executable HTML.
- Rate-limit identities use HMAC-SHA-256 and expire automatically.
- Do not retain raw IP addresses.
- Do not store full unknown-query text publicly.
- Aggregate low-volume data to reduce re-identification risk.
- Unknown claims receive no automatic verdict.
- Embeds use restrictive markup and no third-party tracking.
- Cloudflare Access remains a recommended later control for admin pages.

## 8. Error states

The product must distinguish:

- no strong match;
- several ambiguous matches;
- temporarily unavailable submission API;
- rate-limit response;
- invalid or oversized input;
- unavailable card conversion;
- stale or unreachable evidence source;
- incomplete impact data.

Every state needs a useful next action. API failures must not erase locally displayed search results.

## 9. Accessibility and design

- Full keyboard operation.
- Visible focus and minimum touch targets.
- Semantic headings, forms, tables and status announcements.
- Verdict information must not depend on color.
- Reduced-motion support.
- Cards and SVG exports include readable text alternatives.
- Mobile layouts remain first-class.
- Evidence details use progressive disclosure so the 20-second answer remains comfortable to read.

The visual language should extend the current editorial design rather than introduce an unrelated dashboard aesthetic.

## 10. Testing

### Unit tests

- text normalization;
- alias handling;
- ranking and deterministic tie-breaking;
- minimum match threshold;
- false-positive fixtures;
- evidence-health rules;
- card metadata and escaping.

### Build tests

- all 33 current articles appear in the registry;
- generated outputs agree on counts, verdicts and dates;
- no missing claim or source IDs;
- cards have canonical URLs and review dates;
- no public-beta item is labelled independently reviewed.

### API tests

- same-origin enforcement;
- body limits and content type;
- honeypot;
- rate limiting;
- malformed input;
- output escaping;
- D1 failure handling;
- no raw-IP persistence.

### Browser and accessibility tests

- mobile and desktop claim lookup;
- keyboard-only flow;
- screen-reader status updates;
- card download and embed preview;
- dashboard empty and partial-data states;
- reduced motion.

The release gate remains `npm run qa`, extended with the new unit and integration tests, followed by production smoke tests.

## 11. Success criteria

The first release succeeds when:

1. A reader can check a registered claim in under 20 seconds.
2. Weak or unknown inputs do not receive invented answers.
3. A result explains its match, verdict, evidence path, limitation and date.
4. A reader can export or embed a dated card.
5. A reader can submit an unmatched claim or correction.
6. Evidence-health signals reveal stale or weak areas without fake precision.
7. The dashboard separates verified impact from traffic noise.
8. Existing articles, comments, moderation, PWA and Visual Story continue working.

## 12. Explicitly deferred

The first release does not include:

- LLM-generated verdicts;
- automatic web crawling or social-media surveillance;
- public user accounts;
- unrestricted public comments on claims;
- monetary rewards;
- a full reviewer portal;
- automatic translation;
- a single trust score;
- claims of IFCN membership, accreditation or independent review without evidence.

## 13. Release sequence

1. Normalize the content registry and add tests.
2. Implement deterministic claim matching and Ask Qazaq Lens.
3. Add moderated unmatched-claim intake.
4. Add evidence-health calculation and UI.
5. Implement accessible card rendering and exports.
6. Add privacy-preserving impact aggregation and dashboard.
7. Run full QA, browser tests, security checks and production smoke tests.
8. Deploy only after generated data and production HTML agree.
