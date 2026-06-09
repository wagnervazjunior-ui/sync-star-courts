import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getVouchersByEmail } from "@/lib/voucher.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Ticket, Mail, ChevronRight, CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/voucher/")({
  head: () => ({ meta: [{ title: "Consultar voucher — Open Sync" }] }),
  component: VoucherPage,
});

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  confirmed:  { label: "Confirmado",  variant: "default" },
  pending:    { label: "Pendente",    variant: "secondary" },
  processing: { label: "Em análise", variant: "secondary" },
  cancelled:  { label: "Cancelado",  variant: "destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, variant: "secondary" as const };
  const Icon = status === "confirmed" ? CheckCircle2 : status === "cancelled" ? XCircle : Clock;
  return (
    <Badge variant={s.variant} className="gap-1">
      <Icon className="size-3" />
      {s.label}
    </Badge>
  );
}

function VoucherPage() {
  const nav = useNavigate();
  const callByEmail = useServerFn(getVouchersByEmail);

  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [searched, setSearched] = useState(false);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) nav({ to: "/sucesso/$voucher", params: { voucher: code.trim().toUpperCase() } });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const data = await callByEmail({ data: { email: email.trim() } });
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Tabs defaultValue="code">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="code"><Ticket className="size-4 mr-2" />Código</TabsTrigger>
            <TabsTrigger value="email"><Mail className="size-4 mr-2" />E-mail</TabsTrigger>
          </TabsList>

          <TabsContent value="code">
            <Card className="p-8 bg-gradient-card border-border/50">
              <h1 className="text-2xl font-bold">Consultar por código</h1>
              <p className="mt-2 text-sm text-muted-foreground">Digite o código do voucher recebido após a inscrição.</p>
              <form onSubmit={handleCodeSubmit} className="mt-4 space-y-3">
                <Input
                  placeholder="Ex: AB12CD34"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                />
                <Button type="submit" variant="hero" className="w-full" disabled={!code.trim()}>
                  Consultar
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card className="p-8 bg-gradient-card border-border/50">
              <h1 className="text-2xl font-bold">Consultar por e-mail</h1>
              <p className="mt-2 text-sm text-muted-foreground">Informe o e-mail usado na inscrição para ver seus vouchers.</p>
              <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Button type="submit" variant="hero" className="w-full" disabled={!email.trim() || loading}>
                  {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Buscando…</> : "Buscar inscrições"}
                </Button>
              </form>
            </Card>

            {searched && results !== null && (
              <div className="mt-4 space-y-3">
                {results.length === 0 ? (
                  <Card className="p-6 text-center bg-gradient-card border-border/50">
                    <p className="text-sm text-muted-foreground">Nenhuma inscrição encontrada para este e-mail.</p>
                  </Card>
                ) : (
                  results.map((reg: any) => (
                    <Link key={reg.id} to="/sucesso/$voucher" params={{ voucher: reg.voucher_code }}>
                      <Card className="p-4 bg-gradient-card border-border/50 hover:border-primary/40 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{reg.team_name ?? "—"}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {(reg.category as any)?.championship?.name} · {(reg.category as any)?.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 font-mono">{reg.voucher_code}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={reg.status} />
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
