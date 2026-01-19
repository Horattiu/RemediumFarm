# Security Checklist - Ce NU trebuie pus pe GitHub

## ⚠️ Fișiere SENSIBILE (deja în .gitignore)

### ✅ Sunt deja ignorate (NU vor fi commit-ate):
- `.env` - variabile de mediu (MONGODB_URI, JWT_SECRET, EMAILJS_*, etc.)
- `backend/google-drive-credentials.json` - credențiale Google Drive
- `backend/CREDENTIALS_TEMP.txt` - parole în plain text
- `backend/logs/` - fișiere de log
- `*.log` - toate fișierele de log
- `node_modules/` - dependențe (se instalează cu npm install)
- `dist/` și `build/` - build outputs (se generează la build)

## ✅ Ce POATE fi pus pe GitHub (documentație, cod, etc.)

- Toate fișierele `.md` (documentație)
- Toate fișierele `.js`, `.jsx`, `.json` (cod sursă)
- `package.json` și `package-lock.json` (dependențe)
- `netlify.toml`, `vite.config.js`, etc. (configurare)
- Fișierele din `public/` (assets publice)

## 🔒 Verificare înainte de commit

Înainte de a face commit, verifică:

```bash
# Verifică ce fișiere vor fi commit-ate
git status

# Verifică dacă fișierele sensibile sunt ignorate
git check-ignore backend/.env
git check-ignore backend/CREDENTIALS_TEMP.txt
git check-ignore backend/google-drive-credentials.json
```

## ⚠️ Dacă ai commit-at accidental fișiere sensibile

1. **Șterge-le din istoric Git:**
   ```bash
   git rm --cached backend/CREDENTIALS_TEMP.txt
   git commit -m "Remove sensitive file"
   ```

2. **Dacă ai push-at deja pe GitHub:**
   - Șterge repository-ul și creează unul nou, SAU
   - Folosește `git filter-branch` sau `BFG Repo-Cleaner` pentru a șterge fișierul din istoric

3. **Schimbă toate parolele/cheile** care au fost expuse!

## 📝 Notă

Toate variabilele sensibile (MONGODB_URI, JWT_SECRET, etc.) trebuie să fie setate în:
- **Development:** `.env` (local, nu commit-at)
- **Production:** Environment variables în platforma de hosting (Netlify, Heroku, etc.)

