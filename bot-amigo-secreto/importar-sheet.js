// Importa discordId y discordNick desde un CSV (exportado de tu Google Sheet) a Firestore.
// Uso:  node importar-sheet.js participantes.csv
// Sheet -> Archivo -> Descargar -> Valores separados por comas (.csv)
const fs = require('fs');
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

// === AJUSTA ESTOS NOMBRES a los encabezados reales de tu Sheet (no importan mayúsculas) ===
const COL_CORREO = 'correo';
const COL_DISCORD_ID = 'discord id';
const COL_NICK = 'nick';
// ==========================================================================================

function parseCSV(texto) {
  const filas = []; let fila = []; let campo = ''; let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = ''; filas.push(fila); fila = [];
    } else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim() !== ''));
}

(async () => {
  const archivo = process.argv[2];
  if (!archivo) return console.log('Uso: node importar-sheet.js participantes.csv');

  const filas = parseCSV(fs.readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''));
  const enc = filas[0].map(h => h.trim().toLowerCase());
  const iCorreo = enc.indexOf(COL_CORREO.toLowerCase());
  const iId = enc.indexOf(COL_DISCORD_ID.toLowerCase());
  const iNick = enc.indexOf(COL_NICK.toLowerCase());
  if (iCorreo < 0 || iId < 0 || iNick < 0) {
    console.log('❌ No encontré las columnas. Encabezados detectados:', enc);
    return process.exit(1);
  }

  const usersSnap = await db.collection('users').get();
  const porCorreo = new Map();
  usersSnap.forEach(d => { const e = (d.data().email || '').trim().toLowerCase(); if (e) porCorreo.set(e, d.ref); });

  let ok = 0; const sinCuenta = []; const idsMalos = [];
  for (const f of filas.slice(1)) {
    const correo = (f[iCorreo] || '').trim().toLowerCase();
    const discordId = (f[iId] || '').trim();
    const nick = (f[iNick] || '').trim();
    if (!correo && !discordId) continue;
    if (!/^\d{17,20}$/.test(discordId)) { idsMalos.push(`${correo} -> "${discordId}"`); continue; }
    const ref = porCorreo.get(correo);
    if (!ref) { sinCuenta.push(correo); continue; }
    await ref.update({ discordId, discordNick: nick });
    ok++;
  }
  console.log(`✅ Vinculados: ${ok}`);
  if (sinCuenta.length) console.log('⚠️ Sin cuenta en la página (correo no coincide):', sinCuenta);
  if (idsMalos.length) console.log('⚠️ ID de Discord inválido (¿notación científica?):', idsMalos);
  process.exit(0);
})();
