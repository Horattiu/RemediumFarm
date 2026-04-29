import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import type { Leave } from "@/features/leaves/types/leave.types";
import type { Employee } from "@/shared/types/employee.types";
import { pdfService } from "./pdfService";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const replaceRomanianChars = (text: string | undefined | null): string => {
  if (!text) return "";
  return String(text)
    .replace(/Ă/g, "A").replace(/ă/g, "a")
    .replace(/Â/g, "A").replace(/â/g, "a")
    .replace(/Î/g, "I").replace(/î/g, "i")
    .replace(/Ș/g, "S").replace(/ș/g, "s")
    .replace(/Ț/g, "T").replace(/ț/g, "t");
};

const formatDate = (dateString: string | Date): string => {
  if (!dateString) return "";
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const toFileSafe = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\-\. ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");

export async function generateLeavePdfBlob(
  leave: Leave,
  employee: Employee,
  workplaceName: string
): Promise<{ blob: Blob; fileName: string }> {
  const template = await pdfService.getTemplate();
  if (!template || !template.fields) {
    throw new Error("Template-ul PDF nu este configurat.");
  }

  const templateUrl = "/Cerere_acordare_concediu_RemediumFarm_FINAL.pdf";
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error("Template-ul PDF nu a fost găsit.");
  }

  const templateBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const firstPage = pdfDoc.getPages()[0];
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textColor = rgb(0, 0, 0);
  const fields = template.fields;

  const drawText = (text: string, fieldName: string) => {
    if (!text || !fields[fieldName]) return;
    const pos = fields[fieldName];
    firstPage.drawText(replaceRomanianChars(text), {
      x: pos.x,
      y: pos.y,
      size: pos.fontSize || 11,
      font: helveticaFont,
      color: textColor,
    });
  };

  const drawCheckbox = (fieldName: string) => {
    if (!fields[fieldName]) return;
    const pos = fields[fieldName];
    firstPage.drawText("X", {
      x: pos.x,
      y: pos.y,
      size: pos.fontSize || 10,
      font: helveticaBoldFont,
      color: textColor,
    });
  };

  const employeeName = employee?.name || leave?.name || "Angajat";
  drawText(employeeName, "employeeName");
  drawText(workplaceName || "", "workplace");
  drawText(leave?.function || "", "function");
  if (leave?.days) drawText(String(leave.days), "days");
  if (leave?.startDate && leave?.endDate) {
    drawText(formatDate(leave.startDate), "startDate");
    drawText(formatDate(leave.endDate), "endDate");
  }

  if (leave?.type === "odihna") drawCheckbox("checkboxOdihna");
  if (leave?.type === "eveniment") {
    const reason = leave?.reason || "";
    if (reason.includes("Căsătoria salariatului")) drawCheckbox("checkboxCasatorieSalariat");
    if (reason.includes("Căsătoria unui copil")) drawCheckbox("checkboxCasatorieCopil");
    if (reason.includes("Nașterea unui copil")) drawCheckbox("checkboxNastereCopil");
    if (reason.includes("Decesul")) drawCheckbox("checkboxDecesSot");
    if (reason.includes("bunic")) drawCheckbox("checkboxDecesBunici");
    if (reason.includes("Donare de sânge")) drawCheckbox("checkboxDonareSange");
  }

  if (leave?.reason && fields.motiv) {
    const motivText = replaceRomanianChars(String(leave.reason).trim());
    const maxWidth = 400;
    const fontSize = fields.motiv.fontSize || 11;
    const words = motivText.split(" ");
    let line = "";
    let yPos = fields.motiv.y;

    words.forEach((word) => {
      const testLine = line + (line ? " " : "") + word;
      const textWidth = helveticaFont.widthOfTextAtSize(testLine, fontSize);
      if (textWidth > maxWidth && line.length > 0) {
        firstPage.drawText(line, {
          x: fields.motiv.x,
          y: yPos,
          size: fontSize,
          font: helveticaFont,
          color: textColor,
        });
        line = word;
        yPos -= fontSize + 4;
      } else {
        line = testLine;
      }
    });

    if (line.trim()) {
      firstPage.drawText(line, {
        x: fields.motiv.x,
        y: yPos,
        size: fontSize,
        font: helveticaFont,
        color: textColor,
      });
    }
  }

  drawText(formatDate(new Date()), "dataSemnatura");
  drawText(employeeName, "numePrenumeAngajat");
  if (leave?.directSupervisorName) {
    drawText(leave.directSupervisorName, "numePrenumeSefDirect");
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  const fileName = `Cerere_Concediu_${toFileSafe(employeeName)}_${toFileSafe(formatDate(leave.startDate))}.pdf`;
  return { blob, fileName };
}

export async function generateLeaveImageBlob(
  leave: Leave,
  employee: Employee,
  workplaceName: string
): Promise<{ blob: Blob; fileName: string }> {
  const template = await pdfService.getTemplate();
  if (!template || !template.fields) {
    throw new Error("Template-ul PDF nu este configurat.");
  }

  const templateUrl = "/Cerere_acordare_concediu_RemediumFarm_FINAL.pdf";
  const loadingTask = pdfjsLib.getDocument({ url: templateUrl });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const originalViewport = page.getViewport({ scale: 1.0 });
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Nu s-a putut obține context-ul canvas.");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  const fields = template.fields;
  const canvasHeight = canvas.height;
  const scale = viewport.width / originalViewport.width;

  const drawTextOnCanvas = (text: string, fieldName: string, fontSize = 11) => {
    if (!text || !fields[fieldName]) return;
    const pos = fields[fieldName];
    const canvasX = (pos.x / originalViewport.width) * canvas.width;
    const canvasY = canvasHeight - (pos.y / originalViewport.height) * canvas.height;
    context.fillStyle = "#000000";
    context.font = `${fontSize * scale}px Arial`;
    context.fillText(replaceRomanianChars(String(text)), canvasX, canvasY);
  };

  const drawCheckboxOnCanvas = (fieldName: string, fontSize = 10) => {
    if (!fields[fieldName]) return;
    const pos = fields[fieldName];
    const canvasX = (pos.x / originalViewport.width) * canvas.width;
    const canvasY = canvasHeight - (pos.y / originalViewport.height) * canvas.height;
    context.fillStyle = "#000000";
    context.font = `bold ${fontSize * scale}px Arial`;
    context.fillText("X", canvasX, canvasY);
  };

  const employeeName = employee?.name || leave?.name || "Angajat";
  drawTextOnCanvas(employeeName, "employeeName");
  drawTextOnCanvas(workplaceName || "", "workplace");
  drawTextOnCanvas(leave?.function || "", "function");
  if (leave?.days) drawTextOnCanvas(String(leave.days), "days");
  if (leave?.startDate && leave?.endDate) {
    drawTextOnCanvas(formatDate(leave.startDate), "startDate");
    drawTextOnCanvas(formatDate(leave.endDate), "endDate");
  }

  if (leave?.type === "odihna") drawCheckboxOnCanvas("checkboxOdihna");
  if (leave?.type === "eveniment") {
    const reason = leave?.reason || "";
    if (reason.includes("Căsătoria salariatului")) drawCheckboxOnCanvas("checkboxCasatorieSalariat");
    if (reason.includes("Căsătoria unui copil")) drawCheckboxOnCanvas("checkboxCasatorieCopil");
    if (reason.includes("Nașterea unui copil")) drawCheckboxOnCanvas("checkboxNastereCopil");
    if (reason.includes("Decesul")) drawCheckboxOnCanvas("checkboxDecesSot");
    if (reason.includes("bunic")) drawCheckboxOnCanvas("checkboxDecesBunici");
    if (reason.includes("Donare de sânge")) drawCheckboxOnCanvas("checkboxDonareSange");
  }

  if (leave?.reason && fields.motiv) {
    const motivText = replaceRomanianChars(String(leave.reason).trim());
    if (motivText) {
      const maxWidth = 400 * scale;
      const fontSize = (fields.motiv.fontSize || 11) * scale;
      const words = motivText.split(" ");
      let line = "";
      let yPos = canvasHeight - (fields.motiv.y / originalViewport.height) * canvas.height;
      const xPos = (fields.motiv.x / originalViewport.width) * canvas.width;
      const lineHeight = fontSize + 4;
      context.fillStyle = "#000000";
      context.font = `${fontSize}px Arial`;
      words.forEach((word) => {
        const testLine = line + (line ? " " : "") + word;
        const textWidth = context.measureText(testLine).width;
        if (textWidth > maxWidth && line.length > 0) {
          context.fillText(line, xPos, yPos);
          line = word;
          yPos -= lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line.trim().length > 0) context.fillText(line, xPos, yPos);
    }
  }

  drawTextOnCanvas(formatDate(new Date()), "dataSemnatura");
  drawTextOnCanvas(employeeName, "numePrenumeAngajat");
  if (leave?.directSupervisorName) drawTextOnCanvas(leave.directSupervisorName, "numePrenumeSefDirect");

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Nu s-a putut genera imaginea JPG."));
    }, "image/jpeg", 0.95);
  });

  const fileName = `Cerere_Concediu_${toFileSafe(employeeName)}_${toFileSafe(formatDate(leave.startDate))}.jpg`;
  return { blob, fileName };
}
