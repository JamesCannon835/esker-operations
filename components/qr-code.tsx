import QRCode from "qrcode";
import { headers } from "next/headers";

/**
 * Renders a scannable QR code (SVG) that points at /a/<code>, which resolves
 * to this asset's page. `code` is the asset's qr_code column.
 */
export async function AssetQr({ code }: { code: string }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const target = `${proto}://${host}/a/${code}`;

  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="qr-box">
      <div
        aria-label={`QR code linking to ${target}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div>
        <div className="detail-grid">
          <div>
            <div className="label">Scan target</div>
            <div className="value">
              <code>/a/{code}</code>
            </div>
          </div>
        </div>
        <p className="field-hint" style={{ marginTop: 8 }}>
          Print and fix to the asset. Scanning it (signed in) opens the daily
          check for this asset.
        </p>
      </div>
    </div>
  );
}
