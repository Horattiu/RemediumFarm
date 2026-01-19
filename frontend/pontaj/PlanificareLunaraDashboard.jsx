import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { saveAs } from "file-saver";
import UserGuide from "../src/components/UserGuide";

// Folosește variabile de mediu pentru URL-ul backend-ului
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TURE = [
  { id: "tura1", nume: "Tură 1", ore: "7-14", culoare: "bg-blue-500" },
  { id: "tura2", nume: "Tură 2", ore: "8-15", culoare: "bg-green-500" },
  { id: "tura3", nume: "Tură 3", ore: "9-16", culoare: "bg-purple-500" },
];

// Formatează orele pe două linii, una peste alta (ex: "9-10" -> "9\n10")
const formateazaOreStacked = (ore) => {
  if (!ore || ore === "○") return ore;
  const parts = ore.split("-");
  if (parts.length === 2) {
    const start = String(parts[0].trim()).padStart(2, "0");
    const end = String(parts[1].trim()).padStart(2, "0");
    return `${start}\n${end}`;
  }
  return ore;
};

// Împarte numele pe mai multe linii bazat pe lățimea disponibilă
const imparteNumePeLinii = (nume, maxWidth, fontSize, font = "Arial") => {
  if (!nume) return ["N/A"];
  
  // Creează un canvas temporar pentru a măsura lățimea textului
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px ${font}`;
  
  const cuvinte = nume.split(" ");
  const linii = [];
  let linieCurenta = "";
  
  for (const cuvant of cuvinte) {
    const testLinie = linieCurenta ? `${linieCurenta} ${cuvant}` : cuvant;
    const width = ctx.measureText(testLinie).width;
    
    if (width <= maxWidth) {
      linieCurenta = testLinie;
      } else {
      if (linieCurenta) {
        linii.push(linieCurenta);
      }
      // Verifică dacă cuvântul singur depășește lățimea
      if (ctx.measureText(cuvant).width > maxWidth) {
        // Împarte cuvântul pe caractere
        let cuvantPartit = "";
        for (const char of cuvant) {
          const testCuvant = cuvantPartit + char;
          if (ctx.measureText(testCuvant).width > maxWidth && cuvantPartit) {
            linii.push(cuvantPartit);
            cuvantPartit = char;
          } else {
            cuvantPartit = testCuvant;
          }
        }
        linieCurenta = cuvantPartit;
      } else {
        linieCurenta = cuvant;
      }
    }
  }
  
  if (linieCurenta) {
    linii.push(linieCurenta);
  }
  
  return linii.length > 0 ? linii : [nume];
};

const PlanificareLunaraDashboard = ({ lockedWorkplaceId, hideBackButton = false }) => {
  const [farmacii, setFarmacii] = useState([]);
  const [farmacieSelectata, setFarmacieSelectata] = useState("");
  const [angajati, setAngajati] = useState([]);
  const [planificare, setPlanificare] = useState({});
  const [luna, setLuna] = useState(new Date().getMonth() + 1);
  const [an, setAn] = useState(new Date().getFullYear());
  const [salveaza, setSalveaza] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [popup, setPopup] = useState(null);
  const popupRef = useRef(null);
  const navigate = useNavigate();
  const [loggedUser, setLoggedUser] = useState(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customOre, setCustomOre] = useState("");
  const [orePersonalizate, setOrePersonalizate] = useState([]); // Lista de ore personalizate salvate
  const [isDragging, setIsDragging] = useState(false);
  const [dragTura, setDragTura] = useState(null);
  const [draggedCells, setDraggedCells] = useState(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedPlanificare, setLastSavedPlanificare] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null); // ID-ul angajatului pentru rândul pe care se face hover
  const tableRef = useRef(null);

  // Obține user logat și setează farmacia
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setLoggedUser(user);
      
      // Dacă avem lockedWorkplaceId, folosim-l; altfel folosim workplaceId din user
      if (lockedWorkplaceId) {
        setFarmacieSelectata(lockedWorkplaceId);
      } else if (user.workplaceId) {
        const wpId = user.workplaceId._id || user.workplaceId;
        setFarmacieSelectata(wpId);
      }
    } catch (e) {
      console.error("Eroare user:", e);
    }
  }, [lockedWorkplaceId]);

  // Funcție pentru navigare înapoi
  const handleInapoi = () => {
    if (loggedUser?.role === "superadmin") {
      navigate("/adminmanager");
    } else if (loggedUser?.role === "admin") {
      navigate("/adminfarmacie");
      } else {
      navigate("/");
    }
  };

  // Încarcă farmacii (doar dacă nu avem lockedWorkplaceId)
  useEffect(() => {
    if (lockedWorkplaceId) return; // Nu încărcăm farmacii dacă avem lockedWorkplaceId
    
    fetch(`${API}/api/workplaces`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFarmacii(data);
          if (!farmacieSelectata && data.length > 0) {
            setFarmacieSelectata(data[0]._id);
          }
        }
      })
      .catch((e) => console.error("Eroare farmacii:", e));
  }, [lockedWorkplaceId]);

  // Încarcă angajați
  useEffect(() => {
    if (!farmacieSelectata) return;
    fetch(`${API}/api/users/by-workplace/${farmacieSelectata}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAngajati(data);
      })
      .catch((e) => console.error("Eroare angajați:", e));
  }, [farmacieSelectata]);

  // Încarcă planificare
  useEffect(() => {
    if (!farmacieSelectata) return;
    fetch(`${API}/api/schedule/${farmacieSelectata}/${an}/${luna}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.schedule) {
          setPlanificare(data.schedule);
          setLastSavedPlanificare(JSON.stringify(data.schedule));
          setHasUnsavedChanges(false);
        }
      })
      .catch((e) => console.error("Eroare planificare:", e));
  }, [farmacieSelectata, an, luna]);

  // Salvare automată în localStorage pentru sesiune
  useEffect(() => {
    if (farmacieSelectata && an && luna) {
      const key = `planificare_${farmacieSelectata}_${an}_${luna}`;
      localStorage.setItem(key, JSON.stringify(planificare));
    }
  }, [planificare, farmacieSelectata, an, luna]);

  // Verifică modificări nesalvate
  useEffect(() => {
    const currentPlanificare = JSON.stringify(planificare);
    const hasChanges = currentPlanificare !== lastSavedPlanificare;
    setHasUnsavedChanges(hasChanges);
  }, [planificare, lastSavedPlanificare]);

  // Avertisment când părăsește pagina cu modificări nesalvate
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "Ai modificări nesalvate! Ești sigur că vrei să părăsești pagina?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Încarcă orele personalizate salvate din localStorage
  useEffect(() => {
    const saved = localStorage.getItem("orePersonalizate");
    if (saved) {
      try {
        setOrePersonalizate(JSON.parse(saved));
      } catch (e) {
        console.error("Eroare la încărcarea orelor personalizate:", e);
      }
    }
  }, []);

  // Șterge orele personalizate când se închide sesiunea (logout sau închidere browser)
  useEffect(() => {
    // Verifică dacă user-ul există în localStorage
    const user = localStorage.getItem("user");
    if (!user) {
      // Dacă nu există user, șterge orele personalizate
      localStorage.removeItem("orePersonalizate");
      setOrePersonalizate([]);
    }
  }, [loggedUser]);

  // Șterge orele personalizate când se închide browserul/tab-ul
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem("orePersonalizate");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Zilele lunii
  const zileLuna = () => {
    const zile = [];
    const numarZile = new Date(an, luna, 0).getDate();
    for (let i = 1; i <= numarZile; i++) {
      const data = new Date(an, luna - 1, i);
      zile.push({
        zi: i,
        data: data,
        ziSaptamana: data.toLocaleDateString("ro-RO", { weekday: "short" }),
        weekend: data.getDay() === 0 || data.getDay() === 6,
      });
    }
    return zile;
  };

  const zile = zileLuna();
  const numeLuna = new Date(an, luna - 1, 1).toLocaleDateString("ro-RO", {
        month: "long",
        year: "numeric",
  });

  const cheieData = (data) => {
    const d = new Date(data);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Click pe celulă
  const clickCelula = (angajatId, data, e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const cheie = cheieData(data);
    const turaCurenta = planificare[angajatId]?.[cheie];
    // Dacă există deja ore custom, le preîncărcăm în input
    if (turaCurenta && turaCurenta.startsWith("custom:")) {
      setCustomOre(turaCurenta.replace("custom:", ""));
    } else {
      setCustomOre("");
    }
    setShowCustomInput(false);
    setPopup({
      angajatId,
      cheie: cheie,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  // Mouse down pe celulă - începe drag-ul dacă celula are deja o tură
  const handleCellMouseDown = (angajatId, data, e) => {
    if (e.button !== 0) return; // Doar click stânga
    const cheie = cheieData(data);
    const turaId = planificare[angajatId]?.[cheie];
    
    if (turaId) {
      // Dacă celula are deja o tură, începe drag-ul
      setIsDragging(true);
      setDragTura(turaId);
      setDraggedCells(new Set([`${angajatId}-${cheie}`]));
      e.preventDefault(); // Previne selectarea textului
    }
  };

  // Selectează tură
  const selecteazaTura = (turaId) => {
    if (!popup) return;
    const { angajatId, cheie } = popup;
    
    // Dacă este o oră personalizată, o salvăm în lista de ore personalizate
    if (turaId && turaId.startsWith("custom:")) {
      const ore = turaId.replace("custom:", "");
      setOrePersonalizate((prev) => {
        const nou = [...prev];
        if (!nou.includes(ore)) {
          nou.push(ore);
          // Salvează în localStorage
          localStorage.setItem("orePersonalizate", JSON.stringify(nou));
        }
        return nou;
      });
    }
    
    setPlanificare((prev) => ({
      ...prev,
      [angajatId]: {
        ...(prev[angajatId] || {}),
        [cheie]: turaId,
      },
    }));
    
    setPopup(null);
    setShowCustomInput(false);
    setCustomOre("");
  };

  // Gestionează drag-ul peste o celulă
  const handleCellMouseEnter = (angajatId, data, e) => {
    if (!isDragging || !dragTura) return;
    
    const cheie = cheieData(data);
    const cellKey = `${angajatId}-${cheie}`;
    
    setDraggedCells((prev) => {
      const nou = new Set(prev);
      nou.add(cellKey);
      return nou;
    });
    
    // Aplică tura imediat
    setPlanificare((prev) => ({
      ...prev,
      [angajatId]: {
        ...(prev[angajatId] || {}),
        [cheie]: dragTura,
      },
    }));
  };

  // Oprește drag-ul
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragTura(null);
        setDraggedCells(new Set());
      }
    };

    if (isDragging) {
      document.addEventListener("mouseup", handleMouseUp);
      return () => document.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isDragging]);

  // Șterge o oră personalizată
  const stergeOrePersonalizata = (ore) => {
    setOrePersonalizate((prev) => {
      const nou = prev.filter((o) => o !== ore);
      localStorage.setItem("orePersonalizate", JSON.stringify(nou));
      return nou;
    });
  };

  // Șterge tură
  const stergeTura = () => {
    if (!popup) return;
    const { angajatId, cheie } = popup;
    setPlanificare((prev) => {
      const angPlan = { ...(prev[angajatId] || {}) };
      delete angPlan[cheie];
      const nou = { ...prev };
      if (Object.keys(angPlan).length === 0) {
        delete nou[angajatId];
      } else {
        nou[angajatId] = angPlan;
      }
      return nou;
    });
    setPopup(null);
  };

  // Obține tură pentru celulă
  const obtineTura = (angajatId, data) => {
    const cheie = cheieData(data);
    return planificare[angajatId]?.[cheie] || null;
  };

  // Generează o culoare verde bazată pe un string (pentru ore personalizate)
  const genereazaCuloareVerde = (str) => {
    // Hash simplu pentru a genera un număr consistent
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    // Generează nuanțe FOARTE diferite de verde
    // Hue: 100-180 (de la verde-gălbui la verde-cyan)
    const hue = 100 + (hash % 80); // 100-180 pentru verde variat
    
    // Saturation: 50-100% pentru culori foarte vibrante și distinctive
    const saturation = 50 + (hash % 51); // 50-100%
    
    // Lightness: 20-70% pentru diferențe FOARTE mari (de la foarte închis la foarte deschis)
    const lightness = 20 + (hash % 51); // 20-70% - diferențe mari între închis și deschis
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const infoTura = (turaId) => {
    // Verifică dacă este ore custom
    if (turaId && turaId.startsWith("custom:")) {
      const ore = turaId.replace("custom:", "");
      return {
        id: "custom",
        nume: "Ore custom",
        ore: ore,
        culoareHex: genereazaCuloareVerde(ore), // Culoare verde generată pentru ore custom
      };
    }
    const tura = TURE.find((t) => t.id === turaId);
    if (!tura) return null;
    // Convertim culoarea Tailwind la hex
    const culori = {
      "bg-blue-500": "#3b82f6",
      "bg-green-500": "#10b981",
      "bg-purple-500": "#a855f7",
    };
    return {
      ...tura,
      culoareHex: culori[tura.culoare] || "#3b82f6",
    };
  };

  // Marchează toți cu o tură
  const marcheazaToti = (turaId) => {
    setPlanificare((prev) => {
      const nou = { ...prev };
      angajati.forEach((ang) => {
        if (!ang._id) return;
        const angPlan = { ...(nou[ang._id] || {}) };
        zile.forEach((z) => {
          const cheie = cheieData(z.data);
          angPlan[cheie] = turaId;
        });
        nou[ang._id] = angPlan;
      });
      return nou;
    });
  };

  // Șterge tot
  const stergeTot = () => {
    if (window.confirm("Ești sigur că vrei să ștergi toată planificarea?")) {
      setPlanificare({});
    }
  };

  // Salvează
  const salveazaPlanificare = async () => {
    if (!farmacieSelectata) return;
    setSalveaza(true);
    setMesaj("");
    try {
      const res = await fetch(`${API}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workplaceId: farmacieSelectata,
          year: an,
          month: luna,
          schedule: planificare,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare");
      setMesaj("Salvat cu succes!");
      setLastSavedPlanificare(JSON.stringify(planificare));
      setHasUnsavedChanges(false);
      setTimeout(() => setMesaj(""), 3000);
    } catch (e) {
      setMesaj("Eroare: " + e.message);
    } finally {
      setSalveaza(false);
    }
  };

  // Descarcă planificarea ca PDF
  const descarcaPDF = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      // A4 landscape: 297mm x 210mm = 842 points x 595 points
      const A4_LANDSCAPE_WIDTH = 842;  // 297mm în puncte
      const A4_LANDSCAPE_HEIGHT = 595;  // 210mm în puncte
      const page = pdfDoc.addPage([A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT]);
      const { width, height } = page.getSize();
      
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Dimensiuni optimizate pentru A4 landscape
      const margin = 15;
      const titleHeight = 35; // Spațiu pentru titlu și farmacie
      const employeeCellWidth = 55; // Lățime coloană angajat (reduc)
      
      // Calculează lățimea celulelor pentru zile dinamic
      const availableWidth = width - (2 * margin) - employeeCellWidth;
      const dayCellWidth = Math.floor(availableWidth / zile.length);
      
      // Calculează înălțimea disponibilă
      const availableHeight = height - (2 * margin) - titleHeight;
      const numRows = angajati.length + 1; // +1 pentru header
      
      // Facem celulele aproape pătrate: cellHeight ≈ dayCellWidth
      // Dar verificăm că încape pe pagină
      const maxCellHeight = Math.floor(availableHeight / numRows);
      const cellHeight = Math.min(dayCellWidth, maxCellHeight);
      
      let yPos = height - margin;
      
      // Titlu (mai mic)
      page.drawText(`Planificare Pontaj - ${numeLuna}`, {
        x: margin,
        y: yPos,
        size: 10,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      yPos -= 15;
      
      // Farmacie (mai mic)
      if (farmacieNume) {
        page.drawText(`Farmacie: ${farmacieNume}`, {
          x: margin,
          y: yPos,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPos -= 12;
      }
      
      // TABEL: Angajați pe rânduri, Zile pe coloane (landscape)
      let xPos = margin;
      
      // Header: Coloana "Angajat" + coloane cu zile
      // Celula "Angajat" (colț stânga sus)
      page.drawRectangle({
        x: xPos,
        y: yPos - cellHeight,
        width: employeeCellWidth,
        height: cellHeight,
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      page.drawText("Angajat", {
        x: xPos + 2,
        y: yPos - cellHeight + (cellHeight / 2) - 3,
        size: 6,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      xPos += employeeCellWidth;
      
      // Header cu zile (coloane)
      zile.forEach((z) => {
        page.drawRectangle({
          x: xPos,
          y: yPos - cellHeight,
          width: dayCellWidth,
          height: cellHeight,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
          color: z.weekend ? rgb(1, 0.95, 0.8) : rgb(0.9, 0.9, 0.9),
        });
        // Ziua săptămânii (deasupra) - în PDF Y crește de jos în sus
        const ziSaptamanaText = z.ziSaptamana ? z.ziSaptamana.toUpperCase() : "";
        const ziSaptamanaSize = 7; // Mărit de la 5 la 7
        const ziSaptamanaWidth = helveticaBoldFont.widthOfTextAtSize(ziSaptamanaText, ziSaptamanaSize);
        page.drawText(ziSaptamanaText, {
          x: xPos + (dayCellWidth / 2) - (ziSaptamanaWidth / 2),
          y: yPos - cellHeight + (cellHeight / 2) - 7,
          size: ziSaptamanaSize,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
        });
        // Numărul zilei (dedesubt) - în PDF Y crește de jos în sus
        const ziText = String(z.zi);
        const ziSize = 8; // Mărit de la 6 la 8
        const ziWidth = helveticaBoldFont.widthOfTextAtSize(ziText, ziSize);
        page.drawText(ziText, {
          x: xPos + (dayCellWidth / 2) - (ziWidth / 2),
          y: yPos - cellHeight + (cellHeight / 2) + 5,
          size: ziSize,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
        });
        xPos += dayCellWidth;
      });
      
      yPos -= cellHeight;
      
      // Rânduri cu angajați
      angajati.forEach((ang) => {
        xPos = margin;
        
        // Coloana cu numele angajatului
        page.drawRectangle({
          x: xPos,
          y: yPos - cellHeight,
          width: employeeCellWidth,
          height: cellHeight,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
          color: rgb(1, 1, 1),
        });
        // Desenează numele pe mai multe linii
        const numeLinii = imparteNumePeLinii(ang.name || "N/A", employeeCellWidth - 4, 6);
        const lineHeight = 7;
        const totalHeight = numeLinii.length * lineHeight;
        let startY = yPos - cellHeight + (cellHeight / 2) - (totalHeight / 2) + (lineHeight / 2);
        
        numeLinii.forEach((linie, idx) => {
          const linieWidth = helveticaFont.widthOfTextAtSize(linie, 6);
          page.drawText(linie, {
            x: xPos + 2,
            y: startY + (idx * lineHeight),
            size: 6,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        });
        xPos += employeeCellWidth;
        
        // Celule cu ture pentru fiecare zi (coloane)
        zile.forEach((z) => {
          const turaId = obtineTura(ang._id, z.data);
          const tura = infoTura(turaId);
          
          // Fundal gri deschis pentru zilele lucrătoare, gri puțin mai închis pentru weekend
          const bgColor = z.weekend ? rgb(0.82, 0.83, 0.86) : rgb(0.95, 0.96, 0.97); // #d1d5db pentru weekend, #f3f4f6 pentru zile lucrătoare
          
          page.drawRectangle({
            x: xPos,
            y: yPos - cellHeight,
            width: dayCellWidth,
            height: cellHeight,
            color: bgColor,
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          
          if (tura) {
            // Text pe două linii, una peste alta (ex: "9\n10")
            const oreFormatate = formateazaOreStacked(tura.ore);
            if (oreFormatate && oreFormatate !== "○") {
              const parts = oreFormatate.split("\n");
              const textSize = Math.min(11, cellHeight * 0.35); // Text mai mare
              
              if (parts.length === 2) {
                // Prima linie: "09"
                const line1 = parts[0];
                const line1Width = helveticaBoldFont.widthOfTextAtSize(line1, textSize);
                page.drawText(line1, {
                  x: xPos + (dayCellWidth / 2) - (line1Width / 2),
                  y: yPos - cellHeight + (cellHeight / 2) + 3,
                  size: textSize,
                  font: helveticaBoldFont,
                  color: rgb(0.29, 0.29, 0.29), // Nuanță mai deschisă de negru (#4a4a4a)
                });
                
                // A doua linie: "10" (aproape lipită de prima)
                const line2 = parts[1];
                const line2Width = helveticaBoldFont.widthOfTextAtSize(line2, textSize);
                page.drawText(line2, {
                  x: xPos + (dayCellWidth / 2) - (line2Width / 2),
                  y: yPos - cellHeight + (cellHeight / 2) - (textSize * 0.7),
                  size: textSize,
                  font: helveticaBoldFont,
                  color: rgb(0.29, 0.29, 0.29), // Nuanță mai deschisă de negru (#4a4a4a)
                });
              } else {
                // Fallback pentru format vechi
                const textWidth = helveticaBoldFont.widthOfTextAtSize(oreFormatate, textSize);
                page.drawText(oreFormatate, {
                  x: xPos + (dayCellWidth / 2) - (textWidth / 2),
                  y: yPos - cellHeight + (cellHeight / 2) - (textSize / 2) + 2,
                  size: textSize,
                  font: helveticaBoldFont,
                  color: rgb(0.29, 0.29, 0.29), // Nuanță mai deschisă de negru (#4a4a4a)
                });
              }
            }
          }
          
          xPos += dayCellWidth;
        });
        
        yPos -= cellHeight;
      });
      
      // Salvează PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const fileName = `Planificare_${farmacieNume || "Farmacie"}_${an}_${String(luna).padStart(2, "0")}.pdf`;
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Eroare la generarea PDF:", error);
      alert("Eroare la generarea PDF-ului: " + error.message);
    }
  };

  // Helper pentru conversia hex la rgb
  const hexToRgb = (hex) => {
    if (!hex) return rgb(0.95, 0.95, 0.95);
    if (hex.startsWith("hsl")) {
      // Dacă este HSL, convertim la RGB aproximativ
      const match = hex.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = parseInt(match[1]) / 360;
        const s = parseInt(match[2]) / 100;
        const l = parseInt(match[3]) / 100;
        // Conversie simplificată HSL to RGB
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;
        let r, g, b;
        if (h < 1/6) { r = c; g = x; b = 0; }
        else if (h < 2/6) { r = x; g = c; b = 0; }
        else if (h < 3/6) { r = 0; g = c; b = x; }
        else if (h < 4/6) { r = 0; g = x; b = c; }
        else if (h < 5/6) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return rgb(r + m, g + m, b + m);
      }
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      );
    }
    return rgb(0.95, 0.95, 0.95);
  };

  // Print direct
  const printPlanificare = () => {
    // Deschide dialogul de printare pentru print direct
    window.print();
  };

  // Descarcă planificarea ca imagine (PNG) optimizată pentru A4 - IDENTICĂ cu PDF-ul
  const descarcaImagine = async () => {
    try {
      // A4 landscape: 3508 x 2480 pixels la 300 DPI (identic cu PDF)
      const A4_WIDTH = 3508;
      const A4_HEIGHT = 2480;
      
      // Creează canvas A4
      const canvas = document.createElement("canvas");
      canvas.width = A4_WIDTH;
      canvas.height = A4_HEIGHT;
      const ctx = canvas.getContext("2d");

      // Fundal alb
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

      // Dimensiuni identice cu PDF-ul (convertite la pixels la 300 DPI)
      // PDF: 842 points x 595 points
      // 1 point = 1/72 inch, 300 DPI = 300 pixels/inch
      // 842 points = 842/72 * 300 = 3508.33 pixels ≈ 3508
      // 595 points = 595/72 * 300 = 2479.17 pixels ≈ 2480
      const margin = 15 * (300 / 72); // 15 points în pixels
      const titleHeight = 35 * (300 / 72); // 35 points în pixels
      const employeeCellWidth = 55 * (300 / 72); // 55 points în pixels
      
      // Calculează lățimea celulelor pentru zile (identic cu PDF)
      const availableWidth = A4_WIDTH - (2 * margin) - employeeCellWidth;
      const dayCellWidth = Math.floor(availableWidth / zile.length);
      
      // Calculează înălțimea disponibilă
      const availableHeight = A4_HEIGHT - (2 * margin) - titleHeight;
      const numRows = angajati.length + 1; // +1 pentru header
      
      // Facem celulele aproape pătrate (identic cu PDF)
      const maxCellHeight = Math.floor(availableHeight / numRows);
      const cellHeight = Math.min(dayCellWidth, maxCellHeight);
      
      // În canvas, Y crește de sus în jos, deci începem de sus
      let yPos = margin + titleHeight;

      // Titlu (identic cu PDF)
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${10 * (300 / 72)}px Arial`; // 10 points în pixels
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Planificare Pontaj - ${numeLuna}`, margin, margin);
      
      // Farmacie (identic cu PDF)
      if (farmacieNume) {
        ctx.font = `${8 * (300 / 72)}px Arial`; // 8 points în pixels
        ctx.fillText(`Farmacie: ${farmacieNume}`, margin, margin + 15 * (300 / 72));
      }

      // TABEL: Angajați pe rânduri, Zile pe coloane (identic cu PDF)
      let xPos = margin;

      // Header: Coloana "Angajat" + coloane cu zile
      // Celula "Angajat" (colț stânga sus)
      ctx.fillStyle = "#e6e6e6"; // rgb(0.9, 0.9, 0.9)
      ctx.fillRect(xPos, yPos, employeeCellWidth, cellHeight);
      ctx.strokeStyle = "#808080"; // rgb(0.5, 0.5, 0.5)
      ctx.lineWidth = 0.5 * (300 / 72);
      ctx.strokeRect(xPos, yPos, employeeCellWidth, cellHeight);
      
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${6 * (300 / 72)}px Arial`; // 6 points în pixels
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Angajat", xPos + 2 * (300 / 72), yPos + (cellHeight / 2));
      xPos += employeeCellWidth;

      // Header cu zile (coloane)
      zile.forEach((z) => {
        const bgColor = z.weekend ? "#d1d5db" : "#e6e6e6"; // rgb(0.82, 0.83, 0.86) pentru weekend, rgb(0.9, 0.9, 0.9) pentru zile lucrătoare
        ctx.fillStyle = bgColor;
        ctx.fillRect(xPos, yPos, dayCellWidth, cellHeight);
        ctx.strokeStyle = "#808080";
        ctx.lineWidth = 0.5 * (300 / 72);
        ctx.strokeRect(xPos, yPos, dayCellWidth, cellHeight);
        
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Ziua săptămânii (deasupra) - în canvas Y crește de sus în jos
        const ziSaptamanaText = z.ziSaptamana ? z.ziSaptamana.toUpperCase() : "";
        ctx.font = `bold ${7 * (300 / 72)}px Arial`; // Mărit de la 5 la 7
        ctx.fillText(ziSaptamanaText, xPos + (dayCellWidth / 2), yPos + (cellHeight / 2) - 7 * (300 / 72));
        
        // Numărul zilei (dedesubt) - în canvas Y crește de sus în jos
        ctx.font = `bold ${8 * (300 / 72)}px Arial`; // Mărit de la 6 la 8
        ctx.fillText(String(z.zi), xPos + (dayCellWidth / 2), yPos + (cellHeight / 2) + 5 * (300 / 72));
        
        xPos += dayCellWidth;
      });

      yPos += cellHeight;

      // Rânduri cu angajați
      angajati.forEach((ang) => {
        xPos = margin;

        // Coloana cu numele angajatului
        ctx.fillStyle = "#ffffff"; // rgb(1, 1, 1)
        ctx.fillRect(xPos, yPos, employeeCellWidth, cellHeight);
        ctx.strokeStyle = "#808080";
        ctx.lineWidth = 0.5 * (300 / 72);
        ctx.strokeRect(xPos, yPos, employeeCellWidth, cellHeight);
        
        // Desenează numele pe mai multe linii
        const fontSize = 6 * (300 / 72);
        const numeLinii = imparteNumePeLinii(ang.name || "N/A", employeeCellWidth - 4 * (300 / 72), fontSize);
        const lineHeight = 7 * (300 / 72);
        const totalHeight = numeLinii.length * lineHeight;
        let startY = yPos + (cellHeight / 2) - (totalHeight / 2) + (lineHeight / 2);
        
        ctx.fillStyle = "#000000";
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        numeLinii.forEach((linie, idx) => {
          ctx.fillText(linie, xPos + 2 * (300 / 72), startY + (idx * lineHeight));
        });
        
        xPos += employeeCellWidth;

        // Celule cu ture pentru fiecare zi (coloane)
        zile.forEach((z) => {
          const turaId = obtineTura(ang._id, z.data);
          const tura = infoTura(turaId);

          // Fundal gri deschis pentru zilele lucrătoare, gri puțin mai închis pentru weekend (identic cu PDF)
          const bgColor = z.weekend ? "#d1d5db" : "#f3f4f6"; // rgb(0.82, 0.83, 0.86) pentru weekend, rgb(0.95, 0.96, 0.97) pentru zile lucrătoare
          
          ctx.fillStyle = bgColor;
          ctx.fillRect(xPos, yPos, dayCellWidth, cellHeight);
          ctx.strokeStyle = "#808080";
          ctx.lineWidth = 0.5 * (300 / 72);
          ctx.strokeRect(xPos, yPos, dayCellWidth, cellHeight);

          if (tura) {
            // Text pe două linii, una peste alta (identic cu PDF)
            const oreFormatate = formateazaOreStacked(tura.ore);
            if (oreFormatate && oreFormatate !== "○") {
              const parts = oreFormatate.split("\n");
              const textSize = Math.min(11 * (300 / 72), cellHeight * 0.35); // Text mai mare, convertit la pixels
              
              if (parts.length === 2) {
                ctx.fillStyle = "#4a4a4a"; // Nuanță mai deschisă de negru
                ctx.font = `bold ${textSize}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                
                // Prima linie: "09" (deasupra centrului) - identic cu PDF
                const line1 = parts[0];
                const offset = textSize * 0.4; // Spațiere între cifre (puțin mai mare decât 0.35 pentru a nu fi prea lipite)
                ctx.fillText(line1, xPos + (dayCellWidth / 2), yPos + (cellHeight / 2) - offset);
                
                // A doua linie: "10" (sub centru) - identic cu PDF
                const line2 = parts[1];
                ctx.fillText(line2, xPos + (dayCellWidth / 2), yPos + (cellHeight / 2) + offset);
              } else {
                // Dacă nu are formatul așteptat, afișează textul normal
                ctx.fillText(oreFormatate, xPos + (dayCellWidth / 2), yPos + (cellHeight / 2));
              }
            }
          }
          
          xPos += dayCellWidth;
        });

        yPos += cellHeight;
      });

      // Descarcă
      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = `Planificare_${farmacieNume || "Farmacie"}_${an}_${String(luna).padStart(2, "0")}.png`;
          saveAs(blob, fileName);
        } else {
          alert("Eroare la generarea imaginii!");
        }
      }, "image/png", 1.0);
    } catch (error) {
      console.error("Eroare la generarea imaginii:", error);
      alert("Eroare la generarea imaginii: " + error.message);
    }
  };

  // Închide popup la click în afară
  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopup(null);
      }
    };
    if (popup) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [popup]);

  // Obține numele farmaciei
  const [farmacieNume, setFarmacieNume] = useState("");
  
  useEffect(() => {
    if (lockedWorkplaceId && farmacieSelectata) {
      // Încarcă numele farmaciei dacă avem lockedWorkplaceId
      fetch(`${API}/api/workplaces`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const found = data.find((f) => f._id === farmacieSelectata);
            if (found) setFarmacieNume(found.name);
          }
        })
        .catch((e) => console.error("Eroare farmacii:", e));
    } else {
      const found = farmacii.find((f) => f._id === farmacieSelectata);
      setFarmacieNume(found?.name || "");
    }
  }, [farmacieSelectata, farmacii, lockedWorkplaceId]);

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div style={{ padding: "16px", backgroundColor: "#f9fafb", minHeight: "100vh" }} className="print-content">
      <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* HEADER */}
        <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {!hideBackButton && (
                <button
                  type="button"
                  onClick={handleInapoi}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#6b7280",
                    color: "white",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#4b5563"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#6b7280"}
                >
                  ← ÎNAPOI
                </button>
              )}
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1f2937", margin: 0 }}>Planificare Pontaj - {numeLuna}</h1>
                <p style={{ color: "#4b5563", fontSize: "14px", marginTop: "4px", margin: 0 }}>Click pe celule pentru a selecta tura</p>
            </div>
          </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {!lockedWorkplaceId ? (
                <select
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    backgroundColor: "white",
                    fontSize: "14px",
                    color: "#1f2937",
                  }}
                  value={farmacieSelectata}
                  onChange={(e) => setFarmacieSelectata(e.target.value)}
                >
                  {farmacii.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  backgroundColor: "#f3f4f6",
                  fontSize: "14px",
                  color: "#1f2937",
                }}>
                  {farmacieNume || "Farmacie"}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "white", padding: "4px" }}>
              <button
                type="button"
                onClick={() => {
                    if (luna === 1) {
                      setLuna(12);
                      setAn(an - 1);
                    } else {
                      setLuna(luna - 1);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    color: "#4b5563",
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                ←
              </button>
                <span style={{ padding: "0 12px", fontSize: "14px", fontWeight: "500", minWidth: "150px", textAlign: "center", color: "#1f2937" }}>{numeLuna}</span>
              <button
                type="button"
                onClick={() => {
                    if (luna === 12) {
                      setLuna(1);
                      setAn(an + 1);
                    } else {
                      setLuna(luna + 1);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    color: "#4b5563",
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                →
              </button>
            </div>
          </div>
            </div>
              </div>

        {/* BUTOANE RAPIDE */}
        {angajati.length > 0 && (
          <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-start" }}>
                    <button
                      type="button"
                onClick={() => marcheazaToti("tura1")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#10b981",
                  color: "white",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
              >
                Marchează toți (7-14)
                    </button>
              <button
                type="button"
                onClick={() => marcheazaToti("tura2")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#10b981",
                  color: "white",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
              >
                Marchează toți (8-15)
              </button>
              <button
                type="button"
                onClick={() => marcheazaToti("tura3")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#10b981",
                  color: "white",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
              >
                Marchează toți (9-16)
              </button>
              <button
                type="button"
                onClick={stergeTot}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#dc2626"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ef4444"}
              >
                Șterge tot
              </button>
              </div>
            </div>
        )}

        {/* MESAJ */}
        {mesaj && (
          <div className={`rounded-lg p-3 ${mesaj.includes("Eroare") ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
            <p className={`text-sm ${mesaj.includes("Eroare") ? "text-red-800" : "text-green-800"}`}>{mesaj}</p>
            </div>
          )}

        {/* CALENDAR */}
        {angajati.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">Nu există angajați pentru farmacia selectată</p>
            </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-indigo-600 text-white px-6 py-3">
              <h2 className="font-bold">Planificare pentru {farmacieNume}</h2>
              <p className="text-sm text-indigo-100">{angajati.length} angajat{angajati.length !== 1 ? "i" : ""}</p>
            </div>
            <div className="overflow-x-auto relative" ref={tableRef}>
              <table className="border-collapse" style={{ width: "auto", tableLayout: "fixed" }}>
                <thead>
                  <tr className="bg-gray-100">
                    <th 
                      className="px-4 py-3 text-left font-bold text-gray-700 min-w-[200px] border-r-2 border-gray-300"
                      style={{ 
                        position: "sticky",
                        left: 0,
                        zIndex: 110,
                        backgroundColor: "#f3f4f6",
                        boxShadow: "2px 0 4px rgba(0,0,0,0.1)"
                      }}
                    >
                      Angajat
                          </th>
                    {zile.map((z) => (
                      <th
                        key={z.zi}
                        className="px-1 py-2 text-center font-semibold border-r border-gray-200"
                        style={{
                          width: "45px",
                          minWidth: "45px",
                          maxWidth: "45px",
                          height: "50px",
                          backgroundColor: z.weekend ? "#fde68a" : "#fef9c3",
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs uppercase">{z.ziSaptamana}</span>
                          <span className="text-sm font-bold">{z.zi}</span>
                          </div>
                        </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {angajati.map((ang, idx) => {
                    const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
                          return (
                      <tr key={ang._id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td 
                          className="px-4 py-3 border-r-2 border-gray-300"
                          style={{ 
                            position: "sticky",
                            left: 0,
                            zIndex: 110,
                            backgroundColor: hoveredRow === ang._id ? "#e5e7eb" : bgColor,
                            boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={() => setHoveredRow(ang._id)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <div style={{ position: "relative", zIndex: 111 }}>
                            <div className="font-bold text-gray-900" style={{ 
                              whiteSpace: "pre-line", 
                              lineHeight: "1.2",
                              fontSize: "12px",
                              position: "relative",
                              zIndex: 112
                            }}>
                              {imparteNumePeLinii(ang.name || "N/A", 180, 12).join("\n")}
                            </div>
                          </div>
                            </td>
                        {zile.map((z) => {
                          const turaId = obtineTura(ang._id, z.data);
                          const tura = infoTura(turaId);
                          const cellKey = `${ang._id}-${cheieData(z.data)}`;
                          const isDragged = draggedCells.has(cellKey);
                        return (
                          <td
                              key={z.zi} 
                              className="px-1 py-2 text-center border-r border-gray-200"
                              style={{
                                width: "45px",
                                minWidth: "45px",
                                maxWidth: "45px",
                                height: "52px",
                                padding: "2px",
                                backgroundColor: hoveredRow === ang._id ? "#e5e7eb" : "transparent",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={() => setHoveredRow(ang._id)}
                              onMouseLeave={() => setHoveredRow(null)}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (!isDragging) {
                                    clickCelula(ang._id, z.data, e);
                                  }
                                }}
                                onMouseDown={(e) => handleCellMouseDown(ang._id, z.data, e)}
                                onMouseEnter={(e) => handleCellMouseEnter(ang._id, z.data, e)}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  minHeight: "48px",
                                  maxHeight: "48px",
                                  borderRadius: "4px",
                                  border: tura ? "2px solid transparent" : "2px solid #d1d5db",
                                  backgroundColor: z.weekend ? "#d1d5db" : "#f3f4f6",
                                  color: "#4a4a4a", // Nuanță mai deschisă de negru
                                  fontWeight: "bold",
                                  cursor: isDragging ? "crosshair" : (tura ? "grab" : "pointer"),
                                  opacity: isDragged && isDragging ? 0.8 : 1,
                                  userSelect: "none",
                                  position: "relative",
                                  display: "block",
                                  fontSize: "18px",
                                  padding: "0",
                                  margin: "0",
                                  boxSizing: "border-box",
                                  textAlign: "center",
                                }}
                                onMouseOver={(e) => {
                                  if (!isDragging) {
                                    setHoveredRow(ang._id);
                                    e.currentTarget.style.backgroundColor = z.weekend ? "#c4c8cc" : "#e5e7eb";
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (!isDragging) {
                                    setHoveredRow(null);
                                    e.currentTarget.style.backgroundColor = z.weekend ? "#d1d5db" : "#f3f4f6";
                                  }
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    lineHeight: "0.95",
                                    whiteSpace: "pre-line",
                                    textAlign: "center",
                                    width: "100%",
                                  }}
                                >
                                  {tura ? formateazaOreStacked(tura.ore) : "○"}
                                </span>
                              </button>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}

        {/* POPUP */}
        {popup && (
          <>
            <div
              className="fixed inset-0 z-[9998] bg-transparent"
              onClick={() => {
                setPopup(null);
                setShowCustomInput(false);
                setCustomOre("");
              }}
            />
            <div
              ref={popupRef}
              className="fixed z-[9999] bg-white rounded-lg shadow-2xl border-2 border-indigo-300"
              style={{
                left: `${popup.x}px`,
                top: `${popup.y}px`,
                transform: "translate(-50%, -50%)",
                minWidth: "200px",
                padding: "12px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#1f2937", marginBottom: "8px", paddingBottom: "6px", borderBottom: "1px solid #d1d5db" }}>
                Selectează tura:
              </div>
              {!showCustomInput ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selecteazaTura("tura1");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                    onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    Tură 1 (7-14)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selecteazaTura("tura2");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#10b981",
                      color: "white",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                    onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    Tură 2 (8-15)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selecteazaTura("tura3");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#a855f7",
                      color: "white",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                    onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    Tură 3 (9-16)
                  </button>
                  {orePersonalizate.length > 0 && (
                    <div style={{ marginTop: "4px", marginBottom: "4px", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", fontWeight: "600" }}>
                        Ore personalizate:
                      </div>
                      {orePersonalizate.map((ore) => {
                        const culoareVerde = genereazaCuloareVerde(ore);
                        return (
                          <div key={ore} style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                selecteazaTura(`custom:${ore}`);
                              }}
                              style={{
                                flex: 1,
                                textAlign: "left",
                                padding: "6px 10px",
                                borderRadius: "4px",
                                backgroundColor: culoareVerde,
                                color: "white",
                                fontWeight: "bold",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                              onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                              onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                            >
                              {ore}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                stergeOrePersonalizata(ore);
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "4px",
                                backgroundColor: "#ef4444",
                                color: "white",
                                fontWeight: "bold",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#dc2626"}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ef4444"}
                              title="Șterge această oră personalizată"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCustomInput(true);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#f59e0b",
                      color: "white",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                    onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    + Ore personalizate
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      stergeTura();
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#e5e7eb",
                      color: "#374151",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#d1d5db"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#e5e7eb"}
                  >
                    Șterge
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", display: "block" }}>
                      Introdu orele (ex: 10-18, 8-14, etc.)
                    </label>
                    <input
                      type="text"
                      value={customOre}
                      onChange={(e) => setCustomOre(e.target.value)}
                      placeholder="ex: 10-18"
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customOre.trim()) {
                          selecteazaTura(`custom:${customOre.trim()}`);
                        } else if (e.key === "Escape") {
                          setShowCustomInput(false);
                          setCustomOre("");
                        }
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (customOre.trim()) {
                          selecteazaTura(`custom:${customOre.trim()}`);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "4px",
                        backgroundColor: "#f59e0b",
                        color: "white",
                        fontWeight: "bold",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                      onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                    >
                      Salvează
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowCustomInput(false);
                        setCustomOre("");
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "4px",
                        backgroundColor: "#e5e7eb",
                        color: "#374151",
                        fontWeight: "bold",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#d1d5db"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#e5e7eb"}
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              )}
            </div>
              </>
            )}

        {/* FOOTER */}
        <div className="bg-white rounded-lg shadow p-6 print:hidden">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">Cum funcționează:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Click pe celulă pentru a selecta tura</li>
                  <li>Click din nou pentru a schimba sau șterge</li>
                  <li>Click și trage pentru a completa mai multe celule</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 justify-start flex-wrap">
              <button
                onClick={descarcaPDF}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  fontWeight: "600",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#059669"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#10b981"}
              >
                📥 Descarcă PDF
          </button>
              <button
                onClick={descarcaImagine}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  fontWeight: "600",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#059669"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#10b981"}
              >
                🖼️ Descarcă Imagine
              </button>
              <button
                onClick={salveazaPlanificare}
                disabled={salveaza || angajati.length === 0}
                style={{
                  padding: "8px 24px",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  fontWeight: "700",
                  borderRadius: "8px",
                  border: "none",
                  cursor: salveaza || angajati.length === 0 ? "not-allowed" : "pointer",
                  opacity: salveaza || angajati.length === 0 ? 0.5 : 1,
                }}
                onMouseOver={(e) => {
                  if (!salveaza && angajati.length > 0) {
                    e.currentTarget.style.backgroundColor = "#059669";
                  }
                }}
                onMouseOut={(e) => {
                  if (!salveaza && angajati.length > 0) {
                    e.currentTarget.style.backgroundColor = "#10b981";
                  }
                }}
              >
                {salveaza ? "Se salvează..." : "💾 Salvează planificarea"}
              </button>
              {hasUnsavedChanges && (
                <div className="px-4 py-2 bg-amber-100 border border-amber-300 rounded-lg">
                  <p className="text-sm text-amber-800 font-medium">
                    ⚠️ Ai modificări nesalvate!
                  </p>
      </div>
              )}
    </div>
    </div>
        </div>
      </div>
    </div>
    <UserGuide />
    </>
  );
};

export default PlanificareLunaraDashboard;


