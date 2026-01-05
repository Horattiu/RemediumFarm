# File Logging - Loguri Locale

Aplicația scrie loguri într-un fișier local pe PC, fără să consume resurse externe.

## Cum se activează

Adaugă în `backend/.env`:
```env
ENABLE_FILE_LOGGING=true
```

## Unde se salvează logurile

Logurile se salvează în folderul `backend/logs/`:
- Un fișier pe zi: `app-YYYY-MM-DD.log`
- Exemplu: `app-2026-01-03.log`

## Format loguri

Fiecare linie de log are formatul:
```
[2026-01-03T10:30:45.123Z] [INFO] MongoDB connected successfully {"workplaceId":"123"}
[2026-01-03T10:31:20.456Z] [ERROR] Login error {"name":"user123","error":{"message":"Invalid password","stack":"..."}}
[2026-01-03T10:32:10.789Z] [WARN] Invalid request {"ip":"127.0.0.1"}
```

## Avantaje

✅ **Zero resurse externe** - doar scriere locală în fișier  
✅ **Zero dependențe** - folosește doar `fs` (built-in Node.js)  
✅ **Non-blocking** - nu afectează performanța aplicației  
✅ **Un fișier pe zi** - ușor de gestionat și căutat  
✅ **Opțional** - se activează doar dacă vrei  

## Dezactivare

Fie șterge linia din `.env`, fie setează:
```env
ENABLE_FILE_LOGGING=false
```

## Notă

- Logurile se scriu **în plus față de** console
- Folderul `logs/` este deja în `.gitignore` - logurile nu vor fi commit-ate
- Poți șterge manual logurile vechi când vrei
- Logurile `debug` se scriu doar în development (NODE_ENV !== 'production')
