import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { setToken, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { AlertCircle, Copy, Check, ExternalLink, Loader2, Terminal, ChevronDown, ChevronUp } from "lucide-react";

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
  const [redirectUri, setRedirectUri] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Code input
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (getToken()) { setLocation("/guilds"); return; }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");

    if (token) {
      setToken(token);
      window.history.replaceState({}, "", window.location.pathname);
      setLocation("/guilds");
      return;
    }

    if (err) {
      const messages: Record<string, string> = {
        no_code: "Autorisation Discord annulée.",
        token_exchange: "Échec de l'échange — l'URL de redirection n'est pas encore configurée dans le portail Discord.",
        discord_api: "Erreur lors de la communication avec Discord.",
        server: "Erreur serveur interne.",
      };
      setError(messages[err] ?? "Erreur inconnue.");
      setShowSetup(true);
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetch("/api/auth/redirect-uri")
      .then((r) => r.json())
      .then((data: { redirectUri: string }) => setRedirectUri(data.redirectUri))
      .catch(() => {});
  }, [setLocation]);

  const handleCopy = () => {
    if (!redirectUri) return;
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCodeLoading(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setCodeError(data.error ?? "Code invalide ou expiré.");
        setCode("");
        inputRef.current?.focus();
      } else {
        setToken(data.token);
        setLocation("/guilds");
      }
    } catch {
      setCodeError("Erreur réseau. Réessayez.");
    } finally {
      setCodeLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">

        {/* Title */}
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold tracking-tighter uppercase font-mono">Terminal Autorisé</h1>
          <p className="text-muted-foreground font-mono text-xs">Accès restreint — Administrateur de serveur uniquement.</p>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Discord OAuth card */}
        <Card className="border-muted bg-card">
          <CardHeader>
            <CardTitle>Connexion avec Discord</CardTitle>
            <CardDescription>
              Accès réservé aux administrateurs des serveurs où le bot est présent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => { window.location.href = "/api/auth/login"; }}
              className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-mono uppercase tracking-widest"
            >
              <DiscordIcon />
              Se connecter avec Discord
            </Button>

            {/* Setup section */}
            <button
              onClick={() => setShowSetup((v) => !v)}
              className="text-xs text-muted-foreground underline underline-offset-2 w-full text-center hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              {showSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showSetup ? "Masquer la configuration" : "Première utilisation — configurer le portail Discord"}
            </button>

            {showSetup && (
              <div className="space-y-3 pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Pour que le bouton fonctionne, ajoute cette URL dans ton application Discord :
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
                      discord.com/developers/applications <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    {" "}→ ton application
                  </li>
                  <li>Menu gauche → <strong className="text-foreground">OAuth2</strong> → section <strong className="text-foreground">Redirects</strong></li>
                  <li>Clique <strong className="text-foreground">Add Another</strong>, colle l'URL ci-dessous, puis <strong className="text-foreground">Save Changes</strong></li>
                </ol>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">URL à ajouter :</p>
                  <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                    <code className="text-xs flex-1 break-all text-foreground select-all">
                      {redirectUri || "Chargement..."}
                    </code>
                    <Button
                      variant="ghost" size="sm"
                      onClick={handleCopy}
                      disabled={!redirectUri}
                      className="shrink-0 h-7 w-7 p-0"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alternative: DM code */}
        <div>
          <button
            onClick={() => { setShowCode((v) => !v); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="text-xs text-muted-foreground underline underline-offset-2 w-full text-center hover:text-foreground transition-colors flex items-center justify-center gap-1"
          >
            <Terminal className="h-3 w-3" />
            {showCode ? "Masquer" : "Connexion alternative — code via commande bot"}
          </button>

          {showCode && (
            <Card className="border-muted bg-card mt-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Code de vérification</CardTitle>
                <CardDescription className="text-xs">
                  Tape <code className="bg-muted px-1 rounded">/verify-dashboard</code> sur Discord → le bot t'envoie un code en DM (10 min).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCodeSubmit} className="space-y-3">
                  {codeError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{codeError}</AlertDescription>
                    </Alert>
                  )}
                  <Input
                    ref={inputRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    className="text-center text-2xl tracking-[0.5em] font-mono h-12"
                    disabled={codeLoading}
                    autoComplete="one-time-code"
                  />
                  <Button
                    type="submit"
                    disabled={codeLoading || code.trim().length === 0}
                    className="w-full font-mono uppercase tracking-widest"
                  >
                    {codeLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Vérification…</>
                      : "Connexion par code"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
