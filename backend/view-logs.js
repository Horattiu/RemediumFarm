/**
 * Script simplu pentru a vedea logurile
 * Rulează: node view-logs.js
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  console.log('⚠️  Folderul logs nu există.');
  console.log('📝 Pentru a activa file logging, adaugă în backend/.env:');
  console.log('   ENABLE_FILE_LOGGING=true');
  console.log('\n💡 Apoi repornește serverul pentru ca logurile să fie create.');
  process.exit(0);
}

const logFiles = fs.readdirSync(LOGS_DIR)
  .filter(file => file.endsWith('.log'))
  .map(file => ({
    name: file,
    path: path.join(LOGS_DIR, file),
    stats: fs.statSync(path.join(LOGS_DIR, file))
  }))
  .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

if (logFiles.length === 0) {
  console.log('⚠️  Nu există fișiere de log.');
  console.log('💡 Asigură-te că file logging este activat și că serverul rulează.');
  process.exit(0);
}

console.log('📋 Fișiere de log găsite:\n');
logFiles.forEach((file, index) => {
  const sizeKB = (file.stats.size / 1024).toFixed(2);
  const date = file.stats.mtime.toLocaleString('ro-RO');
  console.log(`${index + 1}. ${file.name}`);
  console.log(`   📅 Ultima modificare: ${date}`);
  console.log(`   📊 Mărime: ${sizeKB} KB\n`);
});

// Afișează ultimul fișier de log
const latestFile = logFiles[0];
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📄 Ultimele 50 linii din: ${latestFile.name}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const content = fs.readFileSync(latestFile.path, 'utf8');
const lines = content.split('\n').filter(line => line.trim());
const lastLines = lines.slice(-50);

lastLines.forEach(line => {
  console.log(line);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n💡 Pentru a vedea toate logurile, deschide: ${latestFile.path}`);

