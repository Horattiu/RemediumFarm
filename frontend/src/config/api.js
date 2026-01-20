/**
 * API Configuration
 * Folosește variabile de mediu pentru URL-ul backend-ului
 * 
 * Development: http://localhost:5000
 * Production: Setează VITE_API_URL în Netlify Environment Variables
 * Railway Backend: https://remediumfarm-production.up.railway.app
 */
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default API_URL;

