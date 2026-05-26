import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createPixCharge, simulatePayment } from "@/lib/payments.functions";
import { resendVoucherEmail } from "@/lib/voucher.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CardPaymentForm } from "@/components/CardPaymentForm";
import { CheckCircle2, Copy, Loader2, AlertTriangle, QrCode, CreditCard, Clock, MessageCircle, Ticket, Mail, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";


export const Route = createFileRoute("/sucesso/$voucher")({
  head: () => ({ meta: [{ title: "Inscrição — Open Sync" }] }),
  component: SuccessPage,
});

type RegInfo = {
  id: string;
  status: string;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_expires_at: string | null;
  amount_cents: number | null;
  payer_cpf: string | null;
  contact_phone: string | null;
  team_name: string | null;
  category?: { name?: string; price_cents?: number };
  championship?: { name?: string };
};

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function SuccessPage() {
  const { voucher } = Route.useParams();
  const qc = useQueryClient();
  const callCreatePix = useServerFn(createPixCharge);
  const callSimulate = useServerFn(simulatePayment);
  const callResend = useServerFn(resendVoucherEmail);
  const [resending, setResending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["voucher", voucher],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_registration_by_voucher", { _code: voucher });
      if (error) throw error;
      return data as RegInfo | null;
    },
  });

  // Realtime: when our registration row changes, refetch.
  useEffect(() => {
    if (!data?.id) return;
    const channel = supabase
      .channel(`reg-${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "registrations", filter: `id=eq.${data.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["voucher", voucher] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.id, voucher, qc]);

  const [generating, setGenerating] = useState(false);
  const [mock, setMock] = useState(false);
  const [tab, setTab] = useState<"pix" | "card">("pix");
  const [cpfInput, setCpfInput] = useState("");

  const handleGenerate = async (cpfArg?: string) => {
    setGenerating(true);
    try {
      const cpf = (cpfArg ?? cpfInput).replace(/\D/g, "") || undefined;
      const res = await callCreatePix({ data: { voucher, cpf } });
      if ("mock" in res) setMock(res.mock);
      qc.invalidateQueries({ queryKey: ["voucher", voucher] });
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao gerar PIX";
      if (msg.includes("CPF_REQUIRED")) {
        toast.error("Informe o CPF para gerar o PIX");
      } else {
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate PIX if we already have CPF saved
  useEffect(() => {
    if (!data) return;
    if (tab !== "pix") return;
    if (data.status === "pending" && !data.pix_qr_code && !generating && data.payer_cpf) {
      handleGenerate(data.payer_cpf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, tab, data?.payer_cpf]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-xl px-4 py-12">
          <Card className="p-8 text-center">
            <p>Voucher não encontrado.</p>
            <Button asChild variant="ghost" className="mt-4"><Link to="/">Voltar</Link></Button>
          </Card>
        </main>
      </div>
    );
  }

  const isConfirmed = data.status === "confirmed";
  const isProcessing = data.status === "processing";
  const amount = data.amount_cents ?? data.category?.price_cents ?? 0;

  const copyPayload = async () => {
    if (!data.pix_qr_code) return;
    await navigator.clipboard.writeText(data.pix_qr_code);
    toast.success("Código PIX copiado");
  };

  const statusLabel = isConfirmed
    ? "Confirmado"
    : isProcessing
    ? "Em análise"
    : data.status;

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-10 space-y-4">
        <Card className="p-8 bg-gradient-card border-border/50 shadow-elegant text-center">
          <div className={`mx-auto inline-flex size-16 items-center justify-center rounded-full ${isConfirmed ? "bg-success/20 text-success" : isProcessing ? "bg-primary/20 text-primary" : "bg-primary/20 text-primary"}`}>
            {isConfirmed ? <CheckCircle2 className="size-10" /> : isProcessing ? <Clock className="size-10" /> : <Loader2 className="size-10 animate-spin" />}
          </div>
          <h1 className="mt-4 text-3xl font-bold">
            {isConfirmed ? "Pagamento confirmado!" : isProcessing ? "Pagamento em análise" : "Inscrição registrada"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isConfirmed
              ? "Sua inscrição está garantida."
              : isProcessing
              ? "Estamos aguardando a confirmação da operadora do cartão."
              : "Escolha a forma de pagamento abaixo para garantir sua vaga."}
          </p>
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Voucher</p>
            <p className="mt-2 text-3xl font-bold tracking-widest text-gradient">{voucher}</p>
          </div>
          <div className="mt-6 text-left text-sm space-y-1">
            <p><strong>Campeonato:</strong> {data.championship?.name}</p>
            <p><strong>Categoria:</strong> {data.category?.name}</p>
            <p><strong>Valor:</strong> R$ {(amount / 100).toFixed(2).replace(".", ",")}</p>
            <div className="mt-2 flex items-center gap-2"><strong>Status:</strong>
              <Badge variant={isConfirmed ? "default" : "secondary"}>{statusLabel}</Badge>
            </div>
          </div>
          {isConfirmed && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col items-center">
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG value={data.id} size={200} level="M" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Apresente este QR Code na entrada do evento para check-in.
                </p>
              </div>
              <Button asChild variant="hero" className="w-full">
                <Link to="/voucher/$id" params={{ id: data.id }}>
                  <Ticket className="size-4 mr-2" />
                  Acessar meu voucher
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/voucher/$id" params={{ id: data.id }} search={{ print: 1 } as any}>
                  <Printer className="size-4 mr-2" />
                  Baixar voucher (PDF)
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={resending}
                onClick={async () => {
                  setResending(true);
                  try {
                    const res = await callResend({ data: { id: data.id } });
                    toast.success(`E-mail reenviado para ${res.to}`);
                  } catch (err: any) {
                    toast.error(err?.message ?? "Falha ao reenviar e-mail");
                  } finally {
                    setResending(false);
                  }
                }}
              >
                <Mail className="size-4 mr-2" />
                {resending ? "Enviando…" : "Reenviar e-mail de confirmação"}
              </Button>
            </div>
          )}

          {isConfirmed && data.contact_phone && (() => {
            const digits = (data.contact_phone ?? "").replace(/\D/g, "");
            const e164 = digits.startsWith("55") ? digits : `55${digits}`;
            const url = typeof window !== "undefined" ? window.location.origin + "/voucher/" + data.id : "";
            const lines = [
              `🏆 *${data.championship?.name ?? "Open Sync"}*`,
              `Categoria: ${data.category?.name ?? ""}`,
              data.team_name ? `Dupla: ${data.team_name}` : "",
              ``,
              `Voucher: *${voucher}*`,
              `Valor: R$ ${(amount / 100).toFixed(2).replace(".", ",")}`,
              `✅ Pagamento confirmado`,
              url ? `Acesse seu voucher: ${url}` : "",
            ].filter(Boolean);
            const msg = encodeURIComponent(lines.join("\n"));
            return (
              <Button
                asChild
                variant="outline"
                className="mt-2 w-full border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300"
              >
                <a
                  href={`https://wa.me/${e164}?text=${msg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4 mr-2" />
                  Enviar voucher pelo WhatsApp
                </a>
              </Button>
            );
          })()}
        </Card>

        {!isConfirmed && !isProcessing && (
          <Card className="p-6 bg-gradient-card border-border/50">
            {mock && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                <AlertTriangle className="size-4 mt-0.5" />
                <span>Modo simulação — configure a chave Asaas para gerar cobranças reais.</span>
              </div>
            )}
            <Tabs value={tab} onValueChange={(v) => setTab(v as "pix" | "card")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pix"><QrCode className="size-4 mr-2" />PIX</TabsTrigger>
                <TabsTrigger value="card"><CreditCard className="size-4 mr-2" />Cartão de crédito</TabsTrigger>
              </TabsList>

              <TabsContent value="pix" className="mt-4">
                {data.pix_qr_code_base64 ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${data.pix_qr_code_base64}`}
                        alt="QRCode PIX"
                        className="size-56 rounded-lg bg-white p-2"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">PIX copia e cola</p>
                      <div className="flex gap-2">
                        <code className="flex-1 truncate rounded-md border border-border/50 bg-background px-3 py-2 text-xs">
                          {data.pix_qr_code}
                        </code>
                        <Button size="sm" variant="outline" onClick={copyPayload}><Copy className="size-4" /></Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Esta tela atualiza sozinha quando o pagamento for identificado.
                    </p>
                    <Button variant="ghost" className="w-full" onClick={() => qc.invalidateQueries({ queryKey: ["voucher", voucher] })}>
                      Já paguei, atualizar
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/10"
                      onClick={async () => {
                        try {
                          const res = await callSimulate({ data: { voucher } });
                          if (res.status === "pending_webhook") {
                            toast.success("Pagamento simulado — aguardando confirmação do Asaas");
                          } else {
                            toast.success("Pagamento simulado (sandbox)");
                          }
                          qc.invalidateQueries({ queryKey: ["voucher", voucher] });
                        } catch (err: any) {
                          toast.error(err?.message ?? "Falha ao simular");
                        }
                      }}
                    >
                      Simular pagamento (sandbox)
                    </Button>
                  </div>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = cpfInput.replace(/\D/g, "");
                      if (clean.length < 11) {
                        toast.error("Informe um CPF válido");
                        return;
                      }
                      handleGenerate(clean);
                    }}
                  >
                    <div>
                      <label className="text-xs uppercase tracking-widest text-muted-foreground">
                        CPF do pagador
                      </label>
                      <input
                        inputMode="numeric"
                        autoComplete="off"
                        value={cpfInput}
                        onChange={(e) => setCpfInput(maskCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Necessário para gerar a cobrança PIX.
                      </p>
                    </div>
                    <Button type="submit" variant="hero" className="w-full" disabled={generating}>
                      {generating ? "Gerando PIX…" : "Gerar PIX"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="card" className="mt-4">
                <CardPaymentForm
                  voucher={voucher}
                  amountCents={amount}
                  onConfirmed={() => qc.invalidateQueries({ queryKey: ["voucher", voucher] })}
                />
              </TabsContent>
            </Tabs>
          </Card>
        )}

        <div className="text-center">
          <Button variant="ghost" asChild><Link to="/">Voltar para o início</Link></Button>
        </div>
      </main>
    </div>
  );
}
