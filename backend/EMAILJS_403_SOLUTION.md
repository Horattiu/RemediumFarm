# ❌ EROARE 403: "API calls are disabled for non-browser applications"

## Problema
EmailJS returnează `403: API calls are disabled for non-browser applications` când încerci să trimiți email din backend (Node.js).

## ✅ Soluția OBLIGATORIE

**Trebuie activată setarea "Allow EmailJS API for non-browser applications" în EmailJS Dashboard.**

### Pași exacti:

1. **Intră în EmailJS Dashboard**: https://dashboard.emailjs.com
2. **Click pe "Account"** (meniu stâng sau colțul din dreapta sus)
3. **Click pe "Security"** (sau "General" dacă nu există "Security")
4. **Caută și activează:**
   - ☑️ "Allow EmailJS API for non-browser applications"
   - ☑️ "Use Private Key (recommended)" (dacă există)
5. **Salvează** setările

### Unde exact să cauți:

- **Account → Security** → Toggle/Checkbox pentru non-browser API
- **Account → General** → Verifică dacă există secțiune "API Settings"
- **Email Services** → Click pe `service_8paatcm` → Settings → Verifică opțiuni legate de API

### Dacă nu găsești opțiunea:

**Contactează EmailJS Support:**
- Email: support@emailjs.com
- Spune-le: "I need to enable API calls for non-browser applications (Node.js) but I can't find the setting in my dashboard"

## ⚠️ Important

- **Fără această setare activată**, orice încercare de a trimite email din Node.js va returna `403`, CHIAR DACĂ ai `privateKey` setat corect.
- Setarea trebuie activată **în dashboard**, nu doar în cod.
- După activare, **restart backend-ul** pentru ca setările să fie aplicate.

## 🔍 Verificare

După ce activezi setarea, testează din nou trimiterea email-ului. Ar trebui să vezi:

```
✅ EMAIL TRIMIS CU SUCCES!
   Status: 200
   Text: OK
```

În loc de:
```
❌ EROARE TRIMITERE EMAIL:
   Status: 403
   Text: API calls are disabled for non-browser applications
```

