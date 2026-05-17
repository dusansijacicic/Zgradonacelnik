import { Resend } from "resend";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Baza za slanje emailova. Ako je TEST_EMAIL postavljen, svi mejlovi idu na tu adresu
 * umesto na pravog primaoca (korisno za testiranje bez spam-ovanja korisnika).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY / RESEND_FROM_EMAIL nije postavljen — mejl preskočen.");
    return;
  }

  const testEmail = process.env.TEST_EMAIL;
  const actualTo = testEmail ?? params.to;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: actualTo,
    subject: testEmail
      ? `[TEST → ${params.to}] ${params.subject}`
      : params.subject,
    html: testEmail
      ? `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px;">
           🧪 <strong>TEST MOD</strong> — originalno za: <code>${params.to}</code>
         </p>${params.html}`
      : params.html,
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
  });
}

// ─────────────────────────────────────────────────────────────
// Specifični template-i za notifikacije
// ─────────────────────────────────────────────────────────────

export async function sendReviewNotification(params: {
  managerEmail: string;
  managerName: string;
  reviewerName: string;
  ratingOverall: number;
  buildingAddress: string;
  reviewUrl: string;
}) {
  await sendEmail({
    to: params.managerEmail,
    subject: `Nova recenzija — ${params.ratingOverall}/5 ★`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
        <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Nova recenzija za Vas</h2>
        <p style="color:#52525b;font-size:14px">
          <strong>${params.reviewerName}</strong> je ostavio/la recenziju za zgradu
          <strong>${params.buildingAddress}</strong>.
        </p>
        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin:20px 0;font-size:14px">
          <div>Ocena: <strong>${params.ratingOverall}/5 ★</strong></div>
        </div>
        <a href="${params.reviewUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
          Pogledaj recenziju →
        </a>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e4e4e7"/>
        <p style="font-size:12px;color:#a1a1aa">
          Zgradonačelnik.rs · <a href="${siteUrl}/uslovi" style="color:#a1a1aa">Uslovi korišćenja</a>
        </p>
      </div>
    `,
  });
}

export async function sendPremiumRequestNotification(params: {
  adminEmail: string;
  buildingAddress: string;
  managerName: string;
  paymentReference: string;
  adminUrl: string;
}) {
  await sendEmail({
    to: params.adminEmail,
    subject: `Zahtev za Premium — ${params.buildingAddress}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
        <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Novi zahtev za Premium pretplatu</h2>
        <p style="color:#52525b;font-size:14px">
          Upravnik <strong>${params.managerName}</strong> zatražio/la je Premium za zgradu
          <strong>${params.buildingAddress}</strong>.
        </p>
        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin:20px 0;font-size:14px">
          <div>Referentni broj: <strong style="font-family:monospace">${params.paymentReference}</strong></div>
          <div style="margin-top:4px">Iznos: <strong>500 RSD</strong></div>
        </div>
        <a href="${params.adminUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
          Aktiviraj u Admin panelu →
        </a>
      </div>
    `,
  });
}

export async function sendPremiumActivatedNotification(params: {
  managerEmail: string;
  managerName: string;
  buildingAddress: string;
  periodEnd: string;
  buildingUrl: string;
}) {
  await sendEmail({
    to: params.managerEmail,
    subject: `Premium aktiviran — ${params.buildingAddress}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
        <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">★ Premium je aktiviran!</h2>
        <p style="color:#52525b;font-size:14px">
          Premium pretplata za zgradu <strong>${params.buildingAddress}</strong> je aktivirana.
        </p>
        <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:16px;margin:20px 0;font-size:14px">
          Aktivan do: <strong>${params.periodEnd}</strong>
        </div>
        <a href="${params.buildingUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
          Otvori zgradu →
        </a>
      </div>
    `,
  });
}

export async function sendMembershipRequestNotification(params: {
  adminEmail: string;
  userName: string;
  buildingAddress: string;
  role: string;
  adminUrl: string;
}) {
  await sendEmail({
    to: params.adminEmail,
    subject: `Zahtev za članstvo — ${params.buildingAddress}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
        <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Novi zahtev za članstvo u zgradi</h2>
        <p style="color:#52525b;font-size:14px">
          <strong>${params.userName}</strong> je zatražio/la pristup zgradi
          <strong>${params.buildingAddress}</strong> kao <em>${params.role}</em>.
        </p>
        <a href="${params.adminUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
          Pregledaj u Admin panelu →
        </a>
      </div>
    `,
  });
}

export async function sendNewMinutesNotification(params: {
  residentEmails: string[];
  buildingAddress: string;
  minutesTitle: string;
  heldAt: string;
  minutesUrl: string;
}) {
  for (const email of params.residentEmails) {
    await sendEmail({
      to: email,
      subject: `Novi zapisnik — ${params.buildingAddress}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
          <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Novi zapisnik sa sastanka</h2>
          <p style="color:#52525b;font-size:14px">
            Objavljen je novi zapisnik za zgradu <strong>${params.buildingAddress}</strong>.
          </p>
          <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin:20px 0;font-size:14px">
            <div><strong>${params.minutesTitle}</strong></div>
            <div style="margin-top:4px;color:#71717a">Održan: ${params.heldAt}</div>
          </div>
          <a href="${params.minutesUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
            Pročitaj zapisnik →
          </a>
        </div>
      `,
    });
  }
}
