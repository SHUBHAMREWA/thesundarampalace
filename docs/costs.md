# Costs and service limits

Status: **Free-tier plan (owner decision, 2026-10-23).** Nothing is bought now. The domain is already purchased at Hostinger.
Checked: 2026-10-23. Limits change; re-check each provider's pricing page when the account is created and again before launch. Where only third-party sources were available, the row says so.

Free tiers have hard limits. This document lists them, how the app stays inside them, and what to watch so nothing breaks by surprise.

## 1. Summary

| When | What it costs |
|---|---|
| Phases 0–2 (build + website launch) | **$0/month.** Domain renewal at Hostinger once a year (already bought). |
| Phase 3 (bookings, PDFs, documents) | **$0/month.** Private files live in PostgreSQL (ADR-07); PDFs come from `pdf-service/` on Render's free plan (ADR-08). |
| Phase 5 (WhatsApp) | **$0** with `wa.me` click-to-chat links. Automated WhatsApp messages are charged per message by Meta and stay off unless the business decides to pay. |

## 2. Per service

| Service | Purpose | Plan | Free limits (as checked) | What happens at the limit | How we stay inside | Source quality |
|---|---|---|---|---|---|---|
| **Vercel** | Next.js hosting | **Hobby (free)** | ~100 GB/month data transfer, ~100 GB-hours function execution; cron once per day; personal account, no team seats. **Personal, non-commercial use only** under Vercel's fair-use guidelines. | Usage beyond limits can pause deployments; for commercial use Vercel may restrict the project. | Static public pages; hero film ~3 MB; scheduler on GitHub Actions; no Vercel-only features so the app can move hosts. | Official docs (terms); limits partly from truncated official pages |
| **Neon** | PostgreSQL | **Free** (2 projects: prod, dev) | 100 compute-hours per project per month, scale-to-zero after 5 min, ~0.5–1 GB storage per project, 5 GB egress, 6-hour restore window. | **Database compute is suspended until the next monthly cycle** — enquiries and CRM stop working. | Static public pages don't touch the DB; dev/test in a separate project; monthly usage check; enquiry fallback shows phone/WhatsApp. | Official FAQ + third-party trackers |
| **Cloudinary** | Public images | **Free** | 25 credits/month shared: 1 credit ≈ 1 GB storage, or 1 GB bandwidth, or 1,000 transformations. | Uploads/delivery restricted until the next cycle. | Hero video served from Vercel instead; responsive AVIF/WebP; limited transformation presets. | Official docs |
| **Resend** | Transactional email | **Free** | 3,000 emails/month, **100/day**. | Sending pauses for the day/month. | Staff alerts + digests only; no bulk marketing email. | Official docs |
| **GitHub** | Repo, CI, scheduler, backups | **Free** (private repo) | Actions minutes and artifact storage quota for private repos (~2,000 min/month; verify). | Jobs stop until the next month. | Hourly scheduler ~720 min; CI kept lean; backups small. | To verify |
| **Sentry** | Error tracking | **Free** | Monthly error quota (verify). | Extra events dropped. | PII scrubbing, sampling. | To verify |
| **UptimeRobot** | Uptime alerts | **Free** | A few dozen monitors at 5-min intervals (verify). | — | 2 monitors. | To verify |
| **Render** (Phase 3) | PDF renderer (`pdf-service/`) | **Free web service** | Sleeps after 15 min idle (~1 min to wake); 750 instance-hours/month per workspace. | Slow first PDF after idle. | Wake it when the PDF dialog opens. | Third-party (several agree) |
| **Cloudflare R2** (not used yet) | Private documents if the database fills up | Free tier | 10 GB storage, no egress fee. **Card required to enable.** | Billed beyond free tier. | Move only when Neon storage passes ~70% (see §3). | Third-party (consistent) |
| **WhatsApp** | Customer chat | `wa.me` links (free) | — | — | No API messages unless the business decides to pay per message (India 2026: marketing ≈ ₹0.78/message; utility lower). | Meta docs + third-party rate tables |
| **Hostinger** | Domain + DNS | Already purchased | — | Site and email stop if the domain lapses. | Turn on auto-renew. | — |

## 3. Monthly free-tier check (5 minutes, first working day of the month)

| Check | Where | Act when |
|---|---|---|
| Neon compute-hours and storage (prod project) | Neon console → Usage | > 70% of the monthly allowance. Private documents and financial PDFs live in the database (~50–200 KB per PDF, up to 4 MB per ID copy): if storage grows past 70%, move `private_blob` to Cloudflare R2 (only `src/server/storage/private.ts` changes). |
| Cloudinary credits | Cloudinary console → Usage | > 70% |
| Vercel transfer and function usage | Vercel dashboard → Usage | > 70% |
| Resend sends | Resend dashboard | Any day near 100 |
| GitHub Actions minutes | GitHub → Settings → Billing | > 70% |
| Backups present and one month's copy downloaded | GitHub Actions artifacts | Missing artifact |

## 4. Upgrade triggers (to discuss, not automatic)

Free tiers are fine for building and launching. These are the signals that a small paid plan would be worth discussing with the business; nothing is bought without the owner's approval.

| Signal | Likely option |
|---|---|
| Vercel flags or restricts the project for commercial use | Vercel Pro (~$20/month) or move to a host whose free plan allows commercial use (verify terms first) |
| Neon compute or storage above 70% two months in a row, or the business wants a longer restore window than 6 hours for financial records | Neon paid usage plan |
| Cloudinary credits above 70% | Trim image sizes / presets first; then a paid tier |
| More than 100 emails on some days | Resend Pro, or move greetings to another channel |
| Staff find the PDF cold start too slow | Render Starter ($7/month) |
| Business wants automated WhatsApp reminders | Meta per-message charges (+ provider fee if using a BSP) |

## Sources (retrieved 2026-10-23)

- Vercel fair use guidelines: https://vercel.com/docs/limits/fair-use-guidelines · limits: https://vercel.com/docs/limits
- Neon pricing: https://neon.com/pricing · free-tier FAQ: https://neon.com/faqs/managed-postgres-databases-free-tier
- Cloudinary billing and plans: https://cloudinary.com/documentation/billing_and_plans
- Resend sending limits: https://resend.com/docs/knowledge-base/resend-sending-limits
- Render free tier (third-party summaries): https://temps.sh/blog/render-pricing-2026 · https://livemy.app/blog/render-pricing
- Cloudflare R2 free tier and card requirement (third-party): https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/ · https://eastondev.com/blog/en/posts/dev/20251130-r2-picgo-setup/
- Meta WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing · India rate summary: https://baat.ai/blog/whatsapp-api-pricing-india
- Netlify free plan and commercial use (third-party, unverified): https://agentdeals.dev/vercel-vs-netlify
