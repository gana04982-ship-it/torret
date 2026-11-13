import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runSentinel } from './inbox_sentinel.js';
import { renderView } from './view.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engine2Csv = path.join(__dirname, 'contacts_engine2_day2_followups.csv');
const replacementsCsv = path.join(__dirname, 'contacts_day10_replacements.csv');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row, idx) => {
    const obj = { _rowIndex: idx };
    rawHeaders.forEach((h, i) => {
      obj[h] = row[i] ? row[i].trim() : '';
    });
    return obj;
  });
}

function countPending(csvPath) {
  if (!fs.existsSync(csvPath)) return 0;
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  return rows.filter(r => (r.status || '').toLowerCase() !== 'sent' && (r.status || '').toLowerCase() !== 'quarantined_suppressed' && (r.status || '').toLowerCase() !== 'failed').length;
}

async function runCommandAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Executing: ${cmd} ${args.join(' ')}\n`);
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: __dirname });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code}`));
    });
    proc.on('error', err => reject(err));
  });
}

async function main() {
  console.log('=============================================================');
  console.log('    AUTONOMOUS DUAL-ENGINE ORCHESTRATOR (PRECISION CHAIN)    ');
  console.log('=============================================================');
  console.log('1. Monitoring Engine 2 (Day 2 Threaded Follow-ups) until completion.');
  console.log('2. Running Sentinel to auto-quarantine bounces & auto-clean database.');
  console.log('3. Triggering Engine 1 (24 Replacement Texas Litigation Leads).');
  console.log('4. Running Sentinel audit & rendering live delivery dashboard.\n');

  // Step 1: Dispatch remaining Engine 2 Follow-ups (if any)
  const pendingE2 = countPending(engine2Csv);
  if (pendingE2 > 0) {
    console.log(`🚀 Step 1: Dispatching remaining ${pendingE2} Engine 2 Follow-ups...`);
    try {
      await runCommandAsync('node', ['index.js', '--live', '--yes', '--csv', 'contacts_engine2_day2_followups.csv']);
      console.log('✅ Engine 2 Follow-up dispatch complete!\n');
    } catch (err) {
      console.error(`⚠️ Engine 2 dispatch exited: ${err.message}`);
    }
  } else {
    console.log('✅ Engine 2 Follow-ups already 100% complete!\n');
  }

  // Step 2: Post-Engine-2 Sentinel Scan
  console.log('🛡️ Step 2: Executing Sentinel inbox audit post-Engine 2...');
  try {
    await runSentinel({ silent: false });
  } catch (err) {
    console.error(`⚠️ Sentinel error: ${err.message}`);
  }

  // Step 3: Trigger Engine 1 Replacements (24 leads)
  console.log('\n🚀 Step 3: Launching Engine 1 Replacement Batch (24 pristine Texas litigation leads)...');
  try {
    await runCommandAsync('node', ['index.js', '--live', '--yes', '--csv', 'contacts_day10_replacements.csv']);
    console.log('✅ Engine 1 Replacement batch dispatch complete!\n');
  } catch (err) {
    console.error(`❌ Engine 1 Replacement dispatch error: ${err.message}`);
  }

  // Step 4: Post-Engine-1 Sentinel Scan & Final Dashboard
  console.log('🛡️ Step 4: Executing final Sentinel audit...');
  try {
    await runSentinel({ silent: false });
  } catch (err) {
    console.error(`⚠️ Sentinel error: ${err.message}`);
  }

  console.log('\n📊 Step 5: Rendering final delivery dashboard...');
  try {
    await renderView(replacementsCsv);
  } catch (err) {
    console.error(`⚠️ View render error: ${err.message}`);
  }

  console.log('\n🎉 ALL ENGINES FULLY COMPLETED WITH MAXIMUM PRECISION!');
}

main().catch(console.error);
