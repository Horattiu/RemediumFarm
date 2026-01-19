# 📧 Ghid Complet EmailJS - Unde găsești Public Key și Template ID

## 🎯 Pași Rapizi

### Pasul 1: Găsește PUBLIC KEY

1. **Intră în EmailJS Dashboard**: https://dashboard.emailjs.com
2. **Click pe "Account"** (în meniul din stânga sau în colțul din dreapta sus)
3. **Click pe "General"** (sub-secțiune Account)
4. **Caută "Public Key"** - vei vedea ceva de genul:
   ```
   Public Key: AbCdEfGhIjKlMnOpQrStUvWxYz123456
   ```
5. **Copiază această cheie** și o pui în `.env` ca `EMAILJS_PUBLIC_KEY`

---

### Pasul 2: Creează Template-ul

1. **Intră în "Email Templates"** (din meniul din stânga)
2. **Click pe "Create New Template"** (buton verde/albastru)
3. **Nume template**: `leave-request-notification` (sau orice nume vrei tu)

---

### Pasul 3: Configurează Template-ul

#### 3.1. **Subject (Subiect email)**
```
Notificare Cerere de Concediu - {{employee_name}}
```

#### 3.2. **To Email (Destinatar)**
```
horatiu.olt@gmail.com
```

**Sau** dacă vrei să fie dinamic (nu este necesar în cazul tău):
```
{{to_email}}
```

#### 3.3. **From Name (De la cine)**
```
Sistem Remedium Concedii
```

#### 3.4. **Content (Conținut HTML)**

**Copiază acest HTML** în editorul de template (înlocuiește conținutul existent):

```html
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notificare Cerere de Concediu</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                📋 Notificare Cerere de Concediu
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px;">
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Bună ziua,
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                A fost înregistrată o nouă cerere de concediu în sistem.
                            </p>
                            
                            <!-- Detalii Cerere -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                                <tr>
                                    <td>
                                        <table role="presentation" width="100%" cellpadding="8" cellspacing="0" border="0">
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0; width: 140px;">Angajat:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;"><strong>{{employee_name}}</strong></td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">Farmacie:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;">{{workplace_name}}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">Funcție:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;">{{function}}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">Tip concediu:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;">
                                                    <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                                                        {{leave_type_label}}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">Perioada:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;">
                                                    <strong>{{start_date}}</strong> - <strong>{{end_date}}</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0;">Număr zile:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;"><strong>{{days}}</strong> zile</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #6b7280; font-size: 14px; font-weight: 600; padding: 8px 0; vertical-align: top;">Motiv:</td>
                                                <td style="color: #111827; font-size: 14px; padding: 8px 0;">{{reason}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Cererea a fost înregistrată cu succes în sistem.
                            </p>
                            
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Cu respect,<br>
                                <strong style="color: #111827;">Sistem Remedium Concedii</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                                Acest email a fost generat automat. Te rugăm să nu răspunzi la acest mesaj.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

#### 3.5. **Salvează Template-ul**
- Click pe "Save" sau "Save Changes"

---

### Pasul 4: Găsește TEMPLATE ID

După ce ai salvat template-ul:

1. **Rămâi în pagina template-ului** (sau intră din nou în "Email Templates")
2. **Click pe template-ul creat** (`leave-request-notification`)
3. **Caută "Template ID"** - poate fi:
   - În URL-ul paginii: `https://dashboard.emailjs.com/admin/template/abc123xyz/edit`
     - Template ID = `abc123xyz`
   - Sau în sidebar-ul din dreapta când editezi template-ul
   - Sau în header-ul template-ului
4. **Copiază Template ID** (format: `template_xxxxx` sau doar `xxxxx`)
5. **Îl pui în `.env` ca `EMAILJS_TEMPLATE_ID`**

**Exemplu Template ID**: `template_abc123xyz` sau `abc123xyz`

---

## 📋 Variabile Template (folosite în HTML)

Următoarele variabile sunt trimise automat de backend și pot fi folosite în template:

- `{{employee_name}}` - Numele angajatului
- `{{workplace_name}}` - Numele farmaciei
- `{{function}}` - Funcția angajatului
- `{{leave_type_label}}` - Tipul concediului (ex: "Concediu de odihnă")
- `{{start_date}}` - Data început (format: DD.MM.YYYY)
- `{{end_date}}` - Data sfârșit (format: DD.MM.YYYY)
- `{{days}}` - Număr zile
- `{{reason}}` - Motivul cererii
- `{{to_email}}` - Email destinatar (opțional, dacă vrei să fie dinamic)

---

## ✅ Verificare Finală

După ce ai configurat totul:

1. **Template creat** ✅
2. **Subject setat** ✅
3. **To Email setat** ✅
4. **HTML copiat** ✅
5. **Public Key copiat** din Account → General ✅
6. **Template ID copiat** din template-ul creat ✅
7. **Variabile setate în `.env`** ✅

---

## 🧪 Testare

1. **Restart serverul backend**
2. **Creează o cerere de concediu** în aplicație
3. **Verifică emailul** la `horatiu.olt@gmail.com`

---

## ❓ Întrebări Frecvente

**Q: Template ID este cu sau fără prefixul "template_"?**  
A: Poate fi ambele. EmailJS acceptă atât `template_abc123` cât și `abc123`.

**Q: Public Key este același cu Private Key?**  
A: Nu. Public Key este cea de care ai nevoie pentru API. Este sigur să o pui în `.env`.

**Q: Trebuie să creez un Service nou?**  
A: Nu, folosești deja `service_8paatcm`. Doar template-ul trebuie creat.

**Q: Pot folosi un template existent?**  
A: Da, dar trebuie să ai toate variabilele necesare în template-ul existent.

