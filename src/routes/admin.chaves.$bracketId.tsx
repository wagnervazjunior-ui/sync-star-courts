import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, Trash2, UserPlus, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getBracket, deleteBracket, addTeamToBracket, toggleBracketPublic } from "@/lib/brackets.functions";
import { BracketView } from "@/components/brackets/BracketView";
import { StandingsTab } from "@/components/brackets/StandingsTab";
import type { MatchCardData, TeamRef } from "@/components/brackets/MatchCard";

export const Route = createFileRoute("/admin/chaves/$bracketId")({
  component: BracketDetail,
});

function BracketDetail() {
  const { bracketId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callGet = useServerFn(getBracket);
  const callDelete = useServerFn(deleteBracket);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bracket", bracketId],
    queryFn: () => callGet({ data: { id: bracketId } }),
  });

  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const callAddTeam = useServerFn(addTeamToBracket);
  const callTogglePublic = useServerFn(toggleBracketPublic);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Chave não encontrada.</p>;

  const teams: TeamRef[] = (data.teams ?? []) as any;
  const matches: MatchCardData[] = (data.matches ?? []) as any;

  const isPublic = !!(data?.bracket as any)?.public;

  const handleTogglePublic = async () => {
    setToggling(true);
    try {
      await callTogglePublic({ data: { id: bracketId, public: !isPublic } });
      toast.success(isPublic ? "Chave ocultada do público" : "Chave publicada para o público");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta chave? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      await callDelete({ data: { id: bracketId } });
      toast.success("Chave excluída");
      qc.invalidateQueries({ queryKey: ["brackets-list"] });
      navigate({ to: "/admin/chaves" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/chaves">
          <ArrowLeft className="size-4" /> Chaves
        </Link>
      </Button>

      {/* Header — empilhado no mobile, lado a lado no desktop */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold leading-tight">{data.bracket.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[data.championship?.name, data.category?.name, `${teams.length} duplas`, data.bracket.match_format === "best_of_3_tiebreak" ? "Melhor de 3" : "Set único"].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={data.bracket.status === "finished" ? "default" : "secondary"}>
              {data.bracket.status === "finished" ? "Finalizada" : "Em andamento"}
            </Badge>
            <Badge variant={isPublic ? "default" : "outline"} className={isPublic ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : ""}>
              {isPublic ? "Público" : "Oculto"}
            </Badge>
          </div>
        </div>

        {/* Ações — labels visíveis no sm+, ícone-only no mobile */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isPublic ? "outline" : "hero"}
            size="sm"
            onClick={handleTogglePublic}
            disabled={toggling}
          >
            {toggling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPublic ? (
              <><EyeOff className="size-4" /><span className="hidden sm:inline ml-1">Ocultar</span></>
            ) : (
              <><Eye className="size-4" /><span className="hidden sm:inline ml-1">Publicar</span></>
            )}
          </Button>
          {isPublic && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`/chaves/${bracketId}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /><span className="hidden sm:inline ml-1">Ver público</span>
              </a>
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setAddTeamOpen(true)}>
            <UserPlus className="size-4" /><span className="ml-1">Adicionar dupla</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="initial" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="initial" className="flex-1 sm:flex-none">Fase Inicial</TabsTrigger>
          <TabsTrigger value="final" className="flex-1 sm:flex-none">Fase Final</TabsTrigger>
          <TabsTrigger value="standings" className="flex-1 sm:flex-none">Classificação</TabsTrigger>
        </TabsList>
        <TabsContent value="initial">
          <BracketView
            matches={matches}
            teams={teams}
            format={data.bracket.match_format as any}
            phase="initial"
            onRefresh={refetch}
          />
        </TabsContent>
        <TabsContent value="final">
          <BracketView
            matches={matches}
            teams={teams}
            format={data.bracket.match_format as any}
            phase="final"
            onRefresh={refetch}
          />
        </TabsContent>
        <TabsContent value="standings">
          <StandingsTab teams={teams} matches={matches} onSaved={refetch} />
        </TabsContent>
      </Tabs>

      <AddTeamDialog
        open={addTeamOpen}
        onClose={() => setAddTeamOpen(false)}
        bracketId={bracketId}
        onSaved={() => { setAddTeamOpen(false); refetch(); }}
        callAddTeam={callAddTeam}
      />
    </div>
  );
}

function AddTeamDialog({
  open, onClose, bracketId, onSaved, callAddTeam,
}: {
  open: boolean;
  onClose: () => void;
  bracketId: string;
  onSaved: () => void;
  callAddTeam: any;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    team_name: "",
    athlete1_name: "",
    athlete2_name: "",
    reason: "" as "cash" | "sponsor" | "courtesy" | "other" | "",
    note: "",
  });

  const reset = () => setForm({ team_name: "", athlete1_name: "", athlete2_name: "", reason: "", note: "" });

  const save = async () => {
    if (!form.athlete1_name.trim() || !form.athlete2_name.trim()) {
      toast.error("Informe o nome dos dois atletas");
      return;
    }
    if (!form.reason) {
      toast.error("Selecione o motivo da inserção manual");
      return;
    }
    setSaving(true);
    try {
      const res = await callAddTeam({
        data: {
          bracket_id: bracketId,
          team_name: form.team_name.trim(),
          athlete1_name: form.athlete1_name.trim(),
          athlete2_name: form.athlete2_name.trim(),
          reason: form.reason,
          note: form.note.trim() || undefined,
        },
      });
      if (res.placed) {
        toast.success("Dupla adicionada e alocada na chave");
      } else {
        toast.success("Dupla adicionada — aloque-a manualmente usando \"Mover dupla\" em uma partida");
      }
      reset();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao adicionar dupla");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Adicionar dupla à chave
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          A dupla será inserida na chave e alocada no primeiro slot disponível.
        </p>

        <div className="space-y-4">
          {/* Justificativa */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <h4 className="font-semibold text-sm text-primary">Justificativa</h4>
            <div className="space-y-2">
              <Label>Motivo <span className="text-destructive">*</span></Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v as typeof form.reason })}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Pagamento em dinheiro / PIX direto</SelectItem>
                  <SelectItem value="sponsor">Patrocinador</SelectItem>
                  <SelectItem value="courtesy">Cortesia</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ex: taxa paga no local, autorizado pelo organizador"
                maxLength={500}
              />
            </div>
          </div>

          {/* Dados da dupla */}
          <div className="space-y-2">
            <Label>Nome da dupla <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            <Input value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} placeholder="Ex: Os Invencíveis" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Atleta 1 <span className="text-destructive">*</span></Label>
              <Input value={form.athlete1_name} onChange={(e) => setForm({ ...form, athlete1_name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Atleta 2 <span className="text-destructive">*</span></Label>
              <Input value={form.athlete2_name} onChange={(e) => setForm({ ...form, athlete2_name: e.target.value })} placeholder="Nome completo" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin mr-2" />Adicionando…</> : <><UserPlus className="size-4 mr-2" />Adicionar à chave</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
