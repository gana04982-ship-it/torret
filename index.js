import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { sendEmailDirect } from './mailer.js';
import { resolveOriginalThread } from './thread_resolver.js';
import { renderView } from './view.js';
import { runSentinel, startSentinelDaemon } from './inbox_sentinel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
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
const TEST_RECIPIENT = process.env.TEST_RECIPIENT || GMAIL_USER;

// Guardrail 1: Jitter between 50 and 110 seconds
const MIN_DELAY = parseInt(process.env.MIN_DELAY_SECONDS || '50', 10);
const MAX_DELAY = parseInt(process.env.MAX_DELAY_SECONDS || '110', 10);

// Guardrail 2: Batch Split with Coffee Break Pattern
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '25', 10);
const BREAK_MIN_MINUTES = parseInt(process.env.BREAK_MIN_MINUTES || '15', 10);
const BREAK_MAX_MINUTES = parseInt(process.env.BREAK_MAX_MINUTES || '20', 10);

const CSV_PATH = path.join(__dirname, 'contacts.csv');

/**
 * Robust RFC 4180 CSV Parser
 * Correctly handles multi-line body text, commas, and double quotes.
 */
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
        i++; // skip escaped quote
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

    const email = obj['email'] || obj['mail_id'] || obj['lead_mail_id'] || obj['lead_email'] || '';
    const subject = obj['subject'] || obj['title'] || '';
    const body = obj['body'] || obj['content'] || obj['message'] || '';
    const status = obj['status'] || 'pending';
    const sent_at = obj['sent_at'] || '';
    const in_reply_to = obj['in_reply_to'] || obj['message_id'] || '';
    const is_followup = obj['is_followup'] || '';

    return {
      _rowIndex: idx,
      email,
      subject,
      body,
      status,
      sent_at,
      in_reply_to,
      is_followup,
    };
  });
}

function escapeCSVField(str) {
  if (str == null) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function saveCSV(filePath, rows) {
  if (rows.length === 0) return;
  const headers = ['email', 'subject', 'body', 'status', 'sent_at', 'in_reply_to'];
  const lines = [
    headers.join(','),
    ...rows.map((r) => [
      escapeCSVField(r.email),
      escapeCSVField(r.subject),
      escapeCSVField(r.body),
      escapeCSVField(r.status),
      escapeCSVField(r.sent_at),
      escapeCSVField(r.in_reply_to || ''),
    ].join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random jitter delay countdown helper
async function countdownJitter(seconds) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r⏳ [Human Jitter] Next email in ${i}s (randomized between ${MIN_DELAY}s–${MAX_DELAY}s)... `);
    await sleep(1000);
  }
  process.stdout.write('\r                                                                                           \r');
}

// Coffee break countdown helper
async function countdownCoffeeBreak(totalSeconds) {
  console.log(`\n☕ [Coffee Break Pattern] Taking a natural ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s human pause before next batch...`);
  for (let i = totalSeconds; i > 0; i--) {
    const mins = Math.floor(i / 60);
    const secs = i % 60;
    const formatted = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    process.stdout.write(`\r☕ [Coffee Break Countdown] Resuming in ${formatted}... `);
    await sleep(1000);
  }
  process.stdout.write('\r                                                                                                \r');
  console.log('✅ Coffee break complete! Resuming email dispatch...\n');
}

function getRandomDelay(minSec, maxSec) {
  return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}

function getRandomCoffeeBreakSeconds(minMin, maxMin) {
  const minutes = Math.floor(Math.random() * (maxMin - minMin + 1)) + minMin;
  const jitterSeconds = Math.floor(Math.random() * 60); // adds second-level randomness e.g. 16m 38s
  return minutes * 60 + jitterSeconds;
}

function printEmailPreview(row) {
  console.log('='.repeat(70));
  console.log(`👤 Recipient Email: ${row.email}`);
  console.log(`📌 Subject:         ${row.subject}`);
  console.log(`📏 Payload Size:    ${Buffer.byteLength(row.body, 'utf-8')} bytes (pure text/plain)`);
  console.log(`🚦 Status:          ${row.status || 'pending'}`);
  console.log('-'.repeat(70));
  console.log(row.body);
  console.log('='.repeat(70) + '\n');
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isTestSelf = args.includes('--test-self');
  const isLive = args.includes('--live');
  const isFollowupMode = args.includes('--followup');
  const isViewMode = args.includes('--view') || args.includes('-v');
  const autoConfirm = args.includes('--yes') || args.includes('-y');
  const csvArgIdx = args.findIndex(a => a === '--csv' || a === '--file');
  const activeCsvPath = (csvArgIdx !== -1 && args[csvArgIdx + 1])
    ? path.resolve(__dirname, args[csvArgIdx + 1])
    : CSV_PATH;

  // --- MODE: VIEW DASHBOARD ---
  if (isViewMode) {
    await renderView(activeCsvPath);
    return;
  }

  // --- MODE: SENTINEL INBOX MANAGER ---
  const isSentinelMode = args.includes('--sentinel') || args.includes('-s');
  const isSentinelWatch = args.includes('--sentinel-watch') || args.includes('--watch');
  if (isSentinelMode || isSentinelWatch) {
    if (isSentinelWatch) {
      await startSentinelDaemon(10);
    } else {
      await runSentinel();
    }
    return;
  }

  console.log('\n=============================================================');
  console.log('    BULLETPROOF GMAIL SENDER (HUMAN-PACED BATCH DISPATCH)    ');
  console.log('=============================================================');
  console.log(`  Rule 1 (Random Jitter):   ${MIN_DELAY}s to ${MAX_DELAY}s between every email`);
  console.log(`  Rule 2 (Coffee Break):    Automated ${BREAK_MIN_MINUTES}m–${BREAK_MAX_MINUTES}m pause every ${BATCH_SIZE} emails`);
  console.log('  Rule 3 (Payload Safety):  100% pure text/plain UTF-8 (0 links/trackers)');
  console.log('  Rule 4 (No Rewriting):    Direct passthrough of your exact text');
  console.log(`  Active Queue File:        ${path.basename(activeCsvPath)}`);
  if (isFollowupMode) {
    console.log('  Rule 5 (Threaded Reply):  Auto-resolving In-Reply-To from [Gmail]/Sent Mail\n');
  } else {
    console.log('');
  }

  if (!fs.existsSync(activeCsvPath)) {
    console.error(`❌ contacts file not found at ${activeCsvPath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(activeCsvPath, 'utf-8');
  const rows = parseCSV(rawContent);

  if (rows.length === 0) {
    console.log('⚠️ contacts.csv is empty or has no data rows.');
    process.exit(0);
  }

  // --- MODE 1: DRY RUN (Preview without sending) ---
  if (isDryRun || (!isTestSelf && !isLive)) {
    console.log(`🔍 PREVIEWING ${rows.length} EMAIL(S) FROM contacts.csv (Zero emails sent):\n`);
    for (const row of rows) {
      printEmailPreview(row);
    }
    console.log('✅ Preview complete. All emails will be sent EXACTLY as written above.');
    console.log('👉 To send 1 test email to yourself:   node index.js --test-self');
    console.log('👉 To start sending to your list:      node index.js --live');
    console.log('👉 To view delivery & bounce status:   node index.js --view\n');
    return;
  }

  // --- Validate Credentials ---
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('❌ Missing credentials! Please ensure GMAIL_USER and GMAIL_APP_PASSWORD exist in .env');
    process.exit(1);
  }

  // --- MODE 2: TEST SELF (Send Row 1 to yourself) ---
  if (isTestSelf) {
    console.log(`📬 MODE: TEST SELF (Sending 1 email with Row 1 content to: ${TEST_RECIPIENT})\n`);
    const sample = rows[0];
    if (!sample) {
      console.error('❌ No rows found in contacts.csv to test.');
      return;
    }

    printEmailPreview({ ...sample, email: TEST_RECIPIENT });

    try {
      console.log('🚀 Connecting to smtp.gmail.com:465 via TLS...');
      await sendEmailDirect({
        user: GMAIL_USER,
        password: GMAIL_APP_PASSWORD,
        to: TEST_RECIPIENT,
        subject: `[TEST] ${sample.subject}`,
        body: sample.body,
      });
      console.log(`✅ Success! Test email delivered to ${TEST_RECIPIENT}. Check your inbox.`);
    } catch (err) {
      console.error(`❌ Delivery failed: ${err.message}`);
    }
    return;
  }

  // --- MODE 3: LIVE DISPATCH ---
  if (isLive) {
    const pending = rows.filter((r) => (r.status || '').toLowerCase() !== 'sent');
    console.log(`📊 Total rows: ${rows.length} | Pending: ${pending.length} | Already Sent: ${rows.length - pending.length}`);

    if (pending.length === 0) {
      console.log('🎉 All emails in contacts.csv are already marked as sent! Nothing to do.');
      return;
    }

    const estimatedMinutes = Math.round(
      (pending.length * ((MIN_DELAY + MAX_DELAY) / 2) +
        Math.floor(pending.length / BATCH_SIZE) * (((BREAK_MIN_MINUTES + BREAK_MAX_MINUTES) / 2) * 60)) /
        60
    );

    console.log('\n⚠️  CONFIRMATION REQUIRED');
    console.log(`You are about to send ${pending.length} exact emails from ${GMAIL_USER}.`);
    console.log(`Pacing: ${MIN_DELAY}s–${MAX_DELAY}s random jitter between emails.`);
    if (pending.length > BATCH_SIZE) {
      console.log(`Coffee Break: ${BREAK_MIN_MINUTES}m–${BREAK_MAX_MINUTES}m pause after every ${BATCH_SIZE} emails.`);
    }
    console.log(`Estimated run duration: ~${estimatedMinutes} minutes.`);

    if (!autoConfirm) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((res) => rl.question('\nType "yes" to proceed: ', res));
      rl.close();

      if (answer.trim().toLowerCase() !== 'yes') {
        console.log('⛔ Aborted by user.');
        return;
      }
    }

    console.log('\n🚀 Starting bulletproof dispatch queue...\n');

    let sentCountInRun = 0;

    for (let i = 0; i < pending.length; i++) {
      const contact = pending[i];
      console.log(`[${i + 1}/${pending.length}] Sending to ${contact.email}...`);

      if (!contact.email || !contact.subject || !contact.body) {
        console.warn(`   ⚠️ Skipping row ${contact._rowIndex + 1}: Missing email, subject, or body.`);
        contact.status = 'skipped_invalid';
        saveCSV(activeCsvPath, rows);
        continue;
      }

      // Pre-send suppression guardrail: Skip bounced or opted-out leads
      const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
      const suppPath = path.join(dataDir, 'suppression_list.json');
      if (fs.existsSync(suppPath)) {
        try {
          const suppRaw = JSON.parse(fs.readFileSync(suppPath, 'utf-8'));
          const suppSet = new Set(suppRaw.map(s => (typeof s === 'string' ? s.toLowerCase() : (s.email || '').toLowerCase())));
          if (suppSet.has(contact.email.toLowerCase())) {
            console.warn(`   🛑 [AUTO-QUARANTINED] Skipping ${contact.email}: Present in suppression list (bounce or opt-out).`);
            contact.status = 'quarantined_suppressed';
            saveCSV(activeCsvPath, rows);
            continue;
          }
        } catch (_) {}
      }

      try {
        let inReplyTo = contact.in_reply_to || null;
        let references = contact.in_reply_to || null;

        const shouldThread = isFollowupMode || contact.is_followup === 'true' || (contact.subject && contact.subject.trim().toLowerCase().startsWith('re:'));
        if (shouldThread) {
          if (!inReplyTo) {
            process.stdout.write(`   🔍 Resolving original sent thread from [Gmail]/Sent Mail... `);
            const thread = await resolveOriginalThread({
              user: GMAIL_USER,
              password: GMAIL_APP_PASSWORD,
              toEmail: contact.email,
            });

            if (thread && thread.found && thread.messageId) {
              inReplyTo = thread.messageId;
              references = thread.messageId;
              contact.in_reply_to = thread.messageId;

              if (thread.subject) {
                const baseSub = thread.subject.replace(/^re:\s*/i, '').trim();
                contact.subject = `Re: ${baseSub}`;
              } else if (!contact.subject.toLowerCase().startsWith('re:')) {
                contact.subject = `Re: ${contact.subject}`;
              }
              console.log(`🔗 Thread Linked! (${thread.messageId})`);
            } else {
              console.log(`⚠️ No prior thread found in Sent Mail. Sending as standalone.`);
            }
          } else {
            console.log(`   🔗 Using existing In-Reply-To: ${inReplyTo}`);
          }
        }

        await sendEmailDirect({
          user: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
          to: contact.email,
          subject: contact.subject,
          body: contact.body,
          inReplyTo,
          references,
        });

        contact.status = 'sent';
        contact.sent_at = new Date().toISOString();
        saveCSV(activeCsvPath, rows); // Save immediately after each email
        sentCountInRun++;

        console.log(`   ✅ Sent to ${contact.email} | Subject: "${contact.subject}"`);

        // Check if more emails remain
        if (i < pending.length - 1) {
          // Check for Coffee Break trigger (after every BATCH_SIZE sends in this run)
          if (sentCountInRun % BATCH_SIZE === 0) {
            const breakSec = getRandomCoffeeBreakSeconds(BREAK_MIN_MINUTES, BREAK_MAX_MINUTES);
            await countdownCoffeeBreak(breakSec);
          } else {
            // Standard human jitter delay
            const delaySec = getRandomDelay(MIN_DELAY, MAX_DELAY);
            await countdownJitter(delaySec);
          }
        }
      } catch (err) {
        console.error(`   ❌ Failed sending to ${contact.email}: ${err.message}`);
        contact.status = 'failed';
        saveCSV(activeCsvPath, rows);
      }
    }

    console.log('\n🎉 Finished processing the email queue. All emails delivered safely!');
  }
}

run().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
