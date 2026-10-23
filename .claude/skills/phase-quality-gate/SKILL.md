---
name: phase-quality-gate
description: Use at the end of every development phase, before saying a feature or phase is done, before a deployment, or when the user asks for a progress report on The Sundaram Palace project.
---

# Phase quality gate and report

Never say "done" until every applicable check below has actually been run in this session and passed, or the failure is reported honestly.

## 1. Run the checks
```bash
npm run typecheck
npm run lint
npm run test          # unit + integration
npm run build
npm run test:e2e      # relevant Playwright specs
npx prisma migrate status
```
Fix failures and re-run. If something cannot be run (missing credentials, external service), say so explicitly.

## 2. Review checklist
- [ ] No hex colors outside `globals.css`; UI checked at 360 / 768 / 1280 px.
- [ ] No invented business facts; new gaps added to `docs/missing-business-info.md`.
- [ ] Every new protected action checks permissions server-side and has a test.
- [ ] Money uses Decimal; no financial history edited or deleted.
- [ ] No secrets, `.env`, real customer data or private files in the diff (`git diff --stat`, scan for keys).
- [ ] Migrations reviewed; destructive changes approved by the user.
- [ ] No dead buttons or controls without behaviour.
- [ ] Loading, empty and error states exist for new pages.
- [ ] Docs updated (`architecture`, `database-design`, `design-system`, `deployment`, `costs` as relevant).
- [ ] Room booking not introduced anywhere.

## 3. Report to the user (use this format)
```
## Phase <n> report — <name>

**Implemented**
- …

**Files changed** (grouped)
- …

**Works and verified**
- … (with the test or manual check that proves it)

**Tests run**
| Check | Result |
|---|---|
| typecheck | pass/fail |
| lint | … |
| unit/integration | X passed, Y failed |
| build | … |
| e2e | … |

**Not done / incomplete**
- …

**Known issues**
- …

**Needs from you** (content, credentials, decisions, approvals)
- …

**Next phase plan**
- …
```

## 4. Commit
Small, descriptive commits; never commit with failing checks unless the user explicitly approves and the report says so.
