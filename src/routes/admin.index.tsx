import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, CheckCircle2, XCircle, Clock, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const [championshipId, setChampionshipId] = useState<string>("all");
  const { data: championships } = useQuery({
    queryKey: ["admin-championships"],
    queryFn: async () => (await supabase.rpc("list_manageable_championships")).data ?? [],
  });
  const { data: stats } = useQuery({
    queryKey: ["admin-stats", championshipId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_stats", {
        _championship_id: championshipId === "all" ? (undefined as any) : championshipId,
      });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return {
        total: Number(row?.total ?? 0),
        pending: Number(row?.pending ?? 0),
        confirmed: Number(row?.confirmed ?? 0),
        cancelled: Number(row?.cancelled ?? 0),
        revenue: Number(row?.revenue_cents ?? 0),
      };
    },
  });

  const cards = [
    { icon: Users, label: "Total", value: stats?.total ?? 0, color: "text-foreground" },
    { icon: Clock, label: "Pendentes", value: stats?.pending ?? 0, color: "text-warning" },
    { icon: CheckCircle2, label: "Confirmadas", value: stats?.confirmed ?? 0, color: "text-success" },
    { icon: XCircle, label: "Canceladas", value: stats?.cancelled ?? 0, color: "text-destructive" },
    { icon: DollarSign, label: "Receita confirmada", value: `R$ ${((stats?.revenue ?? 0) / 100).toFixed(2).replace(".", ",")}`, color: "text-primary" },
    { icon: Trophy, label: "Campeonatos ativos", value: championships?.filter(c => c.active).length ?? 0, color: "text-accent" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das inscrições</p>
        </div>
        <Select value={championshipId} onValueChange={setChampionshipId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os campeonatos</SelectItem>
            {championships?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className={`size-5 ${c.color}`} />
            </div>
            <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
