/**
 * API Configuration
 * Folosește variabile de mediu pentru URL-ul backend-ului
 * 
 * Development: http://localhost:5000
 * Production: Setează VITE_API_URL în Netlify Environment Variables
 * Railway Backend: https://remediumfarm-production.up.railway.app
 */
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  // Elimină slash-ul final dacă există pentru a evita problemele de concatenare
  return url.replace(/\/$/, "");
};

const API_URL = getApiUrl();

export default API_URL;

