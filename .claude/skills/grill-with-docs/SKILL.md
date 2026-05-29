---
name: grill-with-docs
description: Documentation-driven design interview. Stress-tests plans against existing domain models, enforces glossary vocabulary, and sharpens terminology through systematic one-at-a-time questioning. Use when the user wants to think through a design, validate terminology, or produce living CONTEXT.md / ADR documentation.
---

# grill-with-docs Agent

A documentation-driven design interview tool that stress-tests plans against existing domain models and sharpens terminology through systematic questioning.

## Core Process

Conduct **relentless one-at-a-time interviews**, waiting for a response before advancing. Explore the codebase when answers exist there rather than asking redundant questions.

## Key Practices

**Vocabulary enforcement**: When user language conflicts with `CONTEXT.md` definitions, surface contradictions immediately — "Your glossary defines X as A, but you seem to mean B."

**Concrete scenario testing**: Stress-test domain relationships through edge cases to expose fuzzy boundaries and force precision.

**Living documentation**: Resolved terms update `CONTEXT.md` inline as decisions crystallise — treat it as a pure glossary stripped of implementation details.

**Selective ADRs**: Only propose an Architecture Decision Record when ALL THREE conditions hold:
- The decision is costly to reverse
- Future readers will question the reasoning
- Genuine trade-offs drove the choice

**Codebase grounding**: When claims about functionality arise, verify them against actual code rather than accepting stated behaviour at face value.

## File Structure

The skill assumes either:
- **Single context**: one `CONTEXT.md` at the repo root
- **Multi-context**: a `CONTEXT-MAP.md` at root routing to each bounded context's `CONTEXT.md`

If neither exists, create a root `CONTEXT.md` when first needed.

---

## CONTEXT.md Format

A `CONTEXT.md` organises domain-specific terminology.

**Structure**:
- Context name + brief description
- Structured definitions of key terms, each with alternatives to avoid under `_Avoid_`

**Rules**:
- Be opinionated: when multiple words exist for the same concept, pick the best one
- Keep definitions to one or two sentences — define what something IS, not what it does
- Include only project-specific terms; skip general programming concepts
- Group logically with subheadings, or keep flat if all terms are cohesive

**Example entry**:
```markdown
### Session
A live connection between one controller and one client, identified by a 6-char code.
_Avoid_: room, channel, call
```

---

## ADR Format

ADRs live in `docs/adr/` with sequential naming: `0001-slug.md`, `0002-slug.md`, etc. Create the directory only when the first ADR is needed.

**Minimal template** (a single paragraph is enough):
```markdown
# 0001-slug

Context, decision, and why — one paragraph suffices. The goal is capturing *that* a decision happened and its reasoning.
```

**Optional additions** (only when genuinely valuable):
- Status: proposed / accepted / deprecated / superseded
- Considered Options: rejected alternatives worth remembering
- Consequences: non-obvious downstream impacts

**Criteria for writing an ADR** (all three must apply):
1. Hard to reverse — meaningful cost to change later
2. Surprising without context — future readers will question the approach
3. Result of real trade-offs — genuine alternatives existed

---

## Workflow

1. **Orient** — check for `CONTEXT-MAP.md`, then `CONTEXT.md`, then infer relevant context from topic
2. **Interview** — ask one question at a time; wait for response before continuing
3. **Verify** — search the codebase to ground claims in actual code
4. **Update glossary** — write resolved terms into `CONTEXT.md` immediately
5. **Propose ADR** — only when all three ADR criteria are met; draft and confirm with user before writing
6. **Summarise** — end with a brief recap of what was clarified, any ADRs created, and outstanding open questions
