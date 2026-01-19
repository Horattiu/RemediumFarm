# Configurare EmailJS pentru Notificări Cereri de Concediu

## 📋 Pași de configurare

### 1. Template EmailJS în Dashboard

Du-te în **EmailJS Dashboard** → **Email Templates** → **Create New Template**

Nume template: `leave-request-notification` (sau alt nume - îl vei seta în `.env`)

### 2. Conținut Template HTML

Copiază următorul HTML în editorul de template (înlocuiește conținutul existent):

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

### 3. Variabile Template (Template Variables)

În secțiunea **Variables** a template-ului, asigură-te că ai următoarele variabile (EmailJS le va adăuga automat dacă le folosești în HTML):

- `{{employee_name}}` - Numele angajatului
- `{{workplace_name}}` - Numele farmaciei
- `{{function}}` - Funcția angajatului
- `{{leave_type_label}}` - Tipul concediului (ex: "Concediu de odihnă")
- `{{start_date}}` - Data început (format DD.MM.YYYY)
- `{{end_date}}` - Data sfârșit (format DD.MM.YYYY)
- `{{days}}` - Număr zile
- `{{reason}}` - Motivul cererii

### 4. Setări Template

- **Subject**: `Notificare Cerere de Concediu - {{employee_name}}`
- **To Email**: `{{to_email}}` (sau direct `horatiu.olt@gmail.com` dacă este fix)
- **From Name**: `Sistem Remedium Concedii`

### 5. Variabile în `.env`

Adaugă în `backend/.env`:

```env
EMAILJS_PUBLIC_KEY=your_public_key_here
EMAILJS_SERVICE_ID=service_8paatcm
EMAILJS_TEMPLATE_ID=your_template_id_here
EMAILJS_TO_EMAIL=horatiu.olt@gmail.com
```

### 6. Obținere Public Key și Template ID

**Public Key:**
- Du-te în **EmailJS Dashboard** → **Account** → **General**
- Copiază **Public Key**

**Template ID:**
- Du-te în **Email Templates** → Click pe template-ul creat
- În URL sau în informațiile template-ului, vei găsi **Template ID** (ex: `template_xxxxx`)

### 7. Testare

După ce ai setat toate variabilele în `.env`, testează prin crearea unei cereri de concediu în aplicație.

## 📝 Note

- Email-ul se trimite automat la fiecare cerere de concediu nouă
- Dacă trimiterea emailului eșuează, cererea se salvează oricum (non-blocking)
- Toate erorile sunt loggate în console pentru debugging
