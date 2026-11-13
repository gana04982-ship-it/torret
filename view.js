import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (key && !(key.trim() in process.env)) {
        process.env[key.trim()] = val;
      }
    }
  }
}

loadEnv();

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

// CSV Parser
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
    return {
      email: obj['email'] || obj['mail_id'] || '',
      subject: obj['subject'] || '',
      status: obj['status'] || 'pending',
      sent_at: obj['sent_at'] || ''
    };
  });
}

/**
 * Connect to Gmail IMAP to fetch:
 * 1. All bounce notifications (Delivery Status Notification Failure / Mailer-Daemon)
 * 2. Inbound prospect replies & Auto-replies
 */
async function fetchInboxAudit(contactedEmailsSet, contactedDomainsSet) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env');
  }

  const cleanPass = GMAIL_APP_PASSWORD.replace(/\s+/g, '');

  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      servername: 'imap.gmail.com',
      timeout: 25000
    });

    let buffer = '';
    let step = 0;
    const bounces = [];
    const prospectReplies = [];
    const autoReplies = [];

    socket.on('data', (data) => {
      buffer += data.toString('utf-8');

      if (step === 0 && buffer.includes('* OK')) {
        step = 1;
        buffer = '';
        socket.write(`A01 LOGIN "${GMAIL_USER}" "${cleanPass}"\r\n`);
      } else if (step === 1 && buffer.includes('A01 OK')) {
        step = 2;
        buffer = '';
        socket.write(`A02 SELECT "INBOX"\r\n`);
      } else if (step === 2 && buffer.includes('A02 OK')) {
        step = 3;
        buffer = '';
        socket.write(`A03 SEARCH SINCE "05-Nov-2026"\r\n`);
      } else if (step === 3 && buffer.includes('A03 OK')) {
        const line = buffer.split('\r\n').find(l => l.startsWith('* SEARCH'));
        const ids = line ? line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean) : [];
        step = 4;
        buffer = '';

        if (ids.length === 0) {
          socket.write(`A99 LOGOUT\r\n`);
          return;
        }

        const fetchIds = ids.slice(-150).join(',');
        socket.write(`A04 FETCH ${fetchIds} (BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY[TEXT]<0.1500>)\r\n`);
      } else if (step === 4 && buffer.includes('A04 OK')) {
        const chunks = buffer.split(/\* \d+ FETCH/g).slice(1);
        for (const chunk of chunks) {
          const fromMatch = chunk.match(/From:\s*([^\r\n]+)/i);
          const subjMatch = chunk.match(/Subject:\s*([^\r\n]+)/i);
          const dateMatch = chunk.match(/Date:\s*([^\r\n]+)/i);

          const fromStr = fromMatch ? fromMatch[1].trim() : '';
          const subjStr = subjMatch ? subjMatch[1].trim() : '';
          const dateStr = dateMatch ? dateMatch[1].trim() : '';

          const isBounce = fromStr.toLowerCase().includes('mailer-daemon') ||
                           fromStr.toLowerCase().includes('postmaster') ||
                           subjStr.toLowerCase().includes('delivery status notification') ||
                           subjStr.toLowerCase().includes('undeliverable') ||
                           subjStr.toLowerCase().includes('failure');

          if (isBounce) {
            const emailMatch = chunk.match(/Final-Recipient:\s*rfc822;\s*([^\r\n;]+)/i) ||
                               chunk.match(/The following address\(es\) failed:\s*\r?\n\s*([^\r\n]+)/i) ||
                               chunk.match(/Your message to\s*([^\s<]+@[^\s>]+)/i) ||
                               chunk.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>:.*?(?:550|User unknown|Recipient address rejected|not found|Access denied)/is) ||
                               chunk.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

            const diagMatch = chunk.match(/Diagnostic-Code:\s*([^\r\n]+)/i) ||
                              chunk.match(/(550[^\r\n]+)/) ||
                              chunk.match(/(Recipient address rejected[^\r\n]+)/i) ||
                              chunk.match(/(User unknown[^\r\n]+)/i);

            if (emailMatch) {
              const cleanedEmail = emailMatch[1].trim().replace(/^<|>$/g, '').toLowerCase();
              if (cleanedEmail.includes('@') && !cleanedEmail.includes('googlemail') && !cleanedEmail.includes('mailer-daemon')) {
                bounces.push({
                  email: cleanedEmail,
                  reason: diagMatch ? diagMatch[1].trim() : 'Address not found / Rejected by host',
                  date: dateStr,
                  subject: subjStr
                });
              }
            }
          } else {
            // Check if sender matches any contacted firm/domain or has law-firm context
            const senderEmailMatch = fromStr.match(/<([^>]+)>/) || fromStr.match(/([^\s<]+@[^\s>]+)/);
            const senderEmail = senderEmailMatch ? senderEmailMatch[1].toLowerCase().trim() : '';
            const senderDomain = senderEmail.split('@')[1] || '';

            const isContactedDomain = contactedDomainsSet && contactedDomainsSet.has(senderDomain);
            const isContactedEmail = contactedEmailsSet && contactedEmailsSet.has(senderEmail);
            const isReSubject = subjStr.toLowerCase().startsWith('re:') || subjStr.toLowerCase().includes('automatic reply:');

            if (isContactedDomain || isContactedEmail || (isReSubject && !senderDomain.includes('reddit') && !senderDomain.includes('google') && !senderDomain.includes('apple'))) {
              if (subjStr.toLowerCase().includes('automatic reply:') || subjStr.toLowerCase().includes('out of office')) {
                autoReplies.push({ from: fromStr, subject: subjStr, date: dateStr, senderEmail });
              } else {
                prospectReplies.push({ from: fromStr, subject: subjStr, date: dateStr, senderEmail });
              }
            }
          }
        }
        step = 5;
        socket.write(`A99 LOGOUT\r\n`);
      } else if (step === 5 && buffer.includes('A99 OK')) {
        socket.end();
        resolve({ bounces, prospectReplies, autoReplies });
      }
    });

    socket.on('error', (err) => reject(err));
  });
}

/**
 * Renders the Full View Dashboard
 */
export async function renderView(csvFile) {
  const targetCsv = csvFile ? path.resolve(process.cwd(), csvFile) : path.join(__dirname, 'contacts.csv');
  console.log('\n' + '='.repeat(78));
  console.log('       🔍 BULLETPROOF GMAIL SENDER - LIVE DELIVERY & INBOX VIEWER       ');
  console.log('='.repeat(78));
  console.log(`📁 Target File: ${path.basename(targetCsv)}`);

  let rows = [];
  if (fs.existsSync(targetCsv)) {
    const raw = fs.readFileSync(targetCsv, 'utf-8');
    rows = parseCSV(raw);
  } else {
    console.log(`⚠️ Warning: ${targetCsv} does not exist.`);
  }

  const contactedEmailsSet = new Set(rows.map(r => r.email.toLowerCase()));
  const contactedDomainsSet = new Set(rows.map(r => (r.email.split('@')[1] || '').toLowerCase()));

  console.log(`📊 Total rows in queue: ${rows.length}`);
  console.log('⏳ Connecting to Gmail IMAP to audit live delivery status & bounces...\n');

  try {
    const { bounces, prospectReplies, autoReplies } = await fetchInboxAudit(contactedEmailsSet, contactedDomainsSet);

    // Map bounces by email
    const bounceMap = new Map();
    for (const b of bounces) {
      bounceMap.set(b.email.toLowerCase(), b);
    }

    const deliveredClean = [];
    const bouncedList = [];
    const pendingList = [];

    for (const r of rows) {
      const eLower = r.email.toLowerCase();
      if (r.status === 'pending' || !r.sent_at) {
        pendingList.push(r);
      } else if (bounceMap.has(eLower)) {
        bouncedList.push({
          ...r,
          bounceInfo: bounceMap.get(eLower)
        });
      } else {
        deliveredClean.push(r);
      }
    }

    // 1. EXECUTIVE SUMMARY
    console.log('------------------------------------------------------------------------------');
    console.log('                            EXECUTIVE SUMMARY                                 ');
    console.log('------------------------------------------------------------------------------');
    console.log(`  📬 Total Outbound Contacts : ${rows.length}`);
    console.log(`  ✅ Confirmed In-Box / Clean: ${deliveredClean.length} (${rows.length > 0 ? Math.round((deliveredClean.length / rows.length) * 100) : 0}%)`);
    console.log(`  ❌ Bounced / Undeliverable : ${bouncedList.length} (${rows.length > 0 ? Math.round((bouncedList.length / rows.length) * 100) : 0}%)`);
    console.log(`  ⏳ Pending in Queue        : ${pendingList.length}`);
    console.log(`  💬 Direct Prospect Replies : ${prospectReplies.length}`);
    console.log(`  🤖 Out-of-Office / Auto-Rep : ${autoReplies.length}`);
    console.log('------------------------------------------------------------------------------\n');

    // 2. DETAILED BOUNCED / FAILED LIST
    if (bouncedList.length > 0) {
      console.log('🚨 BOUNCED / FAILED EMAILS (BLOCKED / ADDRESS NOT FOUND):');
      console.log('='.repeat(78));
      bouncedList.forEach((b, idx) => {
        console.log(`[${idx + 1}] ❌ ${b.email}`);
        console.log(`    Subject : ${b.subject || '(Unknown Subject)'}`);
        console.log(`    Sent At : ${b.sent_at}`);
        console.log(`    Reason  : ${b.bounceInfo.reason}`);
        console.log('-'.repeat(78));
      });
      console.log('');
    } else {
      console.log('🎉 No bounced emails detected in this queue!\n');
    }

    // 3. CONFIRMED CLEAN IN-BOX DELIVERIES
    if (deliveredClean.length > 0) {
      console.log(`✅ CONFIRMED CLEAN DELIVERIES (${deliveredClean.length} In-Box Leads):`);
      console.log('='.repeat(78));
      deliveredClean.forEach((d, idx) => {
        console.log(`  ${idx + 1}. [DELIVERED] ${d.email} | Sent: ${d.sent_at} | Subj: "${d.subject}"`);
      });
      console.log('');
    }

    // 4. PROSPECT REPLIES & OUT-OF-OFFICE
    if (prospectReplies.length > 0) {
      console.log(`💬 DIRECT PROSPECT REPLIES (${prospectReplies.length} Messages):`);
      console.log('='.repeat(78));
      prospectReplies.forEach((r, idx) => {
        console.log(`  ${idx + 1}. From: ${r.from} | Subj: "${r.subject}" | Date: ${r.date}`);
      });
      console.log('');
    }

    if (autoReplies.length > 0) {
      console.log(`🤖 OUT-OF-OFFICE / AUTO-REPLIES (${autoReplies.length} Messages):`);
      console.log('='.repeat(78));
      autoReplies.forEach((r, idx) => {
        console.log(`  ${idx + 1}. From: ${r.from} | Subj: "${r.subject}" | Date: ${r.date}`);
      });
      console.log('');
    }

    console.log('='.repeat(78));
    console.log('💡 TIP: Run with `--csv <filename>` to inspect any campaign queue:');
    console.log('   node index.js --view --csv contacts_day10_completed.csv');
    console.log('='.repeat(78) + '\n');

  } catch (err) {
    console.error('❌ Error auditing Gmail INBOX:', err.message);
  }
}

// Direct CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  const csvIdx = args.findIndex(a => a === '--csv' || a === '--file');
  const csvFile = (csvIdx !== -1 && args[csvIdx + 1]) ? args[csvIdx + 1] : 'contacts.csv';
  renderView(csvFile).catch(console.error);
}
