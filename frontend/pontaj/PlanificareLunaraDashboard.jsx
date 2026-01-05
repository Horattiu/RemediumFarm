import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000";

const TURE = [
  { id: "tura1", nume: "Tură 1", ore: "7-15", culoare: "bg-blue-500" },
  { id: "tura2", nume: "Tură 2", ore: "8-16", culoare: "bg-green-500" },
  { id: "tura3", nume: "Tură 3", ore: "9-17", culoare: "bg-purple-500" },
];

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
        if (data.schedule) setPlanificare(data.schedule);
      })
      .catch((e) => console.error("Eroare planificare:", e));
  }, [farmacieSelectata, an, luna]);

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
    setPopup({
      angajatId,
      cheie: cheieData(data),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  // Selectează tură
  const selecteazaTura = (turaId) => {
    if (!popup) return;
    const { angajatId, cheie } = popup;
    setPlanificare((prev) => ({
      ...prev,
      [angajatId]: {
        ...(prev[angajatId] || {}),
        [cheie]: turaId,
      },
    }));
    setPopup(null);
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

  const infoTura = (turaId) => {
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
      setTimeout(() => setMesaj(""), 3000);
    } catch (e) {
      setMesaj("Eroare: " + e.message);
    } finally {
      setSalveaza(false);
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
    <div style={{ padding: "16px", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => marcheazaToti("tura1")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3b82f6",
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
                Marchează toți (7-15)
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
                Marchează toți (8-16)
              </button>
              <button
                type="button"
                onClick={() => marcheazaToti("tura3")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#a855f7",
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
                Marchează toți (9-17)
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left font-bold text-gray-700 sticky left-0 bg-gray-100 z-10 min-w-[200px] border-r-2 border-gray-300">
                      Angajat
                    </th>
                    {zile.map((z) => (
                      <th
                        key={z.zi}
                        className={`px-2 py-3 text-center font-semibold min-w-[70px] border-r border-gray-200 ${z.weekend ? "bg-amber-50" : ""}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs uppercase">{z.ziSaptamana}</span>
                          <span className="text-base font-bold">{z.zi}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {angajati.map((ang, idx) => (
                    <tr key={ang._id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-3 sticky left-0 bg-inherit z-10 border-r-2 border-gray-300">
                        <div>
                          <div className="font-bold text-gray-900">{ang.name || "N/A"}</div>
                          {ang.function && <div className="text-xs text-gray-500">{ang.function}</div>}
                        </div>
                      </td>
                      {zile.map((z) => {
                        const turaId = obtineTura(ang._id, z.data);
                        const tura = infoTura(turaId);
                        return (
                          <td key={z.zi} className="px-1 py-2 text-center border-r border-gray-200">
                            <button
                              type="button"
                              onClick={(e) => clickCelula(ang._id, z.data, e)}
                              style={{
                                width: "100%",
                                minHeight: "50px",
                                borderRadius: "4px",
                                border: tura ? "2px solid transparent" : "2px solid #d1d5db",
                                backgroundColor: tura ? tura.culoareHex : "#f3f4f6",
                                color: tura ? "white" : "#9ca3af",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                              onMouseOver={(e) => {
                                if (!tura) {
                                  e.currentTarget.style.backgroundColor = "#e5e7eb";
                                }
                              }}
                              onMouseOut={(e) => {
                                if (!tura) {
                                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                                }
                              }}
                            >
                              {tura ? tura.ore : "○"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
              onClick={() => setPopup(null)}
            />
            <div
              ref={popupRef}
              className="fixed z-[9999] bg-white rounded-lg shadow-2xl border-2 border-indigo-300"
              style={{
                left: `${popup.x}px`,
                top: `${popup.y}px`,
                transform: "translate(-50%, -50%)",
                minWidth: "180px",
                padding: "8px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#1f2937", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid #d1d5db" }}>
                Selectează tura:
              </div>
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
                  Tură 1 (7-15)
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
                  Tură 2 (8-16)
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
                  Tură 3 (9-17)
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
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Cum funcționează:</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Click pe celulă pentru a selecta tura</li>
                <li>Click din nou pentru a schimba sau șterge</li>
              </ul>
            </div>
            <button
              onClick={salveazaPlanificare}
              disabled={salveaza || angajati.length === 0}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salveaza ? "Se salvează..." : "Salvează planificarea"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanificareLunaraDashboard;

