import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  generateBrochureHtml,
  recordBrochureDownloadLead,
} from "@/server/services/brochure";
import {
  bookSiteVisit,
} from "@/server/services/site-visit";
import {
  WhatsAppTemplates,
  buildWhatsAppChatUrl,
} from "@/lib/contact/whatsapp";
import {
  saveRealWedding,
  listPublicRealWeddings,
  getPublicRealWedding,
} from "@/server/services/real-weddings";
import { type Actor } from "@/server/policies/authorize";
import type { PermissionKey } from "@/lib/permissions/registry";

const actor = (permissions: PermissionKey[], id = "phase5-actor"): Actor => ({
  id,
  permissions: new Set(permissions),
});

describe("Phase 5 (Growth and Engagement) Integration Tests", () => {
  const adminActor = actor(["cms.edit", "cms.publish", "leads.read", "leads.read_all", "leads.edit"]);

  describe("2. Site-Visit Booking & Lead Capture", () => {
    it("schedules a site-visit, creates or updates lead with DPDP consent and logs activity", async () => {
      const uniquePhone = "+9198765" + Math.floor(10000 + Math.random() * 90000);
      const visitInput = {
        fullName: "Vikram Rathore",
        phone: uniquePhone,
        email: "vikram.rathore@example.com",
        visitDate: "2027-03-20",
        timeSlot: "morning" as const,
        notes: "Interested in the Grand Ballroom for 500 guests",
        consent: true as const,
      };

      const result = await bookSiteVisit(visitInput);

      expect(result).toBeDefined();
      expect(result.leadId).toBeDefined();
      expect(result.reference).toMatch(/^SP-L-/);

      // Verify lead in database
      const lead = await db.lead.findUnique({
        where: { id: result.leadId },
        include: { activities: true },
      });

      expect(lead).not.toBeNull();
      expect(lead?.fullName).toBe("Vikram Rathore");
      expect(lead?.phone).toBe(uniquePhone);
      expect(lead?.sourceKey).toBe("site_visit_form");
      expect(lead?.siteVisitAt).not.toBeNull();
      expect(lead?.activities.length).toBeGreaterThanOrEqual(1);

      // Verify DPDP consent record was created
      const consent = await db.consentRecord.findFirst({
        where: { subjectId: result.leadId, purpose: "site_visit" },
      });
      expect(consent).not.toBeNull();
      expect(consent?.granted).toBe(true);
      expect(consent?.source).toBe("web_form");

      // Verify conversion event was logged
      const conversion = await db.conversionEvent.findFirst({
        where: { type: "site_visit_booked" },
        orderBy: { createdAt: "desc" },
      });
      expect(conversion).not.toBeNull();
    });
  });

  describe("3. E-Brochure Generation & Gated Lead Capture", () => {
    it("generates luxury HTML brochure in English and Hindi", async () => {
      const enHtml = await generateBrochureHtml("en");
      expect(enHtml).toContain("The Sundaram Palace");
      expect(enHtml).toContain("Our Venue Spaces");
      expect(enHtml).toContain("Culinary Excellence");

      const hiHtml = await generateBrochureHtml("hi");
      expect(hiHtml).toContain("द सुंदरम पैलेस");
      expect(hiHtml).toContain("भव्य स्थल एवं हॉल");
      expect(hiHtml).toContain("शाही खानपान");
    });

    it("captures brochure lead with DPDP consent and conversion event", async () => {
      const uniquePhone = "+9198765" + Math.floor(10000 + Math.random() * 90000);
      const leadInput = {
        fullName: "Ananya Deshmukh",
        phone: uniquePhone,
        email: "ananya.d@example.com",
        consent: true as const,
      };

      const result = await recordBrochureDownloadLead(leadInput);
      expect(result.leadId).toBeDefined();
      expect(result.reference).toMatch(/^SP-L-/);

      // Verify DPDP consent
      const consent = await db.consentRecord.findFirst({
        where: { subjectId: result.leadId, purpose: "brochure" },
      });
      expect(consent).not.toBeNull();
      expect(consent?.granted).toBe(true);

      // Verify conversion event
      const conversion = await db.conversionEvent.findFirst({
        where: { type: "brochure_download" },
        orderBy: { createdAt: "desc" },
      });
      expect(conversion).not.toBeNull();
    });
  });

  describe("4. WhatsApp Message Templates", () => {
    it("builds compliant, branded message text and deep-link click URLs", () => {
      const quoteMsg = WhatsAppTemplates.quotationSent({
        customerName: "Sharma Family",
        bookingRef: "SP-B-2026-0001",
        validUntil: "30 Nov 2026",
      });

      expect(quoteMsg).toContain("Sharma Family");
      expect(quoteMsg).toContain("SP-B-2026-0001");
      expect(quoteMsg).toContain("30 Nov 2026");
      expect(quoteMsg).toContain("The Sundaram Palace");

      const paymentMsg = WhatsAppTemplates.paymentReceived({
        customerName: "Pooja Verma",
        bookingRef: "SP-B-2026-0012",
        amountINR: "1,50,000",
        receiptNumber: "REC-2026-0042",
      });

      expect(paymentMsg).toContain("Pooja Verma");
      expect(paymentMsg).toContain("1,50,000");
      expect(paymentMsg).toContain("REC-2026-0042");

      const link = buildWhatsAppChatUrl("+919876543210", "quotationSent", {
        customerName: "Sharma Family",
        bookingRef: "SP-B-2026-0001",
        validUntil: "30 Nov 2026",
      });
      expect(link).toContain("https://wa.me/919876543210?text=");
      expect(link).toContain(encodeURIComponent("The Sundaram Palace"));
    });
  });

  describe("5. Real Wedding Stories with Double-Consent Enforcement", () => {
    it("strictly requires BOTH couple and photographer consent before publishing", async () => {
      const slug = `royal-wedding-${Date.now()}`;

      // 1. Attempt to publish with couple consent only -> MUST remain unpublished
      const partialConsentStory = await saveRealWedding(adminActor, null, {
        slug,
        coupleName: { en: "Aarav & Meera", hi: "आरव एवं मीरा" },
        coupleConsent: true,
        photographerConsent: false, // Photographer consent NOT given
        published: true, // Caller requested publish
        eventTypeKey: "wedding",
        galleryImageUrls: [],
        sortOrder: 0,
      });

      expect(partialConsentStory.published).toBe(false);
      expect(partialConsentStory.coupleConsent).toBe(true);
      expect(partialConsentStory.photographerConsent).toBe(false);

      // Verify it cannot be retrieved via public queries
      const publicList1 = await listPublicRealWeddings();
      expect(publicList1.some((s) => s.slug === slug)).toBe(false);

      const publicSingle1 = await getPublicRealWedding(slug);
      expect(publicSingle1).toBeNull();

      // 2. Grant photographer consent -> story can now be published
      const fullConsentStory = await saveRealWedding(
        adminActor,
        partialConsentStory.id,
        {
          slug,
          coupleName: { en: "Aarav & Meera", hi: "आरव एवं मीरा" },
          coupleConsent: true,
          photographerConsent: true, // Both consents now present!
          published: true,
          eventTypeKey: "wedding",
          galleryImageUrls: [],
          sortOrder: 0,
        },
      );

      expect(fullConsentStory.published).toBe(true);
      expect(fullConsentStory.consentDate).not.toBeNull();

      // Verify it is now visible publicly
      const publicList2 = await listPublicRealWeddings();
      expect(publicList2.some((s) => s.slug === slug)).toBe(true);

      const publicSingle2 = await getPublicRealWedding(slug);
      expect(publicSingle2).not.toBeNull();
      expect(publicSingle2?.slug).toBe(slug);

      // 3. If consent is revoked, story must immediately be un-published
      const revokedStory = await saveRealWedding(
        adminActor,
        fullConsentStory.id,
        {
          slug,
          coupleName: { en: "Aarav & Meera", hi: "आरव एवं मीरा" },
          coupleConsent: false, // Revoked
          photographerConsent: true,
          published: true,
          eventTypeKey: "wedding",
          galleryImageUrls: [],
          sortOrder: 0,
        },
      );

      expect(revokedStory.published).toBe(false);
      const publicSingle3 = await getPublicRealWedding(slug);
      expect(publicSingle3).toBeNull();
    });
  });
});
