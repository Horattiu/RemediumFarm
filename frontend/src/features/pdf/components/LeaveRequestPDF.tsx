import React, { useEffect, useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfService } from '../services/pdfService';
import type { Leave } from '@/features/leaves/types/leave.types';
import type { Employee } from '@/shared/types/employee.types';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface LeaveRequestPDFProps {
  leave: Leave;
  employee: Employee;
  workplaceName: string;
  onClose?: () => void;
}

/**
 * LeaveRequestPDF
 * Componentă pentru popularea PDF-ului template cu datele cererii de concediu
 * Folosește template-ul salvat de PDFFieldMapper
 */
export const LeaveRequestPDF: React.FC<LeaveRequestPDFProps> = ({ 
  leave, 
  employee, 
  workplaceName, 
  onClose 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Blochează scroll-ul paginii când modalul este deschis
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  // Formatare dată: DD.MM.YYYY
  const formatDate = (dateString: string | Date): string => {
    if (!dateString) return '';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Funcție helper pentru înlocuirea caracterelor speciale românești
  const replaceRomanianChars = (text: string | undefined | null): string => {
    if (!text) return '';
    return String(text)
      .replace(/Ă/g, 'A').replace(/ă/g, 'a')
      .replace(/Â/g, 'A').replace(/â/g, 'a')
      .replace(/Î/g, 'I').replace(/î/g, 'i')
      .replace(/Ș/g, 'S').replace(/ș/g, 's')
      .replace(/Ț/g, 'T').replace(/ț/g, 't');
  };

  // Generează imaginea (JPG/JPEG) populată
  const generateImage = async () => {
    try {
      setIsGenerating(true);
      
      // Încarcă template-ul
      const template = await pdfService.getTemplate();
      
      if (!template || !template.fields) {
        alert('Template-ul nu a fost găsit! Te rog folosește PDF Field Mapper pentru a crea template-ul.');
        setIsGenerating(false);
        return;
      }

      // Încarcă PDF-ul template
      const templateUrl = '/Cerere_acordare_concediu_RemediumFarm_FINAL.pdf';
      const response = await fetch(templateUrl);
      
      if (!response.ok) {
        throw new Error('PDF template nu a fost găsit. Verifică dacă fișierul există în folderul public.');
      }

      // Renderizează PDF-ul pe canvas folosind pdfjs-dist
      const loadingTask = pdfjsLib.getDocument({ url: templateUrl });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      // Viewport original (scale 1.0) pentru conversia corectă a coordonatelor
      const originalViewport = page.getViewport({ scale: 1.0 });
      const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 pentru calitate bună

      // Creează canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Nu s-a putut obține context-ul canvas');
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Renderizează PDF-ul pe canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      // Desenează textul pe canvas
      const fields = template.fields;
      const canvasHeight = canvas.height;
      const scale = viewport.width / originalViewport.width; // Factor de scalare
      
      // Funcție helper pentru desenarea textului pe canvas
      const drawTextOnCanvas = (text: string, fieldName: string, fontSize = 11) => {
        if (!text || !fields[fieldName]) {
          console.warn(`⚠️ Câmp "${fieldName}" nu este disponibil sau textul este gol`);
          return;
        }
        const pos = fields[fieldName];
        const safeText = replaceRomanianChars(String(text));
        
        // Convertim coordonatele PDF la coordonate canvas
        const canvasX = (pos.x / originalViewport.width) * canvas.width;
        const canvasY = canvasHeight - (pos.y / originalViewport.height) * canvas.height;
        
        context.fillStyle = '#000000';
        context.font = `${fontSize * scale}px Arial`;
        context.fillText(safeText, canvasX, canvasY);
      };

      // Funcție helper pentru desenarea checkbox-ului
      const drawCheckboxOnCanvas = (fieldName: string, fontSize = 10) => {
        if (!fields[fieldName]) {
          console.warn(`⚠️ Checkbox "${fieldName}" nu este disponibil`);
          return;
        }
        const pos = fields[fieldName];
        const canvasX = (pos.x / originalViewport.width) * canvas.width;
        const canvasY = canvasHeight - (pos.y / originalViewport.height) * canvas.height;
        
        context.fillStyle = '#000000';
        context.font = `bold ${fontSize * scale}px Arial`;
        context.fillText('X', canvasX, canvasY);
      };

      // Desenează toate câmpurile
      const employeeName = employee?.name || leave?.name || '';
      if (employeeName) {
        drawTextOnCanvas(employeeName, 'employeeName');
      }

      if (workplaceName) {
        drawTextOnCanvas(workplaceName, 'workplace');
      }

      if (leave?.function) {
        drawTextOnCanvas(leave.function, 'function');
      }

      if (leave?.days) {
        drawTextOnCanvas(String(leave.days), 'days');
      }

      if (leave?.startDate && leave?.endDate) {
        drawTextOnCanvas(formatDate(leave.startDate), 'startDate');
        drawTextOnCanvas(formatDate(leave.endDate), 'endDate');
      }

      // Checkbox-uri pentru tip concediu
      if (leave?.type === 'odihna') {
        drawCheckboxOnCanvas('checkboxOdihna');
      }

      if (leave?.type === 'eveniment') {
        const reason = leave?.reason || '';
        if (reason.includes('Căsătoria salariatului')) {
          drawCheckboxOnCanvas('checkboxCasatorieSalariat');
        }
        if (reason.includes('Căsătoria unui copil')) {
          drawCheckboxOnCanvas('checkboxCasatorieCopil');
        }
        if (reason.includes('Nașterea unui copil')) {
          drawCheckboxOnCanvas('checkboxNastereCopil');
        }
        if (reason.includes('Decesul soțului') || reason.includes('Decesul soției')) {
          drawCheckboxOnCanvas('checkboxDecesSot');
        }
        if (reason.includes('Decesul bunicilor')) {
          drawCheckboxOnCanvas('checkboxDecesBunici');
        }
        if (reason.includes('Donare de sânge')) {
          drawCheckboxOnCanvas('checkboxDonareSange');
        }
      }

      // Motiv (cu suport pentru mai multe linii)
      if (leave?.reason && fields.motiv) {
        const motivText = replaceRomanianChars(String(leave.reason).trim());
        if (motivText) {
          const maxWidth = 400 * scale;
          const fontSize = (fields.motiv.fontSize || 11) * scale;
          const words = motivText.split(' ');
          let line = '';
          let yPos = canvasHeight - (fields.motiv.y / originalViewport.height) * canvas.height;
          const xPos = (fields.motiv.x / originalViewport.width) * canvas.width;
          const lineHeight = fontSize + 4;
          
          context.fillStyle = '#000000';
          context.font = `${fontSize}px Arial`;
          
          words.forEach((word) => {
            const testLine = line + (line ? ' ' : '') + word;
            const textWidth = context.measureText(testLine).width;
            
            if (textWidth > maxWidth && line.length > 0) {
              context.fillText(line, xPos, yPos);
              line = word;
              yPos -= lineHeight;
            } else {
              line = testLine;
            }
          });
          
          if (line.trim().length > 0) {
            context.fillText(line, xPos, yPos);
          }
        }
      }

      // Data semnăturii
      const currentDate = formatDate(new Date());
      drawTextOnCanvas(currentDate, 'dataSemnatura');

      // Nume semnătură angajat
      const signatureName = employee?.name || leave?.name || '';
      if (signatureName && fields.numePrenumeAngajat) {
        drawTextOnCanvas(signatureName, 'numePrenumeAngajat');
      }

      // Nume șef direct
      const directSupervisorName = leave?.directSupervisorName;
      if (directSupervisorName && fields.numePrenumeSefDirect) {
        drawTextOnCanvas(directSupervisorName, 'numePrenumeSefDirect');
      }

      // Convertesc canvas-ul în JPG
      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = `Cerere_Concediu_${signatureName || 'Angajat'}_${formatDate(leave?.startDate)}.jpg`;
          saveAs(blob, fileName);
        } else {
          alert('Eroare la generarea imaginii!');
        }
        setIsGenerating(false);
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Eroare la generarea imaginii:', error);
      const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
      alert(`Eroare la generarea imaginii!\n\n${errorMessage}\n\nVerifică consola browserului (F12) pentru detalii.`);
      setIsGenerating(false);
    }
  };

  // Generează PDF-ul populat
  const generatePDF = async () => {
    try {
      setIsGenerating(true);
      const template = await pdfService.getTemplate();
      
      if (!template || !template.fields) {
        alert('Template-ul nu a fost găsit! Te rog folosește PDF Field Mapper pentru a crea template-ul.');
        if (onClose) onClose();
        return;
      }

      // Încarcă PDF-ul template
      const templateUrl = '/Cerere_acordare_concediu_RemediumFarm_FINAL.pdf';
      const response = await fetch(templateUrl);
      
      if (!response.ok) {
        throw new Error('PDF template nu a fost găsit. Verifică dacă fișierul există în folderul public.');
      }
      
      const templateBytes = await response.arrayBuffer();
      
      // Deschide PDF-ul
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      
      // Fonturi
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const textColor = rgb(0, 0, 0);
      const fields = template.fields;
      
      // Funcție helper pentru desenarea textului
      const drawText = (text: string, fieldName: string) => {
        if (!text || !fields[fieldName]) {
          console.warn(`⚠️ Câmp "${fieldName}" nu este disponibil sau textul este gol`);
          return;
        }
        const pos = fields[fieldName];
        const safeText = replaceRomanianChars(String(text));
        
        firstPage.drawText(safeText, {
          x: pos.x,
          y: pos.y,
          size: pos.fontSize || 11,
          font: helveticaFont,
          color: textColor,
        });
      };
      
      // Funcție helper pentru desenarea unui "X" în checkbox
      const drawCheckbox = (fieldName: string) => {
        if (!fields[fieldName]) {
          console.warn(`⚠️ Checkbox "${fieldName}" nu este disponibil`);
          return;
        }
        const pos = fields[fieldName];
        
        firstPage.drawText('X', {
          x: pos.x,
          y: pos.y,
          size: pos.fontSize || 10,
          font: helveticaBoldFont,
          color: textColor,
        });
      };
      
      // Desenează toate câmpurile
      const employeeName = employee?.name || leave?.name || '';
      if (employeeName) {
        drawText(employeeName, 'employeeName');
      }
      
      if (workplaceName) {
        drawText(workplaceName, 'workplace');
      }
      
      if (leave?.function) {
        drawText(leave.function, 'function');
      }
      
      if (leave?.days) {
        drawText(String(leave.days), 'days');
      }
      
      if (leave?.startDate && leave?.endDate) {
        drawText(formatDate(leave.startDate), 'startDate');
        drawText(formatDate(leave.endDate), 'endDate');
      }
      
      // Checkbox-uri pentru tip concediu
      if (leave?.type === 'odihna') {
        drawCheckbox('checkboxOdihna');
      }
      
      if (leave?.type === 'eveniment') {
        const reason = leave?.reason || '';
        
        if (reason.includes('Căsătoria salariatului')) {
          drawCheckbox('checkboxCasatorieSalariat');
        }
        if (reason.includes('Căsătoria unui copil')) {
          drawCheckbox('checkboxCasatorieCopil');
        }
        if (reason.includes('Nașterea unui copil')) {
          drawCheckbox('checkboxNastereCopil');
        }
        if (reason.includes('Decesul soțului') || reason.includes('Decesul soției') || 
            reason.includes('Decesul copilului') || reason.includes('Decesul părinților') || 
            reason.includes('Decesul socrilor')) {
          drawCheckbox('checkboxDecesSot');
        }
        if (reason.includes('Decesul bunicilor') || reason.includes('Decesul fraților') || 
            reason.includes('Decesul surorilor')) {
          drawCheckbox('checkboxDecesBunici');
        }
        if (reason.includes('Donare de sânge')) {
          drawCheckbox('checkboxDonareSange');
        }
      }
      
      // Motiv cu wrap pe mai multe linii
      if (leave?.reason && fields.motiv) {
        const motivText = String(leave.reason || '').trim();
        const safeMotivText = replaceRomanianChars(motivText);
        
        if (safeMotivText) {
          const maxWidth = 400;
          const fontSize = fields.motiv.fontSize || 11;
          const words = safeMotivText.split(' ');
          let line = '';
          let yPos = fields.motiv.y;
          
          words.forEach((word) => {
            const testLine = line + (line ? ' ' : '') + word;
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
              yPos -= (fontSize + 4);
            } else {
              line = testLine;
            }
          });
          
          if (line.trim().length > 0) {
            firstPage.drawText(line, {
              x: fields.motiv.x,
              y: yPos,
              size: fontSize,
              font: helveticaFont,
              color: textColor,
            });
          }
        }
      }
      
      // Data semnăturii
      const currentDate = formatDate(new Date());
      drawText(currentDate, 'dataSemnatura');
      
      // Nume și prenume pentru semnătură angajat
      const signatureName = employee?.name || leave?.name || '';
      if (signatureName && fields.numePrenumeAngajat) {
        const safeSignatureName = replaceRomanianChars(String(signatureName));
        firstPage.drawText(safeSignatureName, {
          x: fields.numePrenumeAngajat.x,
          y: fields.numePrenumeAngajat.y,
          size: fields.numePrenumeAngajat.fontSize || 11,
          font: helveticaFont,
          color: textColor,
        });
      }
      
      // Nume și prenume șef direct
      const directSupervisorName = leave?.directSupervisorName;
      const hasDirectSupervisorName = directSupervisorName && 
                                      typeof directSupervisorName === 'string' && 
                                      directSupervisorName.trim().length > 0;
      
      if (hasDirectSupervisorName && fields.numePrenumeSefDirect) {
        const safeDirectSupervisor = replaceRomanianChars(String(directSupervisorName).trim());
        firstPage.drawText(safeDirectSupervisor, {
          x: fields.numePrenumeSefDirect.x,
          y: fields.numePrenumeSefDirect.y,
          size: fields.numePrenumeSefDirect.fontSize || 11,
          font: helveticaFont,
          color: textColor,
        });
      }
      
      // Salvează PDF-ul
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      
      const fileName = `Cerere_Concediu_${signatureName || 'Angajat'}_${formatDate(leave?.startDate)}.pdf`;
      saveAs(blob, fileName);
      setIsGenerating(false);
    } catch (error) {
      console.error('Eroare la generarea PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
      alert(`Eroare la generarea PDF-ului!\n\n${errorMessage}\n\nVerifică consola browserului (F12) pentru detalii.`);
      setIsGenerating(false);
    }
  };

  if (!leave || !employee) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4" 
      style={{ 
        position: 'fixed',
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: '1rem'
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative z-[10001]">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-4">Descarcă Cerere Concediu</h2>
          <p className="text-sm text-slate-600 mb-6">
            Alege formatul de descărcare:
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={generatePDF}
              disabled={isGenerating}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Se generează...</span>
                </>
              ) : (
                <>
                  <span>📄</span>
                  <span>Descarcă PDF</span>
                </>
              )}
            </button>
            <button
              onClick={generateImage}
              disabled={isGenerating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Se generează...</span>
                </>
              ) : (
                <>
                  <span>🖼️</span>
                  <span>Descarcă Imagine (JPG)</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition-colors mt-2"
            >
              Anulează
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

