const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Configurare Google Sheets API
const credentialsPath = path.join(__dirname, "..", "google-drive-credentials.json");
const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

async function createBackupSpreadsheet() {
  try {
    console.log("🔄 Creez un spreadsheet nou pentru backup...");

    // Creează un spreadsheet nou
    const spreadsheet = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: `Backup Remedium - ${new Date().toLocaleDateString("ro-RO")}`,
        },
        sheets: [
          { properties: { title: "Angajati" } },
          { properties: { title: "Concedii" } },
          { properties: { title: "Pontaj" } },
          { properties: { title: "Farmacii" } },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    console.log("✅ Spreadsheet creat cu succes!");
    console.log(`📊 ID: ${spreadsheetId}`);
    console.log(`🔗 URL: ${spreadsheetUrl}`);

    // Adaugă header-urile pentru fiecare sheet
    const headers = {
      Angajati: [["ID", "Nume", "Email", "Funcție", "Farmacie", "Target Ore Lunar", "Data Creării"]],
      Concedii: [["ID", "Angajat", "Farmacie", "Tip", "Data Început", "Data Sfârșit", "Zile", "Status", "Motiv", "Data Creării"]],
      Pontaj: [["ID", "Angajat", "Data", "Ore Totale", "Minute Totale", "Entry-uri", "Data Creării"]],
      Farmacii: [["ID", "Nume", "Data Creării"]],
    };

    for (const [sheetName, headerRow] of Object.entries(headers)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: { values: headerRow },
      });
      console.log(`✅ Header adăugat pentru "${sheetName}"`);
    }

    // Salvează ID-ul în .env
    const envPath = path.join(__dirname, "..", ".env");
    let envContent = "";
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    // Verifică dacă GOOGLE_SHEETS_ID există deja
    if (envContent.includes("GOOGLE_SHEETS_ID")) {
      envContent = envContent.replace(
        /GOOGLE_SHEETS_ID=.*/,
        `GOOGLE_SHEETS_ID=${spreadsheetId}`
      );
    } else {
      envContent += `\nGOOGLE_SHEETS_ID=${spreadsheetId}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ ID-ul a fost salvat în .env`);

    console.log("\n🎉 Gata! Acum poți rula backup-ul cu:");
    console.log(`   node scripts/backup-to-google-sheets.js`);
    console.log(`   SAU`);
    console.log(`   npm run backup:sheets`);

    return spreadsheetId;
  } catch (err) {
    console.error("❌ Eroare la crearea spreadsheet-ului:", err);
    if (err.response) {
      console.error("Detalii:", JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

createBackupSpreadsheet();

