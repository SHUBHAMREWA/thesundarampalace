# Sundaram Palace — Claude Code starter kit

## What's inside
```
MASTER_PROMPT.md        Full v2 requirements (paste or point Claude Code to it)
CLAUDE.md               Standing project rules Claude Code reads automatically
.claude/skills/         8 project skills Claude Code loads when relevant
  sundaram-design-system/   Rose Mahal colors, fonts, UI rules
  luxury-venue-content/     Website pages, CMS, truthful content, SEO
  banquet-business-rules/   Halls, slots, holds, conflicts, menus, plates
  india-billing-gst/        GST invoices, payments, deposits, refunds
  pdf-documents/            PDF templates, field picker, print rules
  secure-customer-data/     Permissions, uploads, DPDP consent, WhatsApp
  db-change-safety/         Prisma schema and migration safety
  phase-quality-gate/       Checks + report format at the end of each phase
```

## How to use
1. Create an empty project folder (e.g. `sundaram-palace`) and run `git init`.
2. Copy everything from this kit into that folder, keeping the `.claude` folder (it's hidden on Mac/Linux — use `ls -a` to see it).
3. Open the folder in Claude Code and run `/skills` — you should see the 8 skills listed.
4. Start with this message:

   > Read MASTER_PROMPT.md and CLAUDE.md. Do Phase 0 only: inspect the repo, create the docs listed in Phase 0 and `docs/missing-business-info.md`, and propose the implementation plan. Stop and show me the plan before writing app code.

5. After approving the plan, go one phase at a time:

   > Start Phase 1. Load the relevant skills. Finish with the phase-quality-gate report.

## Optional official skills (from Anthropic's public skills repo)
- `frontend-design` — stronger visual design for the luxury website.
- `webapp-testing` — Playwright-based checks of the running app.
- `skill-creator` — to improve or add your own skills later.

Install with the skills CLI, for example:
```bash
npx skills add anthropics/skills@frontend-design
npx skills add anthropics/skills@webapp-testing
```
(or copy the skill folders from github.com/anthropics/skills into `.claude/skills/`).

## Before launch, check yourself
- Hosting plan allows commercial use.
- Database is non-expiring with daily backups.
- GST settings confirmed by your accountant.
- Privacy policy and consent text reviewed by a professional.
