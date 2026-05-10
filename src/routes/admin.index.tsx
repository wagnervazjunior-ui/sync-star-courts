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
      let q = supabase.from("registrations").select("status, category:categories!inner(price_cents, championship_id)");
      const { data } = await q;
      const filtered = championshipId === "all" ? data ?? [] : (data ?? []).filter((r: any) => r.category.championship_id === championshipId);
      const pending = filtered.filter((r: any) => r.status === "pending").length;
      const confirmed = filtered.filter((r: any) => r.status === "confirmed").length;
      const cancelled = filtered.filter((r: any) => r.status === "cancelled").length;
      const revenue = filtered.filter((r: any) => r.status === "confirmed").reduce((sum: number, r: any) => sum + (r.category?.price_cents ?? 0), 0);
      return { total: filtered.length, pending, confirmed, cancelled, revenue };
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
