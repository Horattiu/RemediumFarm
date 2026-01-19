# Backup Scheduler - Ghid de utilizare

## Descriere
Scheduler-ul rulează automat backup-ul în Google Sheets zilnic la ora 12 noaptea (00:00).

## Configurare

### 1. Activează scheduler-ul în `.env`

Adaugă următoarele variabile în fișierul `backend/.env`:

```env
# Backup Scheduler
ENABLE_BACKUP_SCHEDULER=true
BACKUP_SCHEDULE=0 0 * * *
RUN_BACKUP_ON_START=false
```

**Variabile:**
- `ENABLE_BACKUP_SCHEDULER=true` - Activează scheduler-ul
- `BACKUP_SCHEDULE=0 0 * * *` - Programul (cron format): zilnic la 00:00
- `RUN_BACKUP_ON_START=false` - Rulează backup-ul imediat la pornire (opțional)

### 2. Formate cron disponibile

- `0 0 * * *` - Zilnic la 00:00 (ora 12 noaptea)
- `0 2 * * *` - Zilnic la 02:00
- `0 0 * * 0` - Săptămânal, duminică la 00:00
- `0 0 1 * *` - Lunar, prima zi a lunii la 00:00
- `0 */6 * * *` - La fiecare 6 ore

**Format:** `minute hour day month dayOfWeek`
- minute: 0-59
- hour: 0-23
- day: 1-31
- month: 1-12
- dayOfWeek: 0-7 (0 sau 7 = duminică)

### 3. Pornește scheduler-ul

**Opțiunea 1: Proces separat (recomandat)**
```bash
cd backend
npm run backup:scheduler
```

**Opțiunea 2: Integrat în server.js**
Poți integra scheduler-ul direct în `server.js` dacă vrei să ruleze odată cu serverul.

## Log-uri

Log-urile sunt salvate în `backend/logs/backup-scheduler.log`

## Dezactivare

Pentru a dezactiva scheduler-ul, setează în `.env`:
```env
ENABLE_BACKUP_SCHEDULER=false
```

## Testare

Pentru a testa scheduler-ul, rulează manual:
```bash
cd backend
npm run backup:sheets
```

## Notă importantă

Scheduler-ul trebuie să ruleze continuu pentru a funcționa. Dacă oprești procesul, scheduler-ul se oprește.

Pentru producție, recomandăm:
- **PM2** pentru gestionarea proceselor Node.js
- **Windows Task Scheduler** pentru rulare automată la pornirea sistemului
- **systemd** (Linux) pentru servicii de sistem

