import React, { useState } from 'react';

interface Guide {
  title: string;
  content: string;
  icon: string;
}

interface GuideCategory {
  title: string;
  icon: string;
  description: string;
  guides: Guide[];
}

type CategoryKey = 'concedii' | 'pontaj' | 'planificare' | 'erori' | 'utilizatori' | 'general';

const guideCategories: Record<CategoryKey, GuideCategory> = {
  concedii: {
    title: 'Concedii',
    icon: '📋',
    description: 'Gestionare cereri de concediu',
    guides: [
      {
        title: 'Gestionare concedii',
        content: "Aici puteți vedea toate cererile de concediu ale angajaților. Cererile noi apar cu status 'În așteptare' și trebuie aprobate sau respinse.",
        icon: '📋',
      },
      {
        title: 'Adăugare cerere nouă',
        content: "Apăsați butonul '+ Cerere nouă' pentru a crea o cerere de concediu. Completați toate câmpurile: angajat, tip concediu, perioadă și motiv.",
        icon: '➕',
      },
      {
        title: 'Aprobare/Respingere',
        content: "Pentru a aproba sau respinge o cerere, apăsați butonul corespunzător de pe fiecare card. Cererile aprobate vor apărea în calendar.",
        icon: '✅',
      },
      {
        title: 'Descărcare PDF',
        content: "Puteți descărca cererea de concediu în format PDF apăsând butonul 'Descarcă' de pe fiecare card. PDF-ul conține toate detaliile cererii.",
        icon: '📄',
      },
      {
        title: 'Editare cerere',
        content: "Pentru a edita o cerere existentă, apăsați butonul 'Editează'. Puteți modifica toate detaliile, dar nu puteți schimba angajatul.",
        icon: '✏️',
      },
    ],
  },
  pontaj: {
    title: 'Pontaj',
    icon: '⏰',
    description: 'Introducere pontaj zilnic',
    guides: [
      {
        title: 'Introducere pontaj',
        content: 'Această secțiune vă permite să introduceți pontajul zilnic pentru angajați. Selectați data și găsiți angajatul în listă.',
        icon: '⏰',
      },
      {
        title: 'Selectare dată',
        content: 'Folosiți câmpul de dată din partea de sus pentru a selecta ziua pentru care introduceți pontajul. Puteți selecta orice dată din trecut sau viitor.',
        icon: '📅',
      },
      {
        title: 'Status angajat',
        content: "Pentru fiecare angajat, selectați statusul: 'Prezent', 'Absent' sau 'Concediu'. Dacă este prezent, introduceți orele de intrare și ieșire.",
        icon: '👤',
      },
      {
        title: 'Ore lucrate',
        content: 'Orele lucrate se calculează automat pe baza orei de intrare și ieșire. Rezultatul apare în câmpul "Ore lucrate".',
        icon: '🕐',
      },
      {
        title: 'Ore rămase pe lună',
        content: 'În partea de sus veți vedea câte ore mai are de lucrat fiecare angajat pentru a atinge target-ul lunar (160 ore).',
        icon: '📊',
      },
      {
        title: 'Adăugare vizitator',
        content: "Dacă un angajat de la altă farmacie lucrează la farmacia dvs., apăsați 'Adaugă vizitator' și căutați-l după nume.",
        icon: '👥',
      },
    ],
  },
  planificare: {
    title: 'Planificare',
    icon: '📆',
    description: 'Planificare program lunar',
    guides: [
      {
        title: 'Planificare lunară',
        content: 'Această secțiune vă permite să planificați programul angajaților pentru întreaga lună. Fiecare celulă reprezintă o zi.',
        icon: '📆',
      },
      {
        title: 'Selectare tura',
        content: 'Apăsați pe o celulă pentru a selecta tura pentru acel angajat în acea zi. Puteți alege între: 7-14, 8-15 sau 9-16. Puteți adăuga și ore personalizate folosind butonul "+ Ore personalizate".',
        icon: '🔄',
      },
      {
        title: 'Marchează toți',
        content: "Butoanele 'Marchează toți' (7-14, 8-15, 9-16) vă permit să setați aceeași tură pentru toți angajații pentru toate zilele lucrătoare (exclude sâmbăta și duminica).",
        icon: '⚡',
      },
      {
        title: 'Ștergere program',
        content: 'Pentru a șterge programul unui angajat într-o anumită zi, apăsați din nou pe celula respectivă sau folosiți butonul de ștergere din meniul popup.',
        icon: '🗑️',
      },
      {
        title: 'Drag and drop',
        content: 'Puteți face click și trage (drag) pentru a completa rapid mai multe celule consecutive cu aceeași tură. Click pe o celulă cu tură, apoi trageți peste celulele dorite.',
        icon: '🖱️',
      },
      {
        title: 'Descărcare și salvare',
        content: "Puteți descărca planificarea ca PDF sau imagine. Nu uitați să salvați planificarea folosind butonul 'Salvează planificarea' pentru a păstra modificările.",
        icon: '💾',
      },
    ],
  },
  erori: {
    title: 'Erori și soluții',
    icon: '⚠️',
    description: 'Rezolvarea problemelor comune',
    guides: [
      {
        title: 'Conflict între pontaj și concediu',
        content: 'Dacă încercați să creați o cerere de concediu pentru o perioadă în care angajatul are deja pontaj introdus, veți primi un avertisment. Acest lucru previne inconsistențe în date.',
        icon: '⚠️',
      },
      {
        title: 'Cum rezolvi conflictul pontaj-concediu',
        content: 'Pentru a rezolva conflictul, aveți două opțiuni: 1) Ștergeți pontajul pentru perioada respectivă (butonul de ștergere apare lângă orele salvate), sau 2) Modificați perioada concediului pentru a evita zilele cu pontaj.',
        icon: '🔧',
      },
      {
        title: 'Conflict între concediu și pontaj',
        content: 'Dacă încercați să introduceți pontaj pentru o zi în care angajatul are concediu, veți primi un avertisment. Un angajat nu poate fi simultan în concediu și prezent la lucru.',
        icon: '⚠️',
      },
      {
        title: 'Cum rezolvi conflictul concediu-pontaj',
        content: 'Pentru a rezolva: 1) Ștergeți cererea de concediu pentru perioada respectivă, sau 2) Modificați data pontajului pentru a evita zilele cu concediu. Verificați calendarul de concedii înainte de a introduce pontajul.',
        icon: '🔧',
      },
      {
        title: 'Pontaj nu se salvează',
        content: "Dacă butonul 'Salvează' este dezactivat, verificați că: 1) Ați selectat statusul pentru fiecare angajat, 2) Pentru status 'Prezent', ați introdus orele de intrare și ieșire, 3) Nu există conflicte cu concediile.",
        icon: '💾',
      },
      {
        title: 'Concediu nu se salvează',
        content: 'Dacă nu puteți salva o cerere de concediu, verificați că: 1) Toate câmpurile sunt completate (angajat, funcție, date, tip, motiv), 2) Data de sfârșit nu este înainte de data de început, 3) Nu există conflicte cu pontajul existent.',
        icon: '💾',
      },
      {
        title: 'Angajat nu apare în listă',
        content: "Dacă un angajat nu apare în listă: 1) Verificați că a fost creat în secțiunea 'Gestionare utilizatori', 2) Asigurați-vă că aparține farmaciei corecte, 3) Reîncărcați pagina sau verificați filtrele de căutare.",
        icon: '👤',
      },
      {
        title: 'Date incorecte în rapoarte',
        content: "Dacă rapoartele arată date incorecte: 1) Verificați că pontajul a fost salvat corect (butonul 'Salvează' a fost apăsat), 2) Asigurați-vă că datele de concediu sunt corecte, 3) Reîncărcați datele sau contactați administratorul.",
        icon: '📊',
      },
    ],
  },
  utilizatori: {
    title: 'Gestionare utilizatori',
    icon: '👥',
    description: 'Creare și editare angajați',
    guides: [
      {
        title: 'Gestionare utilizatori',
        content: 'Această secțiune vă permite să creați, editați sau ștergeți angajați. Lista arată toți angajații farmaciei dvs.',
        icon: '👥',
      },
      {
        title: 'Creare angajat nou',
        content: "Apăsați 'Creează utilizator' pentru a adăuga un angajat nou. Completați numele, funcția și selectați farmacia. Target-ul lunar este setat automat la 160 ore.",
        icon: '➕',
      },
      {
        title: 'Editare angajat',
        content: "Apăsați 'Editează' pe cardul unui angajat pentru a modifica informațiile sale. Puteți schimba numele, funcția sau farmacia.",
        icon: '✏️',
      },
      {
        title: 'Ștergere angajat',
        content: "Apăsați 'Șterge' pentru a șterge un angajat. Atenție: această acțiune va șterge și toate concediile și pontajele asociate.",
        icon: '🗑️',
      },
    ],
  },
  general: {
    title: 'General',
    icon: 'ℹ️',
    description: 'Informații generale',
    guides: [
      {
        title: 'Bun venit în aplicație!',
        content: 'Această aplicație vă ajută să gestionați concediile și pontajul angajaților. Folosiți butonul de ajutor pentru a obține informații despre fiecare secțiune.',
        icon: '👋',
      },
      {
        title: 'Navigare în aplicație',
        content: 'Folosiți meniul din stânga pentru a naviga între secțiuni. Fiecare secțiune are un scop specific: Concedii, Pontaj, Planificare, etc.',
        icon: '🧭',
      },
      {
        title: 'Căutare și filtrare',
        content: 'Majoritatea paginilor au câmpuri de căutare și filtre pentru a găsi rapid informațiile de care aveți nevoie. Scrieți numele unui angajat sau selectați o farmacie.',
        icon: '🔍',
      },
    ],
  },
};

export const UserGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const currentGuide = selectedCategory ? guideCategories[selectedCategory]?.guides || [] : [];

  const nextStep = () => {
    if (currentStep < currentGuide.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setSelectedCategory(null);
      setCurrentStep(0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      setSelectedCategory(null);
      setCurrentStep(0);
    }
  };

  const closeGuide = () => {
    setIsOpen(false);
    setSelectedCategory(null);
    setCurrentStep(0);
  };

  const selectCategory = (category: CategoryKey) => {
    setSelectedCategory(category);
    setCurrentStep(0);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-full p-3 shadow-xl hover:shadow-emerald-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        aria-label="Deschide ghidul utilizatorului"
        title="Ajutor și ghid"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                  {selectedCategory ? guideCategories[selectedCategory]?.icon : '📖'}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedCategory ? guideCategories[selectedCategory]?.title : 'Ghid utilizator'}
                  </h2>
                  <p className="text-sm text-emerald-100">
                    {selectedCategory 
                      ? `Pas ${currentStep + 1} din ${currentGuide.length}`
                      : 'Selectează o categorie pentru ajutor'
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={closeGuide}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                aria-label="Închide ghidul"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!selectedCategory ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Ce doriți să învățați?
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.entries(guideCategories) as [CategoryKey, GuideCategory][]).map(([key, category]) => (
                      <button
                        key={key}
                        onClick={() => selectCategory(key)}
                        className="p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{category.icon}</div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 group-hover:text-emerald-700">
                              {category.title}
                            </h4>
                            <p className="text-sm text-slate-500 mt-1">
                              {category.description}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-slate-900">
                    {currentGuide[currentStep]?.title}
                  </h3>
                  <p className="text-lg text-slate-700 leading-relaxed">
                    {currentGuide[currentStep]?.content}
                  </p>
                  
                  <div className="mt-6 flex gap-2 justify-center">
                    {currentGuide.map((_, index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          index === currentStep
                            ? 'bg-emerald-600 w-8'
                            : 'bg-slate-300 w-2'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50">
              <div className="p-6 flex items-center justify-between">
                {selectedCategory ? (
                  <>
                    <button
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      {currentStep === 0 ? 'Înapoi la categorii' : 'Înapoi'}
                    </button>

                    <button
                      onClick={closeGuide}
                      className="px-6 py-3 bg-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-400 transition-all duration-200"
                    >
                      Închide
                    </button>

                    <button
                      onClick={nextStep}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-emerald-500/50"
                    >
                      {currentStep === currentGuide.length - 1 ? 'Finalizat' : 'Următorul'}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="w-full flex justify-end">
                    <button
                      onClick={closeGuide}
                      className="px-6 py-3 bg-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-400 transition-all duration-200"
                    >
                      Închide
                    </button>
                  </div>
                )}
              </div>
              
              <div className="border-t border-slate-200 px-6 py-4 bg-white">
                <p className="text-sm text-slate-600 text-center">
                  Pentru ajutor sau probleme tehnice:{' '}
                  <a 
                    href="tel:0754341409" 
                    className="text-emerald-600 hover:text-emerald-700 font-semibold underline"
                  >
                    0754341409
                  </a>
                  {' - '}
                  <span className="font-semibold text-slate-700">Horațiu</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

