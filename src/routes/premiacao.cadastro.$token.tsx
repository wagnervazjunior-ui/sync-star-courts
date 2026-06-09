import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPrizeInvite, registerPrizeData } from "@/lib/prizes.functions";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/premiacao/cadastro/$token")({
  head: () => ({ meta: [{ title: "Cadastro de Premiação — Open Sync" }] }),
  component: PrizePage,
});

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

const PLACEMENT_LABEL: Record<number, string> = { 1: "1º lugar 🥇", 2: "2º lugar 🥈", 3: "3º lugar 🥉" };

function PrizePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const callGet = useServerFn(getPrizeInvite);
  const callRegister = useServerFn(registerPrizeData);

  const [loading, setLoading] = useState(true);
  const [prize, setPrize] = useState<any>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [recipient1Name, setRecipient1Name] = useState("");
  const [recipient1PixKey, setRecipient1PixKey] = useState("");
  const [recipient1PixType, setRecipient1PixType] = useState("cpf");
  const [split, setSplit] = useState(false);
  const [recipient2Name, setRecipient2Name] = useState("");
  const [recipient2PixKey, setRecipient2PixKey] = useState("");
  const [recipient2PixType, setRecipient2PixType] = useState("cpf");
  const [declared, setDeclared] = useState(false);

  useEffect(() => {
    callGet({ data: { token } }).then((r) => {
      if (r.ok) {
        setPrize(r.prize);
        if (r.prize.status === "registered" || r.prize.status === "paid") setDone(true);
      }
    }).finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declared) {
      toast.error("Você precisa aceitar a declaração antes de continuar");
      return;
    }
    if (!recipient1Name.trim() || !recipient1PixKey.trim()) {
      toast.error("Preencha nome e chave PIX do recebedor");
      return;
    }
    if (split && (!recipient2Name.trim() || !recipient2PixKey.trim())) {
      toast.error("Preencha os dados do 2º recebedor");
      return;
    }
    setSaving(true);
    try {
      await callRegister({
        data: {
          token,
          recipient1_name: recipient1Name,
          recipient1_pix_key: recipient1PixKey,
          recipient1_pix_type: recipient1PixType as any,
          split_payment: split,
          recipient2_name: split ? recipient2Name : undefined,
          recipient2_pix_key: split ? recipient2PixKey : undefined,
          recipient2_pix_type: split ? recipient2PixType as any : undefined,
        },
      });
      setDone(true);
      toast.success("Dados cadastrados com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen"><PublicHeader />
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  if (!prize) return (
    <div className="min-h-screen"><PublicHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este link não está mais ativo ou é inválido.</p>
        </Card>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen"><PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <Card className="p-8 bg-gradient-card border-border/50 shadow-elegant">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Trophy className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Premiação</h1>
              <p className="text-sm text-muted-foreground">{prize.championship?.name}</p>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="font-semibold text-primary">{PLACEMENT_LABEL[prize.placement] ?? `${prize.placement}º lugar`}</p>
            <p className="text-sm">{prize.team_name} — {prize.category?.name}</p>
          </div>

          {done ? (
            <div className="text-center py-6">
              <p className="text-lg font-semibold text-success">✓ Dados cadastrados!</p>
              <p className="text-sm text-muted-foreground mt-2">
                {prize.status === "paid" ? "A premiação já foi paga." : "Aguarde o pagamento via PIX pelo organizador."}
              </p>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Recebedor</h3>
                <div className="space-y-1.5">
                  <Label>Nome completo</Label>
                  <Input value={recipient1Name} onChange={(e) => setRecipient1Name(e.target.value)} placeholder="Nome de quem receberá o PIX" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Tipo de chave PIX</Label>
                    <Select value={recipient1PixType} onValueChange={setRecipient1PixType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PIX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Chave PIX</Label>
                    <Input value={recipient1PixKey} onChange={(e) => setRecipient1PixKey(e.target.value)} placeholder="Sua chave" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <Switch checked={split} onCheckedChange={setSplit} id="split" />
                <Label htmlFor="split" className="cursor-pointer">Dividir premiação entre os dois jogadores</Label>
              </div>

              {split && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                  <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">2º Recebedor (50% cada)</h3>
                  <div className="space-y-1.5">
                    <Label>Nome completo</Label>
                    <Input value={recipient2Name} onChange={(e) => setRecipient2Name(e.target.value)} placeholder="Nome do 2º jogador" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Tipo de chave PIX</Label>
                      <Select value={recipient2PixType} onValueChange={setRecipient2PixType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PIX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Chave PIX</Label>
                      <Input value={recipient2PixKey} onChange={(e) => setRecipient2PixKey(e.target.value)} placeholder="Chave do 2º jogador" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
                <Checkbox
                  id="declared"
                  checked={declared}
                  onCheckedChange={(v) => setDeclared(!!v)}
                  className="mt-0.5 shrink-0"
                />
                <label htmlFor="declared" className="text-sm leading-relaxed cursor-pointer text-muted-foreground">
                  Declaro que as informações fornecidas são verdadeiras e que sou o responsável pelo recebimento da premiação. Estou ciente de que dados incorretos podem impedir o pagamento.
                </label>
              </div>

              <Button type="submit" variant="hero" className="w-full" disabled={saving || !declared}>
                {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trophy className="size-4 mr-2" />}
                Confirmar dados para recebimento
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
