// HTML email template for confirmed voucher (Athletic Dark Mode).
// Pure string-based template — no React Email dep, runs in any runtime.

export interface VoucherEmailData {
  voucherCode: string;
  championshipName: string;
  categoryName: string;
  teamName: string | null;
  athlete1Name: string;
  athlete1Shirt: string;
  athlete1Shorts: string;
  athlete2Name: string;
  athlete2Shirt: string;
  athlete2Shorts: string;
  voucherUrl: string;
  successUrl: string;
  amountCents: number;
}


export function buildVoucherEmailSubject(d: VoucherEmailData) {
  return ` Inscrição confirmada — Voucher ${d.voucherCode} (${d.championshipName})`;
}

export function buildVoucherEmailHtml(d: VoucherEmailData) {
  const price = (d.amountCents / 100).toFixed(2).replace(".", ",");
  const team = d.teamName ? `<p style="margin:0 0 8px;font-size:14px;color:#9ca3af">Dupla: <strong style="color:#fff">${escape(d.teamName)}</strong></p>` : "";
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voucher confirmado</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid #262626;border-radius:16px;overflow:hidden">
        <tr><td style="padding:32px 32px 16px;text-align:center;background:linear-gradient(135deg,#1a1a1a,#0a0a0a);border-bottom:2px solid #f97316">
          <p style="margin:0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#f97316;font-weight:700">Open Sync</p>
          <h1 style="margin:8px 0 0;font-size:28px;color:#fff;font-weight:800">🔥 INSCRIÇÃO CONFIRMADA</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#9ca3af">Sua vaga está garantida na arena.</p>
        </td></tr>

        <tr><td style="padding:24px 32px">
          <div style="background:#1a1a1a;border:1px solid #262626;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
            <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af">Voucher</p>
            <p style="margin:8px 0 0;font-size:32px;font-family:'SF Mono',Menlo,monospace;letter-spacing:6px;color:#22c55e;font-weight:800">${escape(d.voucherCode)}</p>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td style="padding:12px 0;border-bottom:1px solid #262626">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Campeonato</p>
              <p style="margin:4px 0 0;font-size:16px;color:#fff;font-weight:600">${escape(d.championshipName)}</p>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #262626">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Categoria</p>
              <p style="margin:4px 0 0;font-size:16px;color:#fff;font-weight:600">${escape(d.categoryName)}</p>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #262626">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Valor pago</p>
              <p style="margin:4px 0 0;font-size:16px;color:#fff;font-weight:600">R$ ${price}</p>
            </td></tr>
          </table>

          <div style="background:#1a1a1a;border:1px solid #262626;border-radius:12px;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f97316;font-weight:700"> Atletas</p>
            ${team}
            <div style="padding:12px 0;border-top:1px solid #262626">
              <p style="margin:0;font-size:15px;color:#fff;font-weight:600">${escape(d.athlete1Name)}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#9ca3af">Camisa: <span style="color:#22c55e;font-weight:600">${escape(d.athlete1Shirt)}</span> · Shorts: <span style="color:#22c55e;font-weight:600">${escape(d.athlete1Shorts)}</span></p>
            </div>
            <div style="padding:12px 0;border-top:1px solid #262626">
              <p style="margin:0;font-size:15px;color:#fff;font-weight:600">${escape(d.athlete2Name)}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#9ca3af">Camisa: <span style="color:#22c55e;font-weight:600">${escape(d.athlete2Shirt)}</span> · Shorts: <span style="color:#22c55e;font-weight:600">${escape(d.athlete2Shorts)}</span></p>
            </div>

          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 12px">
              <a href="${escape(d.voucherUrl)}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 32px;border-radius:12px;letter-spacing:0.5px">🎟️ ACESSAR VOUCHER (QR CODE)</a>
            </td></tr>
            <tr><td align="center" style="padding:0 0 16px">
              <a href="${escape(d.voucherUrl)}?print=1" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;border:1px solid #404040">📄 Baixar voucher (PDF)</a>
            </td></tr>
          </table>


          <div style="background:#0a0a0a;border:1px solid #262626;border-radius:8px;padding:16px;margin-top:16px">
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
              <strong style="color:#fff">📋 No dia do evento:</strong><br>
              Apresente o QR Code do seu voucher na entrada para fazer o check-in. Leve um documento com foto.
            </p>
          </div>
        </td></tr>

        <tr><td style="padding:24px 32px;background:#0a0a0a;text-align:center;border-top:1px solid #262626">
          <p style="margin:0;font-size:12px;color:#6b7280">Bora pra arena! 🔥<br><strong style="color:#f97316">Equipe Open Sync</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
