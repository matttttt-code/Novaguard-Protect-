import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setToken, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function DiscordIcon() {
  return (
    <svg viewBox="0 0 127.14 96.36" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already logged in
    if (getToken()) {
      setLocation("/guilds");
      return;
    }

    // Check for token in URL params (after OAuth callback redirect)
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");

    if (token) {
      setToken(token);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
      setLocation("/guilds");
      return;
    }

    if (err) {
      const messages: Record<string, string> = {
        no_code: "Autorisation Discord annulée.",
        token_exchange: "Échec de l'échange du code Discord.",
        discord_api: "Erreur lors de la communication avec Discord.",
        server: "Erreur serveur interne.",
      };
      setError(messages[err] ?? "Erreur inconnue.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setLocation]);

  const handleDiscordLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter uppercase font-mono">Terminal Autorisé</h1>
          <p className="text-muted-foreground font-mono text-xs">Accès restreint. Connectez-vous via Discord.</p>
        </div>

        <Card className="border-muted bg-card">
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
            <CardDescription>
              Seuls les administrateurs de serveurs où le bot est présent peuvent accéder au dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleDiscordLogin}
              className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-mono uppercase tracking-widest"
            >
              <DiscordIcon />
              Se connecter avec Discord
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Accès accordé uniquement si vous êtes administrateur sur un serveur avec le bot, ou propriétaire du bot.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
