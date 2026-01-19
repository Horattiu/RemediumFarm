# Deploy Frontend pe Netlify

## Configurare inițială

### 1. Variabile de mediu în Netlify

După ce ai conectat repository-ul cu Netlify, adaugă **DOAR** următoarea variabilă de mediu:

**În Netlify Dashboard:**
- Site settings → Environment variables → Add variable

**Variabilă necesară (SINGURA pentru frontend):**
```
Key: VITE_API_URL
Value: http://localhost:5000
```

**Notă:** 
- Dacă backend-ul va fi deployat pe alt server (Heroku, Railway, etc.), actualizează valoarea cu URL-ul backend-ului.
- **NU** adăuga alte variabile din `.env` (MONGODB_URI, JWT_SECRET, EMAILJS_*, etc.) - acestea sunt doar pentru backend!

### 2. Build Settings

**IMPORTANT:** Dacă ai frontend și backend în același repository:

În Netlify Dashboard → Site settings → Build & deploy → Build settings:
- **Base directory:** `frontend` (Netlify va rula comenzi doar în acest folder)
- **Build command:** `npm run build` (va rula în `frontend/`)
- **Publish directory:** `frontend/dist` (folderul generat de build)

Netlify va detecta automat setările din `netlify.toml`, dar verifică că:
- Base directory este setat la `frontend`
- Publish directory este `frontend/dist`

### 3. Commit pe GitHub

**DA, trebuie să faci commit la întregul proiect (frontend + backend) pe GitHub!**

Netlify va face deploy doar din folderul `frontend/` datorită setării "Base directory".

```bash
git add .
git commit -m "Prepare for Netlify deployment"
git push
```

### 4. Deploy automat

La fiecare push pe branch-ul `main`, Netlify va:
1. Clona întregul repository
2. Intra în folderul `frontend/` (datorită Base directory)
3. Rula `npm install` în `frontend/`
4. Rula `npm run build` în `frontend/`
5. Deploy-a folderul `frontend/dist`

## Development local

Pentru development local, creează un fișier `.env` în folderul `frontend/`:

```env
VITE_API_URL=http://localhost:5000
```

**Notă:** Fișierul `.env` este în `.gitignore` și nu va fi commit-at.

## Verificare

După deploy, verifică că:
1. Site-ul se încarcă corect
2. API calls-urile funcționează (verifică Network tab în browser)
3. Autentificarea funcționează

## Troubleshooting

### Eroare: "Failed to fetch"
- Verifică că variabila `VITE_API_URL` este setată corect în Netlify
- Verifică că backend-ul rulează și este accesibil
- Verifică CORS settings în backend

### Eroare: "Module not found"
- Rulează `npm install` local pentru a verifica dependențele
- Verifică că toate dependențele sunt în `package.json`

