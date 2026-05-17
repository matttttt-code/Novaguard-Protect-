import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { setToken, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Terminal } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (getToken()) { setLocation("/guilds"); return; }
    inputRef.current?.focus();
  }, [setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Code invalide ou expiré.");
        setCode("");
        inputRef.current?.focus();
      } else {
        setToken(data.token);
        setLocation("/guilds");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tighter uppercase font-mono">
            Terminal Autorisé
          </h1>
          <p className="text-muted-foreground font-mono text-xs">
            Accès restreint — authentification via Discord.
          </p>
        </div>

        {/* Main card */}
        <Card className="border-muted bg-card">
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Entrez le code reçu via la commande bot pour accéder au dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || code.trim().length === 0}
                className="w-full font-mono uppercase tracking-widest"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Vérification…</>
                ) : (
                  "Connexion"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* How-to */}
        <Card className="border-muted bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
              <Terminal className="h-4 w-4" /> Comment obtenir un code ?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                Va sur un serveur Discord où tu es <strong className="text-foreground">Administrateur</strong> et où le bot est présent.
              </li>
              <li>
                Tape la commande :{" "}
                <code className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs font-mono">
                  /verify-dashboard
                </code>
                {" "}ou{" "}
                <code className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs font-mono">
                  &amp;verify-dashboard
                </code>
              </li>
              <li>
                Le bot t'envoie un code à 6 chiffres en <strong className="text-foreground">DM</strong> (valable 10 min).
              </li>
              <li>Colle le code ci-dessus et clique <strong className="text-foreground">Connexion</strong>.</li>
            </ol>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
