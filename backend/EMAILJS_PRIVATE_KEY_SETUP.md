# 📧 Configurare Private Key pentru EmailJS Node.js

## ❌ Problema
Eroarea `403: API calls are disabled for non-browser applications` apare pentru că EmailJS necesită **Private Key** pentru apeluri server-side (Node.js), nu doar Public Key.

## ✅ Soluția

### Pasul 1: Obține Private Key din EmailJS Dashboard

1. **Intră în EmailJS Dashboard**: https://dashboard.emailjs.com
2. **Click pe "Account"** (meniu stâng sau colțul din dreapta sus)
3. **Click pe "Security"** sau **"General"** (sub-secțiune Account)
4. **Caută "Private Key"** sau **"API Keys"** secțiune
5. **Copiază Private Key** (format: `xxxxx-xxxxx-xxxxx` sau similar)

### Pasul 2: Adaugă Private Key în `.env`

Adaugă în `backend/.env`:

```env
EMAILJS_PUBLIC_KEY=your_public_key_here
EMAILJS_PRIVATE_KEY=your_private_key_here
EMAILJS_SERVICE_ID=service_8paatcm
EMAILJS_TEMPLATE_ID=template_6gruztc
EMAILJS_TO_EMAIL=horatiu.olt@gmail.com
```

### Pasul 3: Restart Backend

După ce adaugi Private Key în `.env`, **restart serverul backend**:

```bash
# Oprește serverul (Ctrl+C)
# Apoi repornește-l
npm run dev
```

## 🔍 Unde să cauți Private Key

**EmailJS Dashboard → Account → Security** (sau **General**)

Poți găsi:
- **Public Key** - pentru client-side (browser)
- **Private Key** - pentru server-side (Node.js) ⭐ **ACEASTA E NECESARĂ**

## 📝 Note

- **Private Key** este diferit de **Public Key**
- **Private Key** este secretă și nu trebuie expusă în frontend
- **Private Key** este necesară DOAR pentru apeluri server-side (backend)
- Dacă nu ai Private Key, este posibil să fie nevoie să o generezi din dashboard

## ✅ Verificare

După ce adaugi Private Key în `.env` și repornești backend-ul, testează din nou o cerere de concediu. Ar trebui să vezi în consolă:

```
✅ EMAIL TRIMIS CU SUCCES!
```

În loc de:
```
❌ EROARE TRIMITERE EMAIL:
   Status: 403
   Text: API calls are disabled for non-browser applications
```
