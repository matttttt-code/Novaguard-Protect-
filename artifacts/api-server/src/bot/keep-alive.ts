import { logger } from "../lib/logger.js";

const PING_INTERVAL_MS = 4 * 60 * 1000;

export function startKeepAlive(): void {
  const domains = process.env["REPLIT_DOMAINS"];
  if (!domains) {
    logger.info("REPLIT_DOMAINS non défini — keep-alive désactivé (mode local)");
    return;
  }

  const domain = domains.split(",")[0]?.trim();
  if (!domain) return;

  const url = `https://${domain}/api/healthz`;

  const ping = async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      logger.debug({ status: res.status, url }, "Keep-alive ping OK");
    } catch (err) {
      logger.warn({ err, url }, "Keep-alive ping échoué");
    }
  };

  setInterval(() => void ping(), PING_INTERVAL_MS);
  logger.info({ url, intervalMin: PING_INTERVAL_MS / 60_000 }, "Keep-alive activé");
}
