// Folosește variabile de mediu pentru URL-ul backend-ului
// Development: http://localhost:5000
// Production: Setează VITE_API_URL în Netlify Environment Variables
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  // Elimină slash-ul final dacă există pentru a evita problemele de concatenare
  return url.replace(/\/$/, "");
};

const API_URL = getApiUrl();

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  return fetch(API_URL + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}
