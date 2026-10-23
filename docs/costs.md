# Costs and service limits

Status: **Phase 0 estimate.** Prices and limits change; every row must be re-checked on the provider's own pricing page before the account is created and again before launch.
Checked: 2026-10-23. Where only third-party sources were available, the row says so.

Nothing here promises that production will stay free. Commercial hosting has a monthly cost.

## 1. Summary

| When | Services that start costing money | Rough monthly cost (USD) |
|---|---|---|
| Phases 0–1 (build) | None — free tiers and Neon branches | $0 |
| Phase 2 launch (website + leads) | Vercel Pro; Neon production plan | ~$20 + Neon usage (likely low single digits to ~$15 at this size; measure on staging) |
| Phase 3 (bookings, PDFs) | + Render Starter for the PDF service | + $7 |
| Phase 5 (WhatsApp) | + WhatsApp per-message charges (+ provider fee if a BSP is used) | Usage-based |
| Yearly | Domain name; business email if not already paid | Varies by registrar/provider |

Expected steady state after Phase 3: **about $30–45/month** plus WhatsApp usage and the domain. Treat this as an estimate, not a quote.

## 2. Per service

| Service | Purpose | Dev / staging plan | Production plan | Known limits (as checked) | What happens at the limit | Source quality |
|---|---|---|---|---|---|---|
| **Vercel** | Next.js hosting, cron, analytics | Hobby is fine for the developer's own non-commercial experiments only | **Pro, $20/month per seat** | Hobby: personal, non-commercial use only. Vercel's guidelines say all commercial use needs Pro/Enterprise and count paid contractor work as commercial. | Hobby: account can be restricted for commercial use. Pro: usage beyond included amounts is billed. | Official docs |
| **Neon** | PostgreSQL | Free plan (branches for dev/test/preview) | Usage-based paid plan ("Launch") | Free: 100 compute-hours/project/month, scale-to-zero after 5 min, ~0.5–1 GB storage per project (recently raised; sources disagree), 5 GB egress, 6-hour restore window. Launch: billed per compute-hour and GB-month; ~7-day point-in-time restore. | Free: compute is **suspended** until next cycle — unacceptable for production. | Mix of official FAQ and third-party trackers |
| **Render** | PDF service container (Phase 3) | Free web service for experiments | **Starter, $7/month** (512 MB, 0.5 CPU, always on) | Free instances sleep after 15 min idle and take ~1 min to wake. | Free: slow first PDF. Starter: fixed price; upgrade if Chromium needs more memory. | Third-party (several agree) |
| **Cloudinary** | Public images, hero video | Free plan | Free plan to start | 25 credits/month shared: 1 credit = 1 GB storage, or 1 GB bandwidth, or 1,000 transformations. | Uploads/delivery restricted until next cycle or upgrade. **Hero video bandwidth is the main risk** — see §3. | Official docs |
| **Cloudflare R2** | Private documents, backups | Free tier | Free tier, then pay-as-you-go | 10 GB-month storage, 1M Class A (writes) and 10M Class B (reads) ops/month; no egress fees. | Billed beyond free tier (~$0.015/GB-month). | Third-party (consistent) |
| **Resend** | Transactional email | Free | Free to start | 3,000 emails/month, **100/day**; free plan domain limit (1–3; sources disagree). | Sending pauses for the day/month. Pro $20/month removes the daily cap. | Official docs (limits) |
| **WhatsApp Business Platform** | Templates: reminders, payment due, greetings | — | Per-message pricing by Meta (+ BSP fee if used) | India, 2026: marketing ≈ ₹0.78/message; utility and authentication lower (sources disagree: ~₹0.12–0.35). Replies inside the 24-hour customer-service window are free, as are utility templates sent inside it. Meta is moving India billing to INR by 31 Dec 2026. | Messages fail if the account has no balance/payment method. | Meta docs + third-party rate tables |
| **Sentry** | Error tracking | Free (Developer) | Free to start | Monthly error quota on the free plan (verify current number). | Events dropped after quota. | To verify |
| **Uptime monitor** (UptimeRobot / Better Stack) | Homepage + enquiry checks | Free | Free | Free plans allow a few dozen monitors at 3–5 min intervals (verify). | — | To verify |
| **GitHub** | Repo, CI, nightly backup job | Free | Free (private repo) | Actions minutes per month on free private repos (verify). | Jobs queue/fail; backup job is small. | To verify |
| **Domain** | `<domain>` | — | Yearly | — | Site goes down if it lapses — enable auto-renew. | — |
| **Business email** | Sender mailbox for SPF/DKIM | — | Google Workspace / Zoho / existing | — | — | To verify |

## 3. Risks and how we watch them

| Risk | Early warning | Fallback |
|---|---|---|
| Cloudinary credits exhausted by hero video | Weekly usage check in the first month after launch; alert at 70% | Serve the compressed hero MP4/WebM from Vercel static or a public R2 bucket; keep Cloudinary for images. |
| Neon usage grows past expectations | Monthly bill review; Neon usage alerts | Tune scale-to-zero, add indexes, cache public pages (they're mostly static). |
| Resend daily cap (100/day) hit by reminders | Outbox shows `FAILED` with rate-limit reason | Upgrade to Pro, or move bulk/greeting sends to WhatsApp. |
| PDF service out of memory on long documents | Render metrics, Sentry errors from PDF calls | Next Render size up; reuse one browser instance per container. |
| WhatsApp marketing spend | Monthly message count in the CRM's MessageLog report | Send greetings only to opted-in customers; prefer utility templates. |

## 4. Before launch checklist

- [ ] Each account is in the business's name (or ownership transfer is agreed in writing).
- [ ] Vercel plan is Pro; commercial-use terms re-read.
- [ ] Neon production project is on a paid plan; restore window noted; nightly `pg_dump` running; one restore tested.
- [ ] Cloudinary and R2 usage alerts set.
- [ ] Resend domain verified with SPF, DKIM and DMARC.
- [ ] WhatsApp provider chosen; template approval and per-message cost confirmed in INR.
- [ ] Domain auto-renew on.
- [ ] Monthly cost approved by the owner.

## Sources (retrieved 2026-10-23)

- Vercel fair use guidelines: https://vercel.com/docs/limits/fair-use-guidelines
- Neon pricing: https://neon.com/pricing · free-tier FAQ: https://neon.com/faqs/managed-postgres-databases-free-tier · PricingSaaS Neon tracker: https://pricingsaas.com/companies/neon
- Render pricing (third-party summaries): https://temps.sh/blog/render-pricing-2026 · https://livemy.app/blog/render-pricing
- Cloudinary billing and plans: https://cloudinary.com/documentation/billing_and_plans
- Cloudflare R2 pricing (third-party): https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/
- Resend sending limits: https://resend.com/docs/knowledge-base/resend-sending-limits
- Meta WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing · India rate summaries: https://baat.ai/blog/whatsapp-api-pricing-india · https://hyperleap.ai/whatsapp-pricing-calculator-india
- Supabase free-plan pausing (reason it was not chosen): https://supabase.com/docs/guides/platform/free-project-pausing
