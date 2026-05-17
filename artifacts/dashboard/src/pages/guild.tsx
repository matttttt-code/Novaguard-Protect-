import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetGuildConfig, useUpdateGuildConfig, getGetGuildConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Save, ShieldAlert, Shield, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function TagInput({ value = [], onChange, placeholder }: { value: string[], onChange: (val: string[]) => void, placeholder?: string }) {
  const [input, setInput] = useState("");

  const handleAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1 font-mono px-2 py-1">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {value.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun élément</span>}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleAdd}
        placeholder={placeholder}
        className="font-mono text-sm"
      />
    </div>
  );
}

export default function GuildConfigEditor() {
  const [, params] = useRoute("/guilds/:guildId");
  const guildId = params?.guildId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading, isError } = useGetGuildConfig(guildId, {
    query: { retry: false, refetchOnWindowFocus: false }
  });

  const updateConfig = useUpdateGuildConfig();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (config) {
      setFormData(config as Record<string, any>);
      setDirtyFields(new Set());
    }
  }, [config]);

  if (isError) {
    return (
      <div className="min-h-screen p-10 flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold font-mono">Erreur d'Accès</h2>
        <p className="text-muted-foreground">Impossible de charger la configuration pour ce serveur.</p>
        <Button onClick={() => setLocation("/guilds")} className="mt-6" variant="outline">Retour au Hub</Button>
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setDirtyFields(prev => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  };

  const handleSave = () => {
    if (dirtyFields.size === 0) return;

    const patch: Record<string, any> = {};
    dirtyFields.forEach(field => {
      patch[field] = formData[field];
    });

    updateConfig.mutate({ guildId, data: patch as any }, {
      onSuccess: (updatedData) => {
        toast({
          title: "Configuration sauvegardée",
          description: "Les modifications ont été appliquées avec succès.",
        });
        setDirtyFields(new Set());
        queryClient.setQueryData(getGetGuildConfigQueryKey(guildId), updatedData);
      },
      onError: () => {
        toast({
          title: "Erreur de sauvegarde",
          description: "Impossible d'appliquer les modifications.",
          variant: "destructive"
        });
      }
    });
  };

  const SectionCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-lg font-mono tracking-wide uppercase flex items-center gap-2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {children}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 pb-24">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <Link href="/guilds" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-foreground mb-4 transition-colors">
              <ChevronLeft className="h-4 w-4 mr-1" /> Retour au Hub
            </Link>
            <h1 className="text-3xl font-bold tracking-tight font-mono flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              Configuration Serveur
            </h1>
            <p className="text-muted-foreground font-mono text-xs mt-2 uppercase">ID: {guildId}</p>
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={dirtyFields.size === 0 || updateConfig.isPending}
            className="gap-2 font-mono uppercase tracking-widest min-w-[160px]"
          >
            <Save className="h-4 w-4" />
            {updateConfig.isPending ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SÉCURITÉ */}
          <SectionCard title="Sécurité">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Niveau de Sécurité</Label>
                <Select value={String(formData.securityLevel)} onValueChange={(v) => handleChange("securityLevel", Number(v))}>
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Standard</SelectItem>
                    <SelectItem value="2">2 - Élevé</SelectItem>
                    <SelectItem value="3">3 - Maximal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col"><span>Mode Raid</span><span className="text-xs text-muted-foreground font-normal">Bloque les nouveaux arrivants</span></Label>
                <Switch checked={formData.raidMode} onCheckedChange={(v) => handleChange("raidMode", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col"><span>Mode Raid Avancé</span><span className="text-xs text-muted-foreground font-normal">Filtre strict des comptes récents</span></Label>
                <Switch checked={formData.raidMode2} onCheckedChange={(v) => handleChange("raidMode2", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col"><span>Verrouillage (Join Lock)</span><span className="text-xs text-muted-foreground font-normal">Refuse toutes les connexions</span></Label>
                <Switch checked={formData.joinLock} onCheckedChange={(v) => handleChange("joinLock", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col"><span>Contrôle Suspect</span><span className="text-xs text-muted-foreground font-normal">Analyse les profils douteux</span></Label>
                <Switch checked={formData.suspiciousCheckEnabled} onCheckedChange={(v) => handleChange("suspiciousCheckEnabled", v)} />
              </div>
            </div>
          </SectionCard>

          {/* AUTOMOD */}
          <SectionCard title="Automodération">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Anti-Insultes</Label>
                <Switch checked={formData.antiInsultEnabled} onCheckedChange={(v) => handleChange("antiInsultEnabled", v)} />
              </div>
              <div className="space-y-2">
                <Label>Mots Interdits</Label>
                <TagInput 
                  value={formData.antiInsultWords || []} 
                  onChange={(v) => handleChange("antiInsultWords", v)}
                  placeholder="Ajouter un mot puis Entrée..."
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label>Anti-Webhook</Label>
                <Switch checked={formData.antiWebhookEnabled} onCheckedChange={(v) => handleChange("antiWebhookEnabled", v)} />
              </div>
            </div>
          </SectionCard>

          {/* LOGS */}
          <SectionCard title="Journaux (Logs)">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Canal Log Général (ID)</Label>
                <Input value={formData.generalLogChannelId || ""} onChange={(e) => handleChange("generalLogChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
              </div>
              <div className="space-y-2">
                <Label>Canal Log Sécurité (ID)</Label>
                <Input value={formData.logChannelId || ""} onChange={(e) => handleChange("logChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
              </div>
              <div className="space-y-2">
                <Label>Canal Log Bannissements (ID)</Label>
                <Input value={formData.banLogChannelId || ""} onChange={(e) => handleChange("banLogChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
              </div>
              <div className="space-y-2">
                <Label>Canal Log Invitations (ID)</Label>
                <Input value={formData.inviteLogChannelId || ""} onChange={(e) => handleChange("inviteLogChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
              </div>
            </div>
          </SectionCard>

          {/* TICKETS */}
          <SectionCard title="Tickets">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Catégorie des Tickets (ID)</Label>
                <Input value={formData.ticketCategoryId || ""} onChange={(e) => handleChange("ticketCategoryId", e.target.value || null)} className="font-mono text-sm" placeholder="ID de la catégorie..." />
              </div>
              <div className="space-y-2">
                <Label>Rôle Staff (ID)</Label>
                <Input value={formData.ticketStaffRoleId || ""} onChange={(e) => handleChange("ticketStaffRoleId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du rôle..." />
              </div>
              <div className="space-y-2">
                <Label>Canal Transcripts (ID)</Label>
                <Input value={formData.transcriptChannelId || ""} onChange={(e) => handleChange("transcriptChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
              </div>
            </div>
          </SectionCard>

          {/* BIENVENUE & DEPART */}
          <div className="space-y-6">
            <SectionCard title="Bienvenue">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Message de Bienvenue</Label>
                  <Switch checked={formData.welcomeEnabled} onCheckedChange={(v) => handleChange("welcomeEnabled", v)} />
                </div>
                <div className="space-y-2">
                  <Label>Canal (ID)</Label>
                  <Input disabled={!formData.welcomeEnabled} value={formData.welcomeChannelId || ""} onChange={(e) => handleChange("welcomeChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea disabled={!formData.welcomeEnabled} value={formData.welcomeMessage || ""} onChange={(e) => handleChange("welcomeMessage", e.target.value)} className="min-h-[100px] font-mono text-sm" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Départ">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Message de Départ</Label>
                  <Switch checked={formData.leaveEnabled} onCheckedChange={(v) => handleChange("leaveEnabled", v)} />
                </div>
                <div className="space-y-2">
                  <Label>Canal (ID)</Label>
                  <Input disabled={!formData.leaveEnabled} value={formData.leaveChannelId || ""} onChange={(e) => handleChange("leaveChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea disabled={!formData.leaveEnabled} value={formData.leaveMessage || ""} onChange={(e) => handleChange("leaveMessage", e.target.value)} className="min-h-[100px] font-mono text-sm" />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* CAPTCHA & AUTRES */}
          <div className="space-y-6">
            <SectionCard title="Vérification Captcha">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Activer le Captcha</Label>
                  <Switch checked={formData.captchaEnabled} onCheckedChange={(v) => handleChange("captchaEnabled", v)} />
                </div>
                <div className="space-y-2">
                  <Label>Canal de Vérification (ID)</Label>
                  <Input disabled={!formData.captchaEnabled} value={formData.captchaChannelId || ""} onChange={(e) => handleChange("captchaChannelId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du salon..." />
                </div>
                <div className="space-y-2">
                  <Label>Rôle Non Vérifié (ID)</Label>
                  <Input disabled={!formData.captchaEnabled} value={formData.captchaUnverifiedRoleId || ""} onChange={(e) => handleChange("captchaUnverifiedRoleId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du rôle temporaire..." />
                </div>
                <div className="space-y-2">
                  <Label>Rôle Vérifié (ID)</Label>
                  <Input disabled={!formData.captchaEnabled} value={formData.captchaVerifiedRoleId || ""} onChange={(e) => handleChange("captchaVerifiedRoleId", e.target.value || null)} className="font-mono text-sm" placeholder="ID du rôle final..." />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Invitations & Notifications">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex flex-col"><span>Notifications de Sanction (DM)</span><span className="text-xs text-muted-foreground font-normal">Prévenir l'utilisateur en privé</span></Label>
                  <Switch checked={formData.sanctionDmEnabled} onCheckedChange={(v) => handleChange("sanctionDmEnabled", v)} />
                </div>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label>Codes d'Invitation Autorisés (Whitelist)</Label>
                  <TagInput 
                    value={formData.whitelistedInviteCodes || []} 
                    onChange={(v) => handleChange("whitelistedInviteCodes", v)}
                    placeholder="ex: codeInvite123..."
                  />
                </div>
              </div>
            </SectionCard>
          </div>

        </div>
      </div>
      
      {/* Floating save indicator if dirty */}
      {dirtyFields.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border border-border shadow-xl rounded-full px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium font-mono">{dirtyFields.size} modification(s) non sauvegardée(s)</span>
          <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending} className="font-mono uppercase text-xs">
            Sauvegarder
          </Button>
        </div>
      )}
    </div>
  );
}
