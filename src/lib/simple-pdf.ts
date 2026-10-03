// Minimal PDF-skriver uden afhængigheder (docs/DECISIONS.md 2026-10-02):
// tekst, overskrifter og tabeller i Helvetica på A4. Bruges til
// partnerrapporter, som skal kunne hentes som PDF og sendes som vedhæftning.
// Tegn uden for Latin-1 erstattes med "?" (WinAnsiEncoding).

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

const escapePdf = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const toLatin1 = (text: string) =>
  Buffer.from(
    text.replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'),
    "latin1"
  ).toString("latin1");

// Tilnærmet tekstbredde for Helvetica (gennemsnit 0,5 em) — nok til kolonner.
const textWidth = (text: string, size: number) => text.length * size * 0.5;

export type PdfColumn = { label: string; width: number; align?: "left" | "right" };

export class SimplePdf {
  private pages: string[][] = [];
  private ops: string[] = [];
  private y = PAGE_H - MARGIN;

  constructor() {
    this.newPage();
  }

  private newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE_H - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  private write(x: number, y: number, size: number, text: string, bold = false) {
    const font = bold ? "/F2" : "/F1";
    this.ops.push(`BT ${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(toLatin1(text))}) Tj ET`);
  }

  private rule(y: number, weight = 0.5) {
    this.ops.push(`${weight} w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`);
  }

  heading(text: string, size = 16) {
    this.ensure(size * 2);
    this.y -= size;
    this.write(MARGIN, this.y, size, text, true);
    this.y -= size * 0.6;
  }

  paragraph(text: string, size = 10) {
    const maxChars = Math.floor((PAGE_W - 2 * MARGIN) / (size * 0.5));
    const words = text.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      if ((line + " " + word).trim().length > maxChars) {
        lines.push(line.trim());
        line = word;
      } else line = `${line} ${word}`;
    }
    if (line.trim()) lines.push(line.trim());
    for (const l of lines) {
      this.ensure(size * 1.5);
      this.y -= size * 1.4;
      this.write(MARGIN, this.y, size, l);
    }
    this.y -= size * 0.4;
  }

  space(points = 8) {
    this.y -= points;
  }

  table(columns: PdfColumn[], rows: string[][], size = 9) {
    const rowH = size * 1.7;
    const drawHeader = () => {
      this.ensure(rowH * 2);
      this.y -= rowH;
      let x = MARGIN;
      for (const col of columns) {
        const tx = col.align === "right" ? x + col.width - textWidth(col.label, size) : x;
        this.write(tx, this.y, size, col.label, true);
        x += col.width;
      }
      this.rule(this.y - size * 0.4, 0.8);
    };
    drawHeader();
    for (const row of rows) {
      if (this.y - rowH < MARGIN) {
        this.newPage();
        drawHeader();
      }
      this.y -= rowH;
      let x = MARGIN;
      columns.forEach((col, i) => {
        const maxChars = Math.max(1, Math.floor(col.width / (size * 0.5)) - 1);
        const raw = row[i] ?? "";
        const cell = raw.length > maxChars ? `${raw.slice(0, maxChars - 1)}…` : raw;
        const tx = col.align === "right" ? x + col.width - textWidth(cell, size) : x;
        this.write(tx, this.y, size, cell);
        x += col.width;
      });
      this.rule(this.y - size * 0.4, 0.25);
    }
    this.y -= size;
  }

  build(): Buffer {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };
    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pagesId = objects.length + 1 + this.pages.length * 2;
    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const stream = ops.join("\n");
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      const pageId = add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`
      );
      pageIds.push(pageId);
    }
    const realPagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    if (realPagesId !== pagesId) throw new Error("PDF: object numbering mismatch");
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let out = "%PDF-1.4\n%âãÏÓ\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}
