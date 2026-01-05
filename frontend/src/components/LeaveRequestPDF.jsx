import React, { useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';

/**
 * LeaveRequestPDF
 * Componentă pentru popularea PDF-ului template cu datele cererii de concediu
 * Folosește template-ul salvat de PDFFieldMapper
 */
const LeaveRequestPDF = ({ leave, employee, workplaceName, onClose }) => {
  
  // Formatare dată: DD.MM.YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Încarcă template-ul din localStorage
  const loadTemplate = () => {
    try {
      const templateStr = localStorage.getItem('pdfFieldTemplate');
      if (templateStr) {
        return JSON.parse(templateStr);
      }
    } catch (error) {
      console.error('Eroare la încărcarea template-ului:', error);
    }
    return null;
  };

  // Generează PDF-ul populat
  const generatePDF = async () => {
    try {
      // Încarcă template-ul
      const template = loadTemplate();
      
      if (!template || !template.fields) {
        alert('Template-ul nu a fost găsit! Te rog folosește PDF Field Mapper pentru a crea template-ul.');
        if (onClose) onClose();
        return;
      }
      
      console.log('📋 Template încărcat:', template);
      console.log('📋 Câmpuri disponibile:', Object.keys(template.fields));
      console.log('📋 Câmp "motiv" disponibil?', !!template.fields.motiv);

      // Încarcă PDF-ul template
      const templateUrl = '/Cerere_acordare_concediu_RemediumFarm_FINAL.pdf';
      const response = await fetch(templateUrl);
      
      if (!response.ok) {
        throw new Error(`PDF template nu a fost găsit. Verifică dacă fișierul există în folderul public.`);
      }
      
      const templateBytes = await response.arrayBuffer();
      
      // Deschide PDF-ul
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { height } = firstPage.getSize();
      
      // Fonturi
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const textColor = rgb(0, 0, 0);
      const fields = template.fields;
      
      // Funcție helper pentru înlocuirea caracterelor speciale românești cu echivalentele ASCII
      const replaceRomanianChars = (text) => {
        if (!text) return '';
        return String(text)
          .replace(/Ă/g, 'A').replace(/ă/g, 'a')
          .replace(/Â/g, 'A').replace(/â/g, 'a')
          .replace(/Î/g, 'I').replace(/î/g, 'i')
          .replace(/Ș/g, 'S').replace(/ș/g, 's')
          .replace(/Ț/g, 'T').replace(/ț/g, 't');
      };

      // Funcție helper pentru desenarea textului
      // IMPORTANT: Coordonatele din template sunt deja în format PDF (bottom-left origin)
      // pdf-lib folosește și el bottom-left origin, deci folosim direct coordonatele
      const drawText = (text, fieldName) => {
        if (!text || !fields[fieldName]) {
          console.warn(`⚠️ Câmp "${fieldName}" nu este disponibil sau textul este gol`);
          return;
        }
        const pos = fields[fieldName];
        // Înlocuim caracterele speciale românești cu echivalentele ASCII
        const safeText = replaceRomanianChars(String(text));
        console.log(`📝 Desenare text "${safeText}" la câmp "${fieldName}":`, { x: pos.x, y: pos.y, fontSize: pos.fontSize });
        
        firstPage.drawText(safeText, {
          x: pos.x,
          y: pos.y, // Coordonatele sunt deja în format PDF (bottom-left)
          size: pos.fontSize || 11,
          font: helveticaFont,
          color: textColor,
        });
      };
      
      // Funcție helper pentru desenarea unui "X" în checkbox
      const drawCheckbox = (fieldName) => {
        if (!fields[fieldName]) {
          console.warn(`⚠️ Checkbox "${fieldName}" nu este disponibil`);
          return;
        }
        const pos = fields[fieldName];
        console.log(`✅ Desenare checkbox "${fieldName}":`, { x: pos.x, y: pos.y });
        
        firstPage.drawText('X', {
          x: pos.x,
          y: pos.y, // Coordonatele sunt deja în format PDF (bottom-left)
          size: pos.fontSize || 10,
          font: helveticaBoldFont,
          color: textColor,
        });
      };
      
      // 1. Nume angajat
      const employeeName = employee?.name || leave?.name || '';
      if (employeeName) {
        drawText(employeeName, 'employeeName');
      }
      
      // 2. Punct de lucru
      if (workplaceName) {
        drawText(workplaceName, 'workplace');
      }
      
      // 3. Funcția
      if (leave?.function) {
        drawText(leave.function, 'function');
      }
      
      // 4. Număr zile
      if (leave?.days) {
        drawText(String(leave.days), 'days');
      }
      
      // 5. Perioada
      if (leave?.startDate && leave?.endDate) {
        const startDateStr = formatDate(leave.startDate);
        const endDateStr = formatDate(leave.endDate);
        
        drawText(startDateStr, 'startDate');
        drawText(endDateStr, 'endDate');
      }
      
      // 6. Tip concediu - Checkbox-uri
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
      
      // 7. Motiv - se desenează dacă există reason și câmpul motiv este mapat
      // IMPORTANT: Motivul poate exista pentru orice tip de concediu (odihna, fara_plata, medical, eveniment)
      console.log('🔍 Verificare câmp motiv:', {
        leaveType: leave?.type,
        hasReason: !!leave?.reason,
        reason: leave?.reason,
        hasMotivField: !!fields.motiv,
        motivField: fields.motiv,
        allFields: Object.keys(fields)
      });
      
      // Desenează motivul dacă există reason și câmpul motiv este mapat
      // IMPORTANT: Motivul poate exista pentru orice tip de concediu (odihna, fara_plata, medical, eveniment)
      if (leave?.reason && fields.motiv) {
        const motivText = String(leave.reason || '').trim();
        // Înlocuim caracterele speciale românești cu echivalentele ASCII
        const safeMotivText = replaceRomanianChars(motivText);
        console.log(`📝 Desenare motiv "${safeMotivText}" la câmp "motiv":`, fields.motiv);
        
        if (safeMotivText) {
          // Desenează motivul cu wrap pe mai multe linii dacă este necesar
          const maxWidth = 400;
          const fontSize = fields.motiv.fontSize || 11;
          const words = safeMotivText.split(' ');
          let line = '';
          let yPos = fields.motiv.y; // Coordonatele sunt deja în format PDF (bottom-left)
          let lineCount = 0;
          
          words.forEach((word, index) => {
            const testLine = line + (line ? ' ' : '') + word;
            const textWidth = helveticaFont.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth > maxWidth && line.length > 0) {
              // Desenează linia curentă
              console.log(`📝 Desenare linie ${lineCount + 1}: "${line}" la y=${yPos.toFixed(2)}`);
              firstPage.drawText(line, {
                x: fields.motiv.x,
                y: yPos,
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
              line = word;
              yPos -= (fontSize + 4); // Mută în sus pentru următoarea linie
              lineCount++;
            } else {
              line = testLine;
            }
          });
          
          // Desenează ultima linie
          if (line.trim().length > 0) {
            console.log(`📝 Desenare ultima linie: "${line}" la y=${yPos.toFixed(2)}`);
            firstPage.drawText(line, {
              x: fields.motiv.x,
              y: yPos,
              size: fontSize,
              font: helveticaFont,
              color: textColor,
            });
            lineCount++;
          }
          
          console.log(`✅ Motiv desenat cu succes - ${lineCount} linii la coordonate x=${fields.motiv.x.toFixed(2)}, y=${fields.motiv.y.toFixed(2)}`);
        } else {
          console.warn('⚠️ Motivul este gol!');
        }
      } else if (leave?.reason && !fields.motiv) {
        console.error('❌ Câmpul "motiv" nu este mapat în template!');
        console.error('💡 Te rog folosește tool-ul "Map PDF Fields" pentru a mapa câmpul "Motiv"');
      }
      
      // 8. Data semnăturii
      const currentDate = formatDate(new Date());
      drawText(currentDate, 'dataSemnatura');
      
      // 9. Nume și prenume pentru semnătură angajat
      // Folosim același nume ca la început (employeeName)
      const signatureName = employee?.name || leave?.name || '';
      if (signatureName && fields.numePrenumeAngajat) {
        // Înlocuim caracterele speciale românești cu echivalentele ASCII
        const safeSignatureName = replaceRomanianChars(String(signatureName));
        console.log(`📝 Desenare nume semnătură "${safeSignatureName}" la câmp "numePrenumeAngajat":`, fields.numePrenumeAngajat);
        firstPage.drawText(safeSignatureName, {
          x: fields.numePrenumeAngajat.x,
          y: fields.numePrenumeAngajat.y,
          size: fields.numePrenumeAngajat.fontSize || 11,
          font: helveticaFont,
          color: textColor,
        });
      }
      
      // Salvează PDF-ul
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const fileName = `Cerere_Concediu_${signatureName || 'Angajat'}_${formatDate(leave?.startDate)}.pdf`;
      saveAs(blob, fileName);
      
      if (onClose) {
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (error) {
      console.error('Eroare la generarea PDF:', error);
      alert(`Eroare la generarea PDF-ului!\n\n${error.message}\n\nVerifică consola browserului (F12) pentru detalii.`);
    }
  };

  // Auto-generare la mount
  useEffect(() => {
    if (leave && employee) {
      generatePDF();
    }
  }, [leave, employee, workplaceName]);

  if (!leave || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-4">Generare PDF Cerere Concediu</h2>
          <p className="text-sm text-slate-600 mb-4">
            Se generează PDF-ul cu datele cererii de concediu...
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestPDF;
