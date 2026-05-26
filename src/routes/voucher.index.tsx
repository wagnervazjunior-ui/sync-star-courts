import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/voucher/")({
  head: () => ({ meta: [{ title: "Consultar voucher — Open Sync" }] }),
  component: VoucherPage,
});

function VoucherPage() {
  const [code, setCode] = useState("");
  const nav = useNavigate();
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Card className="p-8 bg-gradient-card border-border/50">
          <h1 className="text-2xl font-bold">Consultar voucher</h1>
          <p className="mt-2 text-sm text-muted-foreground">Digite o código recebido após a inscrição.</p>
          <Input className="mt-4" placeholder="OS-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Button variant="hero" className="mt-4 w-full" onClick={() => code && nav({ to: "/sucesso/$voucher", params: { voucher: code } })}>
            Consultar
          </Button>
        </Card>
      </main>
    </div>
  );
}
