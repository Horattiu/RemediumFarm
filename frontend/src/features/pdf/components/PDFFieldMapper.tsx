import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfService } from '../services/pdfService';
import type { PDFField, PDFFieldConfig, PDFTemplate } from '../types/pdf.types';

// Configure pdfjs worker - folosim worker-ul din public
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFFieldMapperProps {
  onSave?: (template: PDFTemplate) => void;
  onCancel?: () => void;
}

type PDFPage = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> extends infer T ? T extends { getPage: (page: number) => Promise<infer P> } ? P : never : never;
type Viewport = ReturnType<PDFPage['getViewport']>;

const fieldNames: PDFFieldConfig[] = [
  { key: 'employeeName', label: 'Nume angajat (Subsemnatul(a) ...)', preview: 'Ion Popescu' },
  { key: 'workplace', label: 'Punct de lucru (... punctul de lucru ...)', preview: 'Farmacia Remedium 1' },
  { key: 'function', label: 'Funcția (În funcția de ...)', preview: 'Farmacist' },
  { key: 'days', label: 'Număr zile (... zile de concediu)', preview: '5' },
  { key: 'startDate', label: 'Data început (de la ...)', preview: '22.12.2025' },
  { key: 'endDate', label: 'Data sfârșit (până la ...)', preview: '26.12.2025' },
  { key: 'checkboxOdihna', label: 'Checkbox - Concediu de odihnă', preview: 'X' },
  { key: 'checkboxCasatorieSalariat', label: 'Checkbox - Căsătoria salariatului', preview: 'X' },
  { key: 'checkboxCasatorieCopil', label: 'Checkbox - Căsătoria unui copil', preview: 'X' },
  { key: 'checkboxNastereCopil', label: 'Checkbox - Nașterea unui copil', preview: 'X' },
  { key: 'checkboxDecesSot', label: 'Checkbox - Decesul soțului/soției', preview: 'X' },
  { key: 'checkboxDecesBunici', label: 'Checkbox - Decesul bunicilor', preview: 'X' },
  { key: 'checkboxDonareSange', label: 'Checkbox - Donare de sânge', preview: 'X' },
  { key: 'motiv', label: 'Motiv (Motivul: ...)', preview: 'Motivul cererii' },
  { key: 'dataSemnatura', label: 'Data semnăturii (Data: ...)', preview: '22.12.2025' },
  { key: 'numePrenumeAngajat', label: 'Nume și prenume angajat (Nume și prenume: ...)', preview: 'Ion Popescu' },
  { key: 'numePrenumeSefDirect', label: 'Nume și prenume șef direct (Sub Semnătura șef direct)', preview: 'Maria Ionescu' },
];

/**
 * PDFFieldMapper
 * Tool interactiv pentru mapping-ul câmpurilor din PDF
 * Versiune îmbunătățită cu precizie mai mare
 */
export const PDFFieldMapper: React.FC<PDFFieldMapperProps> = ({ onSave, onCancel }) => {
  const [pdfPage, setPdfPage] = useState<PDFPage | null>(null);
  const [scale, setScale] = useState(2.0);
  const [fields, setFields] = useState<Record<string, PDFField>>({});
  const [currentField, setCurrentField] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Încarcă template-ul salvat din backend (cu fallback la localStorage) la mount
  useEffect(() => {
    const loadTemplate = async () => {
      const template = await pdfService.getTemplate();
      if (template?.fields) {
        console.log('📥 Template încărcat:', template);
        setFields(template.fields);
      }
    };
    
    loadTemplate();
  }, []);

  // Încarcă PDF-ul și afișează prima pagină
  useEffect(() => {
    const loadPDF = async () => {
      try {
        console.log('📄 Încărcare PDF pentru mapping...');
        const templateUrl = '/Cerere_acordare_concediu_RemediumFarm_FINAL.pdf';
        const loadingTask = pdfjsLib.getDocument(templateUrl);
        const pdf = await loadingTask.promise;
        console.log('✅ PDF încărcat, număr pagini:', pdf.numPages);
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1.0 }); // Viewport original pentru coordonate PDF
        setViewport(vp);
        setPdfPage(page);
        await renderPage(page);
        console.log('✅ Pagină renderată pe canvas');
      } catch (error) {
        console.error('❌ Eroare la încărcarea PDF:', error);
        const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
        alert(`Eroare la încărcarea PDF-ului!\n\n${errorMessage}\n\nVerifică consola pentru detalii.`);
      }
    };

    loadPDF();
  }, []);

  // Render pagina PDF pe canvas
  const renderPage = async (page: PDFPage) => {
    if (!canvasRef.current) {
      console.warn('⚠️ Canvas ref nu este disponibil');
      return;
    }

    try {
      const viewportScaled = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('❌ Nu s-a putut obține context-ul canvas');
        return;
      }

      canvas.height = viewportScaled.height;
      canvas.width = viewportScaled.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewportScaled,
        canvas: canvas,
      };

      await page.render(renderContext).promise;
      
      // Desenează grid dacă este activat
      if (showGrid) {
        drawGrid(context, canvas.width, canvas.height);
      }
      
      // Desenează marker-ele pentru câmpurile mapate
      drawFieldMarkers(context, canvas.width, canvas.height);
      
      console.log('✅ Pagină renderată cu succes');
    } catch (error) {
      console.error('❌ Eroare la renderarea paginii:', error);
    }
  };

  // Desenează grid pentru aliniere
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.2)';
    ctx.lineWidth = 0.5;
    
    const gridSize = 20;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Desenează marker-ele pentru câmpurile mapate
  const drawFieldMarkers = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    if (!viewport || !pdfPage) return;
    
    Object.entries(fields).forEach(([key, field]) => {
      // Convertim coordonatele PDF (bottom-left) la coordonate canvas (top-left)
      const canvasX = (field.x / viewport.width) * canvasWidth;
      const canvasY = canvasHeight - (field.y / viewport.height) * canvasHeight;
      
      // Desenează un cerc roșu pentru fiecare câmp mapat
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Desenează un text cu numele câmpului
      ctx.fillStyle = 'red';
      ctx.font = '10px Arial';
      ctx.fillText(key, canvasX + 8, canvasY - 5);
    });
  };

  // Re-render când se schimbă scale sau fields
  useEffect(() => {
    if (pdfPage) {
      renderPage(pdfPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, fields, showGrid]);

  // Gestionează click-ul pe canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentField || !canvasRef.current || !viewport || !pdfPage) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Coordonatele click-ului în canvas (top-left origin)
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Convertim la coordonate PDF (bottom-left origin)
    // PDF: (0,0) este bottom-left, Canvas: (0,0) este top-left
    const pdfX = (canvasX / canvas.width) * viewport.width;
    const pdfY = viewport.height - (canvasY / canvas.height) * viewport.height;

    // Salvează coordonatele cu precizie mare
    const fieldData: PDFField = {
      x: Math.round(pdfX * 100) / 100, // 2 zecimale
      y: Math.round(pdfY * 100) / 100, // 2 zecimale
      width: 100, // Default width
      height: 20, // Default height
      page: 1,
    };

    setFields(prev => ({
      ...prev,
      [currentField]: fieldData
    }));

    console.log(`✅ Câmp "${currentField}" salvat la:`, fieldData);
    
    // Găsește preview text pentru acest câmp
    const fieldInfo = fieldNames.find(f => f.key === currentField);
    if (fieldInfo?.preview) {
      setPreviewText(fieldInfo.preview);
    }
    
    setCurrentField(null);
    
    // Re-render pentru a afișa marker-ul
    setTimeout(() => {
      if (pdfPage) {
        renderPage(pdfPage);
      }
    }, 100);
  };

  // Ajustează manual coordonatele unui câmp
  const adjustField = (fieldKey: string, axis: 'x' | 'y', delta: number) => {
    setFields(prev => {
      if (!prev[fieldKey]) return prev;
      return {
        ...prev,
        [fieldKey]: {
          ...prev[fieldKey],
          [axis]: Math.round((prev[fieldKey][axis] + delta) * 100) / 100,
        }
      };
    });
  };

  // Salvează template-ul în backend (și localStorage pentru backup)
  const handleSave = async () => {
    if (Object.keys(fields).length === 0) {
      alert('Nu ai selectat niciun câmp!');
      return;
    }

    const template: PDFTemplate = {
      fields: fields,
      version: '2.0',
      createdAt: new Date().toISOString(),
    };

    console.log('📋 Template de salvat:', template);
    
    try {
      await pdfService.saveTemplate(template);
      
      // Copiază în clipboard
      navigator.clipboard.writeText(JSON.stringify(template, null, 2));
      
      alert(`Template salvat cu succes în backend!\n\n${Object.keys(fields).length} câmpuri mapate.\n\nTemplate-ul este acum persistent și va fi disponibil pe toate dispozitivele.`);
      
      if (onSave) {
        onSave(template);
      }
    } catch (error) {
      console.error('❌ Eroare la salvarea template-ului:', error);
      alert(`Template salvat în localStorage (backend indisponibil).\n\n${Object.keys(fields).length} câmpuri mapate.\n\n⚠️ Template-ul va fi disponibil doar pe acest browser.`);
      
      if (onSave) {
        onSave(template);
      }
    }
  };

  // Verifică dacă un câmp este deja mapat
  const isFieldMapped = (key: string) => fields[key] !== undefined;
  
  const selectedFieldInfo = fieldNames.find(f => f.key === currentField);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full p-6 max-h-[95vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">PDF Field Mapper - Versiune Îmbunătățită</h2>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
          >
            Închide
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <p className="text-sm text-slate-600">
            <strong>Instrucțiuni:</strong> Selectează un câmp din listă, apoi dă click pe poziția corespunzătoare din PDF. 
            Câmpurile mapate vor apărea cu marker-e roșii.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm flex items-center gap-2">
              Zoom:
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="w-12">{scale.toFixed(1)}x</span>
            </label>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              Grid pentru aliniere
            </label>
            {previewText && (
              <span className="text-sm text-emerald-600 font-semibold">
                Preview: "{previewText}"
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Lista de câmpuri */}
          <div className="lg:col-span-1">
            <h3 className="font-semibold mb-2">Câmpuri de mapat:</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {fieldNames.map((field) => (
                <div key={field.key}>
                  <button
                    onClick={() => {
                      setCurrentField(field.key);
                      setPreviewText(field.preview || '');
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm border-2 transition-colors ${
                      currentField === field.key
                        ? 'border-emerald-600 bg-emerald-50'
                        : isFieldMapped(field.key)
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{field.label}</span>
                      {isFieldMapped(field.key) && (
                        <span className="text-green-600 text-xs">✓</span>
                      )}
                    </div>
                  </button>
                  
                  {/* Ajustare manuală pentru câmpurile mapate */}
                  {isFieldMapped(field.key) && (
                    <div className="mt-1 px-2 py-1 bg-slate-50 rounded text-xs space-y-1">
                      <div className="flex items-center gap-1">
                        <span>X:</span>
                        <button onClick={() => adjustField(field.key, 'x', -1)} className="px-1 bg-slate-200 rounded">-</button>
                        <span className="text-xs font-mono">{fields[field.key].x.toFixed(2)}</span>
                        <button onClick={() => adjustField(field.key, 'x', 1)} className="px-1 bg-slate-200 rounded">+</button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Y:</span>
                        <button onClick={() => adjustField(field.key, 'y', -1)} className="px-1 bg-slate-200 rounded">-</button>
                        <span className="text-xs font-mono">{fields[field.key].y.toFixed(2)}</span>
                        <button onClick={() => adjustField(field.key, 'y', 1)} className="px-1 bg-slate-200 rounded">+</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-slate-500 mb-2">
                Câmpuri mapate: <strong>{Object.keys(fields).length}</strong> / {fieldNames.length}
              </p>
              <button
                onClick={handleSave}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold"
              >
                💾 Salvează Template
              </button>
            </div>
          </div>

          {/* Canvas cu PDF */}
          <div className="lg:col-span-3">
            {selectedFieldInfo && (
              <div className="bg-yellow-200 p-2 text-sm font-semibold text-center mb-2 rounded">
                👆 Click pe poziția pentru: <strong>{selectedFieldInfo.label}</strong>
                {selectedFieldInfo.preview && (
                  <span className="ml-2 text-emerald-700">(Preview: "{selectedFieldInfo.preview}")</span>
                )}
              </div>
            )}
            <div
              ref={containerRef}
              className="border-2 border-slate-300 rounded overflow-auto bg-slate-100"
              style={{ maxHeight: '75vh' }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="cursor-crosshair"
                style={{ display: 'block', margin: '0 auto' }}
              />
            </div>
            {viewport && (
              <div className="mt-2 text-xs text-slate-500 text-center">
                Dimensiuni PDF: {viewport.width.toFixed(2)} x {viewport.height.toFixed(2)} puncte
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

