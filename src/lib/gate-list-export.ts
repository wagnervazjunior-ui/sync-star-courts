import ExcelJS from "exceljs";

type Reg = {
  team_name: string;
  athlete1_name: string;
  athlete2_name: string;
  status: string;
};

type Cat = {
  name: string;
  registrations: Reg[];
};

type Args = {
  championshipName: string;
  championshipSlug: string;
  categories: Cat[];
};

export async function generateGateListWorkbook({ championshipName, championshipSlug, categories }: Args) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Open Sync";

  for (const cat of categories) {
    const ws = wb.addWorksheet(cat.name.slice(0, 31));
    ws.addRow([`Lista da portaria — ${cat.name}`]).font = { bold: true, size: 14 };
    ws.addRow([championshipName]).font = { italic: true };
    ws.addRow([]);
    const header = ws.addRow(["Nome completo do atleta", "Nome da dupla"]);
    header.font = { bold: true };

    const rows: { name: string; team: string }[] = [];
    cat.registrations
      .filter((r) => r.status === "confirmed")
      .forEach((r) => {
        if (r.athlete1_name) rows.push({ name: r.athlete1_name.trim(), team: r.team_name });
        if (r.athlete2_name) rows.push({ name: r.athlete2_name.trim(), team: r.team_name });
      });
    rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    rows.forEach((r) => ws.addRow([r.name, r.team]));

    ws.getColumn(1).width = 36;
    ws.getColumn(2).width = 28;
  }

  if (categories.length === 0) {
    wb.addWorksheet("Vazio").addRow(["Nenhuma categoria com inscrições confirmadas."]);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portaria-${championshipSlug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
