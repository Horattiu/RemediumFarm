// Folosește variabile de mediu pentru URL-ul backend-ului
// Development: http://localhost:5000
// Production: Setează VITE_API_URL în Netlify Environment Variables
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
