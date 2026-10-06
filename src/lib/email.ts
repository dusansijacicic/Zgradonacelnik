import { Resend } from "resend";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Escape korisničkog teksta u HTML mejlovima (imena, adrese, naslovi). */
export function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailParams = { to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string> };

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY / RESEND_FROM_EMAIL nije postavljen — mejl preskočen.");
    return null;
  }
  return { resend: new Resend(apiKey), from };
}

/** TEST_EMAIL: svi mejlovi idu na tu adresu (testiranje bez slanja pravim korisnicima). */
function applyTestMode(p: EmailParams): EmailParams {
  const testEmail = process.env.TEST_EMAIL;
  if (!testEmail) return p;
  return {
    ...p,
    to: testEmail,
    subject: `[TEST → ${p.to}] ${p.subject}`,
    html: `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px;">
      🧪 <strong>TEST MOD</strong> — originalno za: <code>${esc(p.to)}</code></p>${p.html}`,
  };
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const p = applyTestMode(params);
  const { error } = await client.resend.emails.send({
    from: client.from,
    to: p.to,
    subject: p.subject,
    html: p.html,
    ...(p.replyTo ? { replyTo: p.replyTo } : {}),
    ...(p.headers ? { headers: p.headers } : {}),
  });
  if (error) {
    console.error("[email]", error.message);
    return false;
  }
  return true;
}

/** Do 100 mejlova u jednom pozivu (Resend batch). Vraća broj uspešno predatih. */
export async function sendEmailBatch(list: EmailParams[]): Promise<number> {
  const client = getClient();
  if (!client || !list.length) return 0;
  let sent = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100).map(applyTestMode);
    const { error } = await client.resend.batch.send(
      chunk.map((p) => ({
        from: client.from,
        to: p.to,
        subject: p.subject,
        html: p.html,
        ...(p.replyTo ? { replyTo: p.replyTo } : {}),
        ...(p.headers ? { headers: p.headers } : {}),
      })),
    );
    if (error) {
      console.error("[email batch]", error.message);
      break;
    }
    sent += chunk.length;
  }
  return sent;
}

const layout = (inner: string) => `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b;line-height:1.5">
    ${inner}
    <hr style="margin:32px 0;border:none;border-top:1px solid #e4e4e7"/>
    <p style="font-size:12px;color:#a1a1aa">Zgradonačelnik.rs · <a href="${siteUrl()}/uslovi" style="color:#a1a1aa">Uslovi korišćenja</a></p>
  </div>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0f2744;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">${esc(label)}</a>`;

export async function sendReviewNotification(params: {
  managerEmail: string;
  reviewerName: string;
  ratingOverall: number;
  buildingAddress: string;
  reviewUrl: string;
}) {
  return sendEmail({
    to: params.managerEmail,
    subject: `Nova recenzija — ${params.ratingOverall}/5 ★`,
    html: layout(`
      <h2 style="font-size:20px">Nova recenzija za Vas</h2>
      <p style="color:#52525b;font-size:14px"><strong>${esc(params.reviewerName)}</strong> je ostavio/la recenziju${
        params.buildingAddress ? ` za zgradu <strong>${esc(params.buildingAddress)}</strong>` : ""
      }. Recenzija se objavljuje posle moderacije; možete javno odgovoriti.</p>
      <p>Ocena: <strong>${params.ratingOverall}/5 ★</strong></p>
      ${button(params.reviewUrl, "Pogledaj i odgovori →")}`),
  });
}

export async function sendPremiumActivatedNotification(params: {
  managerEmail: string;
  managerName: string;
  buildingAddress: string;
  periodEnd: string;
  buildingUrl: string;
}) {
  return sendEmail({
    to: params.managerEmail,
    subject: "Premium je aktiviran ⭐",
    html: layout(`
      <h2 style="font-size:20px">Uplata je proknjižena — Premium je aktivan</h2>
      <p style="color:#52525b;font-size:14px">Zgrade: <strong>${esc(params.buildingAddress)}</strong></p>
      <p>Aktivno do: <strong>${esc(params.periodEnd)}</strong></p>
      ${button(params.buildingUrl, "Otvori →")}`),
  });
}

export async function sendMembershipRequestNotification(params: {
  adminEmail: string;
  userName: string;
  buildingAddress: string;
  role: string;
  adminUrl: string;
}) {
  return sendEmail({
    to: params.adminEmail,
    subject: `Dokaz stanovanja — ${params.buildingAddress}`,
    html: layout(`
      <p><strong>${esc(params.userName)}</strong> je poslao/la dokaz za zgradu <strong>${esc(params.buildingAddress)}</strong> (${esc(params.role)}).</p>
      ${button(params.adminUrl, "Pregledaj →")}`),
  });
}

export async function sendNewMinutesNotification(params: {
  residentEmails: string[];
  buildingAddress: string;
  minutesTitle: string;
  heldAt: string;
  minutesUrl: string;
}) {
  return sendEmailBatch(
    params.residentEmails.map((to) => ({
      to,
      subject: `Novi zapisnik — ${params.buildingAddress}`,
      html: layout(`
        <h2 style="font-size:20px">Novi zapisnik sa sastanka</h2>
        <p>Zgrada <strong>${esc(params.buildingAddress)}</strong>: <strong>${esc(params.minutesTitle)}</strong> (održan ${esc(params.heldAt)}).</p>
        ${button(params.minutesUrl, "Pročitaj zapisnik →")}`),
    })),
  );
}

export function managerInviteEmail(params: {
  to: string;
  fullName: string;
  loginUrl: string;
  profileUrl: string;
  unsubscribeUrl: string;
}): EmailParams {
  return {
    to: params.to,
    subject: "Vaš profil upravnika na Zgradonačelnik.rs",
    headers: { "List-Unsubscribe": `<${params.unsubscribeUrl}>` },
    html: layout(`
      <p>Poštovani/a ${esc(params.fullName)},</p>
      <p>Zgradonačelnik.rs je platforma na kojoj stanari pronalaze upravnika svoje zgrade, prate finansije i ostavljaju
      ocene. Vaš profil postoji na osnovu javnog <strong>registra profesionalnih upravnika PKS</strong>.</p>
      <p>Besplatno možete da:</p>
      <ul style="font-size:14px;color:#3f3f46">
        <li>preuzmete svoj profil i odgovarate na recenzije,</li>
        <li>dodate zgrade kojima upravljate,</li>
        <li>pošaljete ponudu zgradama koje traže upravnika.</li>
      </ul>
      <p>Prijavite se <strong>ovom email adresom</strong> — potvrda da ste upravnik iz registra je automatska.</p>
      <p>${button(params.loginUrl, "Preuzmi profil →")}</p>
      <p style="font-size:13px;color:#71717a">Javni profil: <a href="${params.profileUrl}">${params.profileUrl}</a></p>
      <p style="font-size:12px;color:#a1a1aa">Ovu poruku dobijate jer je Vaša adresa upisana u javni registar upravnika.
      <a href="${params.unsubscribeUrl}" style="color:#a1a1aa">Ne želim više poruke</a>.</p>`),
  };
}
