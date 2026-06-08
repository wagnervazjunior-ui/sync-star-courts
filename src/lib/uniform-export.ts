import ExcelJS from "exceljs";

const SIZES = ["P", "M", "G", "GG", "XG", "XXGG"] as const;
type Size = (typeof SIZES)[number];

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada" };
const GENDER_LABEL: Record<string, string> = { male: "Masculina", female: "Feminina", mixed: "Mista" };

type Reg = {
  voucher_code: string;
  status: string;
  team_name: string;
  contact_email: string;
  contact_phone: string;
  athlete1_name: string;
  athlete1_shirt_size: Size;
  athlete1_shorts_size: Size;
  athlete2_name: string;
  athlete2_shirt_size: Size;
  athlete2_shorts_size: Size;
  created_at: string;
};

type Cat = {
  id: string;
  name: string;
  gender: "male" | "female" | "mixed";
  uniform_model?: string | null;
  registrations: Reg[];
};

type Args = {
  championshipName: string;
  championshipSlug: string;
  categories: Cat[];
};

const emptyCount = (): Record<Size, number> =>
  SIZES.reduce((acc, s) => { acc[s] = 0; return acc; }, {} as Record<Size, number>);

// Returns the modeling bucket (Masculino/Feminino) for a given athlete slot.
// male/female categories: both athletes share the category gender.
// mixed: athlete1 = male, athlete2 = female (form convention).
function modelingFor(cat: Cat, athleteIdx: 1 | 2): "Masculino" | "Feminino" {
  if (cat.gender === "male") return "Masculino";
  if (cat.gender === "female") return "Feminino";
  return athleteIdx === 1 ? "Masculino" : "Feminino";
}

export async function generateUniformWorkbook({ championshipName, championshipSlug, categories }: Args) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Open Sync";

  // Per-category sheets
  for (const cat of categories) {
    const ws = wb.addWorksheet(cat.name.slice(0, 31));
    ws.addRow([`Categoria: ${cat.name}`]).font = { bold: true, size: 14 };
    ws.addRow([`Gênero: ${GENDER_LABEL[cat.gender]}    Modelo: ${cat.uniform_model ?? "—"}`]);
    ws.addRow([]);

    const headerRow = ws.addRow([
      "Data da inscrição",
      "Atleta 1",
      "Atleta 2",
      "Camiseta atleta 1",
      "Shorts atleta 1",
      "Camiseta atleta 2",
      "Shorts atleta 2",
      "Nome da dupla",
      "Número do voucher",
    ]);
    headerRow.font = { bold: true };

    cat.registrations.forEach((r) => {
      ws.addRow([
        new Date(r.created_at).toLocaleString("pt-BR"),
        r.athlete1_name,
        r.athlete2_name,
        r.athlete1_shirt_size,
        r.athlete1_shorts_size,
        r.athlete2_shirt_size,
        r.athlete2_shorts_size,
        r.team_name,
        r.voucher_code,
      ]);
    });

    [18, 24, 24, 14, 14, 14, 14, 24, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // Counts per modeling bucket within the category
    ws.addRow([]);
    const buckets: Record<"Masculino" | "Feminino", { shirt: Record<Size, number>; shorts: Record<Size, number> }> = {
      Masculino: { shirt: emptyCount(), shorts: emptyCount() },
      Feminino: { shirt: emptyCount(), shorts: emptyCount() },
    };
    cat.registrations.forEach((r) => {
      const m1 = modelingFor(cat, 1);
      const m2 = modelingFor(cat, 2);
      buckets[m1].shirt[r.athlete1_shirt_size]++;
      buckets[m1].shorts[r.athlete1_shorts_size]++;
      buckets[m2].shirt[r.athlete2_shirt_size]++;
      buckets[m2].shorts[r.athlete2_shorts_size]++;
    });

    const showMasc = cat.gender !== "female";
    const showFem = cat.gender !== "male";
    const renderBucket = (label: "Masculino" | "Feminino") => {
      ws.addRow([`Contagem de uniformes — ${label}`]).font = { bold: true };
      ws.addRow(["Camiseta", ...SIZES]).font = { bold: true };
      ws.addRow(["Quantidade", ...SIZES.map((s) => buckets[label].shirt[s])]);
      ws.addRow(["Shorts", ...SIZES]).font = { bold: true };
      ws.addRow(["Quantidade", ...SIZES.map((s) => buckets[label].shorts[s])]);
      ws.addRow([]);
    };
    if (showMasc) renderBucket("Masculino");
    if (showFem) renderBucket("Feminino");
  }

  // Final summary sheet — by uniform model + modeling
  const summary = wb.addWorksheet("Resumo geral");
  summary.addRow([`Resumo geral de uniformes — ${championshipName}`]).font = { bold: true, size: 14 };
  summary.addRow(["Apenas inscrições confirmadas"]).font = { italic: true };
  summary.addRow([]);

  // model -> modeling -> { shirt, shorts }
  const totals: Record<string, Record<"Masculino" | "Feminino", { shirt: Record<Size, number>; shorts: Record<Size, number> }>> = {};
  const ensure = (model: string, mod: "Masculino" | "Feminino") => {
    if (!totals[model]) totals[model] = { Masculino: { shirt: emptyCount(), shorts: emptyCount() }, Feminino: { shirt: emptyCount(), shorts: emptyCount() } };
    return totals[model][mod];
  };

  for (const cat of categories) {
    const model = cat.uniform_model || "Sem modelo";
    cat.registrations.forEach((r) => {
      const m1 = modelingFor(cat, 1);
      const m2 = modelingFor(cat, 2);
      const b1 = ensure(model, m1);
      const b2 = ensure(model, m2);
      b1.shirt[r.athlete1_shirt_size]++;
      b1.shorts[r.athlete1_shorts_size]++;
      b2.shirt[r.athlete2_shirt_size]++;
      b2.shorts[r.athlete2_shorts_size]++;
    });
  }

  Object.entries(totals).forEach(([model, byMod]) => {
    summary.addRow([`Modelo: ${model}`]).font = { bold: true, size: 12 };
    (["Masculino", "Feminino"] as const).forEach((mod) => {
      const totalShirt = SIZES.reduce((s, sz) => s + byMod[mod].shirt[sz], 0);
      const totalShorts = SIZES.reduce((s, sz) => s + byMod[mod].shorts[sz], 0);
      if (totalShirt === 0 && totalShorts === 0) return;
      summary.addRow([`Modelagem ${mod}`]).font = { bold: true };
      summary.addRow(["Camiseta", ...SIZES, "Total"]).font = { bold: true };
      summary.addRow(["Quantidade", ...SIZES.map((s) => byMod[mod].shirt[s]), totalShirt]);
      summary.addRow(["Shorts", ...SIZES, "Total"]).font = { bold: true };
      summary.addRow(["Quantidade", ...SIZES.map((s) => byMod[mod].shorts[s]), totalShorts]);
      summary.addRow([]);
    });
    summary.addRow([]);
  });

  [22, 12, 12, 12, 12, 12, 12].forEach((w, i) => { summary.getColumn(i + 1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `uniformes-${championshipSlug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  // Status counter unused but exported names kept
  void STATUS_LABEL;
}
