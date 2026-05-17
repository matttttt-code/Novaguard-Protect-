import { useState } from "react";
import { useLocation } from "wouter";
import { useDashboardAuth } from "@workspace/api-client-react";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Login() {
  const [, setLocation] = useLocation();
  const [token, setTokenInput] = useState("");
  const { mutate: login, isPending, error } = useDashboardAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(
      { data: { token } },
      {
        onSuccess: (res) => {
          if (res.ok) {
            setToken(token);
            setLocation("/guilds");
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter uppercase font-mono">Terminal Autorisé</h1>
          <p className="text-muted-foreground font-mono text-xs">Accès restreint. Veuillez vous identifier.</p>
        </div>
        
        <Card className="border-muted bg-card">
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
            <CardDescription>Entrez votre jeton secret pour accéder au panneau de contrôle.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>Jeton d'accès invalide ou refusé.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Jeton secret..."
                  value={token}
                  onChange={(e) => setTokenInput(e.target.value)}
                  disabled={isPending}
                  className="font-mono bg-background"
                />
              </div>
              <Button type="submit" className="w-full font-mono uppercase tracking-widest" disabled={isPending || !token}>
                {isPending ? "Vérification..." : "Accéder"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
