import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "fallback-secret";

export interface JwtPayload {
  userId: string;
  userTag: string;
  avatarURL: string;
  isOwner: boolean;
  guilds: Array<{ id: string; name: string; icon: string | null }>;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SESSION_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query["token"] as string ?? "");
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Non autorisé — connectez-vous via Discord." });
    return;
  }
  (req as any).jwtPayload = payload;
  next();
}

export function ownerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const payload: JwtPayload | undefined = (req as any).jwtPayload;
  if (!payload?.isOwner) {
    res.status(403).json({ error: "Accès réservé au propriétaire du bot." });
    return;
  }
  next();
}
