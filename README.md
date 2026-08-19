# Guardrail Scanner

Built for Tai Labs' final assessment — a prototype tool that scans AI workflow configs for risk before they're approved.

**Live demo:** https://guardrail-ruby-one.vercel.app/

## What it does

Tai Labs helps clients get employees building real AI workflows and getting them manager-approved based on hours saved. This tool adds a missing step: before a workflow gets approved, it's scanned for what data it touches, what tools it calls, and whether it breaks policy — a risk score sits right next to the ROI number leadership already sees.

Paste or upload a workflow config (JSON) describing an AI workflow's data sources, tools, prompt, and output destination, and the scanner checks it against:

1. **Prompt PII** — email, SSN, and credential-like patterns in the prompt template
2. **Sensitive data sources** — customer, employee, billing, and health data sources
3. **Tool blocklist** — irreversible actions, shell access, and external exports
4. **Output destination** — public or unrestricted Slack channels and webhooks

For prompts that don't clearly trigger a rule-based flag but use ambiguous data-handling language, an AI-assisted check (via the Vercel AI SDK) classifies the risk level and explains why — so the tool only pays for a model call on genuinely ambiguous cases, not every scan.

Three seeded example configs are included to demonstrate the checks:
- A clean workflow (passes all checks)
- An HR workflow with PII in the prompt and a sensitive data source
- An external data export calling a blocked tool

## Why this approach

Most risk is catchable with fast, free, deterministic pattern-matching — similar to how tools like Lynis audit server configs against known-bad patterns. The AI model only gets called for the genuinely ambiguous cases regex can't resolve, which keeps the tool cheap and reliable at scale (it never fully breaks if the model call fails — it just flags "needs manual review").

## What's cut / what's next

This prototype is stateless (no scan history, no persistence) and takes workflow configs as manual JSON input rather than pulling from a real workflow builder. Next steps would be integrating directly with wherever employees actually build workflows, and adding a manager-facing dashboard that aggregates risk scores across a team.

## Stack

Next.js (App Router), TypeScript, Vercel AI SDK, deployed on Vercel.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
