import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/sucesso/$voucher")({
  head: () => ({ meta: [{ title: "Inscrição confirmada — Open Sync" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { voucher } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["voucher", voucher],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_registration_by_voucher", { _code: voucher });
      if (error) throw error;
      return data as any;
    },
  });

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-8 bg-gradient-card border-border/50 shadow-elegant text-center">
          <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success/20 text-success">
            <CheckCircle2 className="size-10" />
          </div>
          <h1 className="mt-4 text-3xl font-bold">Inscrição registrada!</h1>
          <p className="mt-2 text-muted-foreground">Guarde seu voucher abaixo.</p>
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Voucher</p>
            <p className="mt-2 text-3xl font-bold tracking-widest text-gradient">{voucher}</p>
          </div>
          {data && (
            <div className="mt-6 text-left text-sm">
              <p><strong>Campeonato:</strong> {data.championship?.name}</p>
              <p><strong>Categoria:</strong> {data.category?.name}</p>
              <p className="mt-2"><strong>Status:</strong> <Badge>{data.status}</Badge></p>
            </div>
          )}
          <div className="mt-8 flex flex-col gap-2">
            <Button variant="hero" disabled>Pagar agora (em breve)</Button>
            <Button variant="ghost" asChild><Link to="/">Voltar</Link></Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
