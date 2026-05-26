import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getVoucherById, resendVoucherEmail } from "@/lib/voucher.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, AlertTriangle, CheckCircle2, XCircle, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/voucher/$id")({
  head: () => ({ meta: [{ title: "Voucher — Open Sync" }] }),
  component: VoucherDetailPage,
});

function VoucherDetailPage() {
  const { id } = Route.useParams();
  const fetchVoucher = useServerFn(getVoucherById);
  const callResend = useServerFn(resendVoucherEmail);
  const [resending, setResending] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["voucher-detail", id],
    queryFn: () => fetchVoucher({ data: { id } }),
  });

  useEffect(() => {
    if (!data) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [data]);


  const handleResend = async () => {
    setResending(true);
    try {
      const res = await callResend({ data: { id } });
      toast.success(`E-mail reenviado para ${res.to}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao reenviar e-mail");
    } finally {
      setResending(false);
    }
  };


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

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-xl px-4 py-12">
          <Card className="p-8 text-center">
            <XCircle className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Voucher não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
            <Button asChild variant="ghost" className="mt-4"><Link to="/">Voltar</Link></Button>
          </Card>
        </main>
      </div>
    );
  }

  const reg: any = data;
  const isConfirmed = reg.status === "confirmed";
  const isCancelled = reg.status === "cancelled";
  const championship = reg.category?.championship;

  return (
    <div className="min-h-screen voucher-print-root">
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .voucher-print-root { background: white !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .voucher-card {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
            padding: 16px !important;
            page-break-inside: avoid;
            break-inside: avoid;
            font-size: 11px;
          }
          .voucher-card h1 { font-size: 18px !important; }
          .voucher-card .text-2xl { font-size: 16px !important; }
          .voucher-card .text-lg { font-size: 13px !important; }
          .voucher-card .p-8 { padding: 16px !important; }
          .voucher-card .p-6 { padding: 10px !important; }
          .voucher-card .p-4 { padding: 8px !important; }
          .voucher-card .mt-6 { margin-top: 10px !important; }
          .voucher-card .mt-4 { margin-top: 8px !important; }
          .voucher-card .pb-6 { padding-bottom: 10px !important; }
        }
      `}</style>
      <div className="no-print"><PublicHeader /></div>

      <main className="mx-auto max-w-xl px-4 py-8 space-y-4">
        <div className="no-print flex flex-wrap justify-end gap-2">
          {isConfirmed && (
            <Button variant="outline" onClick={handleResend} disabled={resending}>
              <Mail className="size-4 mr-2" />
              {resending ? "Enviando…" : "Reenviar e-mail"}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4 mr-2" />
            Baixar voucher (PDF)
          </Button>
        </div>


        <Card className="voucher-card p-8 bg-gradient-card border-border/50 shadow-elegant">
          <div className="text-center border-b border-border/50 pb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">Open Sync</p>
            <h1 className="mt-2 text-2xl font-bold">{championship?.name ?? "Campeonato"}</h1>
            {championship?.location && (
              <p className="text-sm text-muted-foreground mt-1">{championship.location}</p>
            )}
            <div className="mt-4">
              <Badge variant={isConfirmed ? "default" : isCancelled ? "destructive" : "secondary"}>
                {isConfirmed ? <><CheckCircle2 className="size-3 mr-1" />Confirmado</> :
                 isCancelled ? "Cancelado" : "Pagamento pendente"}
              </Badge>
            </div>
          </div>

          <div className="mt-6 space-y-1 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Categoria</p>
            <p className="text-lg font-semibold">{reg.category?.name}</p>
          </div>

          {reg.team_name && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Dupla</p>
              <p className="text-lg font-semibold">{reg.team_name}</p>
            </div>
          )}

          <div className="mt-6 grid gap-3">
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Atleta 1</p>
              <p className="font-semibold mt-1">{reg.athlete1_name}</p>
              <p className="text-sm text-muted-foreground">Camisa: <span className="text-foreground font-medium">{reg.athlete1_shirt_size}</span> · Shorts: <span className="text-foreground font-medium">{reg.athlete1_shorts_size}</span></p>
            </div>
            <div className="rounded-lg border border-border/50 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Atleta 2</p>
              <p className="font-semibold mt-1">{reg.athlete2_name}</p>
              <p className="text-sm text-muted-foreground">Camisa: <span className="text-foreground font-medium">{reg.athlete2_shirt_size}</span> · Shorts: <span className="text-foreground font-medium">{reg.athlete2_shorts_size}</span></p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Voucher</p>
            <p className="mt-2 text-2xl font-bold tracking-widest text-gradient font-mono">{reg.voucher_code}</p>
          </div>

          {isConfirmed ? (
            <div className="mt-6 flex flex-col items-center">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={reg.id} size={200} level="M" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Apresente este QR Code na entrada do evento para check-in.
              </p>
            </div>
          ) : isCancelled ? (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
              <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Inscrição cancelada</p>
                <p className="text-muted-foreground mt-1">Esta inscrição foi cancelada. Procure a organização se houver dúvidas.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="size-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-200">Pagamento ainda não confirmado</p>
                <p className="text-muted-foreground mt-1">O QR Code de entrada fica disponível assim que o pagamento for processado.</p>
              </div>
            </div>
          )}
        </Card>

        <div className="no-print text-center">
          <Button variant="ghost" asChild><Link to="/">Voltar para o início</Link></Button>
        </div>
      </main>
    </div>
  );
}
