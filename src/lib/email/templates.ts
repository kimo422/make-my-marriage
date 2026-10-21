import type { EmailMessage } from "@/lib/email/send";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Plain, client-safe HTML in the app's palette: ivory card, emerald button. */
function layout(body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fbf8f3;font-family:Arial,Helvetica,sans-serif;color:#1f1b24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e3dccf;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:20px">Make My Marriage</p>
${body}
</td></tr></table></td></tr></table></body></html>`;
}

export function passwordResetEmail({
  name,
  url,
}: {
  name: string;
  url: string;
}): Omit<EmailMessage, "to"> {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "Reset your Make My Marriage password",
    text: `${greeting}

Someone asked to reset the password for your Make My Marriage account. Open this link to choose a new one:

${url}

The link works for 1 hour. If you didn't ask for this, you can ignore this email; your password won't change.`,
    html: layout(`<p style="margin:0 0 16px;font-size:16px;line-height:24px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:24px">Someone asked to reset the password for your Make My Marriage account. Choose a new one with the button below.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f4c45;color:#fbf8f3;text-decoration:none;padding:12px 28px;border-radius:9999px;font-size:16px">Choose a new password</a></p>
<p style="margin:0;font-size:14px;line-height:22px;color:#5b5560">The link works for 1 hour. If you didn't ask for this, you can ignore this email; your password won't change.</p>`),
  };
}
