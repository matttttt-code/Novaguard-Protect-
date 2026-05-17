import { Router } from "express";
import { getClient } from "../bot/client-store.js";
import { isOwner } from "../bot/owner-store.js";
import { signToken } from "../lib/jwt-auth.js";

const router = Router();

const CLIENT_ID = process.env["CLIENT_ID"] ?? "";
const CLIENT_SECRET = process.env["CLIENT_SECRET"] ?? "";
const DASHBOARD_BASE = "/dashboard/";

function getRedirectUri(req: import("express").Request): string {
  const domains = process.env["REPLIT_DOMAINS"] ?? "";
  const primary = domains.split(",")[0]?.trim();
  if (primary) return `https://${primary}/api/auth/callback`;
  // Fallback: derive from request origin
  const host = req.headers["host"] ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}/api/auth/callback`;
}

const SCOPES = "identify guilds";
const ADMIN_PERMISSION = BigInt(0x8);

// ── GET /api/auth/login ───────────────────────────────────────────────────────
router.get("/auth/login", (req, res) => {
  if (!CLIENT_ID) {
    res.status(500).send("CLIENT_ID non configuré.");
    return;
  }
  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// ── GET /api/auth/callback ────────────────────────────────────────────────────
router.get("/auth/callback", async (req, res) => {
  const code = req.query["code"] as string | undefined;
  if (!code) {
    res.redirect(`${DASHBOARD_BASE}?error=no_code`);
    return;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).send("CLIENT_ID / CLIENT_SECRET non configurés.");
    return;
  }

  const redirectUri = getRedirectUri(req);

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      res.redirect(`${DASHBOARD_BASE}?error=token_exchange`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; token_type: string };
    const accessToken = tokenData.access_token;

    // Fetch user info and guilds in parallel
    const [userRes, guildsRes] = await Promise.all([
      fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (!userRes.ok || !guildsRes.ok) {
      res.redirect(`${DASHBOARD_BASE}?error=discord_api`);
      return;
    }

    const user = await userRes.json() as {
      id: string;
      username: string;
      discriminator: string;
      global_name?: string;
      avatar?: string;
    };

    const allGuilds = await guildsRes.json() as Array<{
      id: string;
      name: string;
      icon: string | null;
      owner: boolean;
      permissions: string;
    }>;

    // Filter: user must have ADMINISTRATOR permission AND bot must be in the guild
    const client = getClient();
    const botGuildIds = new Set(client?.guilds.cache.keys() ?? []);

    const filteredGuilds = allGuilds.filter((g) => {
      const hasAdmin = (BigInt(g.permissions) & ADMIN_PERMISSION) !== BigInt(0);
      const botPresent = botGuildIds.has(g.id);
      return hasAdmin && botPresent;
    }).map((g) => ({ id: g.id, name: g.name, icon: g.icon }));

    const userTag = user.discriminator === "0"
      ? user.global_name ?? user.username
      : `${user.username}#${user.discriminator}`;

    const avatarURL = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> BigInt(22)) % BigInt(6)}.png`;

    const ownerFlag = isOwner(user.id);

    const jwtToken = signToken({
      userId: user.id,
      userTag,
      avatarURL,
      isOwner: ownerFlag,
      guilds: filteredGuilds,
    });

    // Redirect to dashboard SPA with token in query param
    res.redirect(`${DASHBOARD_BASE}?token=${encodeURIComponent(jwtToken)}`);
  } catch (err) {
    console.error("Auth callback error:", err);
    res.redirect(`${DASHBOARD_BASE}?error=server`);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
import { authMiddleware } from "../lib/jwt-auth.js";

router.get("/auth/me", authMiddleware, (req, res) => {
  res.json((req as any).jwtPayload);
});

export default router;
