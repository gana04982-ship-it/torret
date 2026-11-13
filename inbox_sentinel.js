import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendEmailDirect } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDataDir = path.join(__dirname, 'data');
const dataDir = process.env.DATA_DIR || defaultDataDir;
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
}
const suppressionPath = path.join(dataDir, 'suppression_list.json');
const trackedDomainsPath = path.join(dataDir, 'contacted_domains.json');
const trackedEmailsPath = path.join(dataDir, 'all_contacted_emails.json');
const inboundLeadsPath = path.join(dataDir, 'inbound_leads_to_respond.json');
const stagedRepliesPath = path.join(dataDir, 'staged_client_replies.json');

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

const GMAIL_USER = (process.env.GMAIL_USER || '').toLowerCase().trim();
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

/**
 * Quoted-Printable Decoder
 */
function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '') // soft line break
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Clean and normalize text snippet
 */
function cleanBodyText(raw) {
  let text = raw;
  // If quoted printable
  if (text.includes('=20') || text.includes('=3D') || text.includes('=\r\n')) {
    text = decodeQuotedPrintable(text);
  }
  // Strip MIME boundaries and headers if present
  text = text.replace(/--[a-zA-Z0-9_-]+[--]?/g, '');
  text = text.replace(/Content-Type:[^\r\n]+/gi, '');
  text = text.replace(/Content-Transfer-Encoding:[^\r\n]+/gi, '');
  text = text.replace(/charset=[^\r\n]+/gi, '');
  return text.trim();
}

/**
 * Generate high-converting consultative response draft based on prospect sentiment
 */
function generateClientReplyDraft(prospect) {
  const subject = prospect.subject.toLowerCase().startsWith('re:')
    ? prospect.subject
    : `Re: ${prospect.subject}`;

  const snippetLower = (prospect.snippet || '').toLowerCase();

  let body = '';
  if (snippetLower.includes('cost') || snippetLower.includes('price') || snippetLower.includes('rate') || snippetLower.includes('fee')) {
    body = `Hi ${prospect.name || 'there'},\n\n` +
      `Our typical deployment is a one-time $2,500 implementation build for the core n8n intake and document-indexing workflow, followed by an ongoing $450/month maintenance and monitoring retainer.\n\n` +
      `Everything runs directly inside your own private cloud or local environment—zero client data ever touches external training models or third-party storage.\n\n` +
      `Would you have 10 minutes this Thursday or Friday for a quick screen-share walkthrough to see if it makes sense for your firm?\n\n` +
      `Best,\nGanesh`;
  } else if (snippetLower.includes('how does it work') || snippetLower.includes('more info') || snippetLower.includes('details') || snippetLower.includes('tell me more')) {
    body = `Hi ${prospect.name || 'there'},\n\n` +
      `We design custom, private n8n automations that handle repetitive litigation admin: parsing multi-provider medical records into structured chronologies, drafting initial deposition indexing, and syncing case updates directly into your practice management software.\n\n` +
      `Paralegals typically get back 15–20 hours a week on document-heavy litigation files.\n\n` +
      `I put together a quick 3-minute video showing the workflow in action—would you like me to send that over, or would a brief 10-minute intro call be easier?\n\n` +
      `Best,\nGanesh`;
  } else {
    body = `Hi ${prospect.name || 'there'},\n\n` +
      `Thanks for following up! We build private n8n workflow systems specifically for Texas litigation boutiques to automate medical record parsing, trial disclosure tracking, and paralegal document collation.\n\n` +
      `Would you be open to a 10-minute intro call this week to see if there's an immediate bottleneck we can solve for your team?\n\n` +
      `Best,\nGanesh`;
  }

  return {
    to: prospect.email,
    name: prospect.name,
    subject,
    inReplyTo: prospect.messageId || null,
    references: prospect.messageId || null,
    body,
    createdAt: new Date().toISOString(),
    status: 'staged_ready'
  };
}

/**
 * Autonomous Mail Sentinel & Auto-Manager
 * "Seeing, Correcting, Replying"
 * Scope: Strictly legal client outreach. NEVER touches personal or non-campaign mail.
 */
export async function runSentinel(options = {}) {
  const { autoSendReplies = false, silent = false } = options;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Missing GMAIL credentials in .env');
  }

  const cleanPass = GMAIL_APP_PASSWORD.replace(/\s+/g, '');

  if (!silent) {
    console.log('\n=============================================================');
    console.log('       🛡️  AUTONOMOUS INBOX SENTINEL & BOUNCE MANAGER        ');
    console.log('=============================================================');
    console.log('Rule 1: Strictly monitor legal campaign outreach only.');
    console.log('Rule 2: Never inspect or modify personal / non-campaign emails.');
    console.log('Rule 3: Auto-quarantine bounces & opt-outs immediately.');
    console.log('Rule 4: Auto-clean tracked database so dead leads are replaced.');
    console.log('Rule 5: Triage human replies & stage consultative responses.\n');
  }

  // Load existing tracking & suppression
  let suppression = [];
  if (fs.existsSync(suppressionPath)) {
    const raw = JSON.parse(fs.readFileSync(suppressionPath, 'utf-8'));
    suppression = raw.map(s => (typeof s === 'string' ? s.toLowerCase() : (s.email || '').toLowerCase()));
  }
  const suppressionSet = new Set(suppression);

  let trackedDomains = [];
  if (fs.existsSync(trackedDomainsPath)) {
    trackedDomains = JSON.parse(fs.readFileSync(trackedDomainsPath, 'utf-8')).map(d => d.toLowerCase());
  }
  const trackedDomainsSet = new Set(trackedDomains);

  let trackedEmails = [];
  if (fs.existsSync(trackedEmailsPath)) {
    trackedEmails = JSON.parse(fs.readFileSync(trackedEmailsPath, 'utf-8')).map(e => e.toLowerCase());
  }
  const trackedEmailsSet = new Set(trackedEmails);

  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      servername: 'imap.gmail.com',
      timeout: 25000
    });

    let buffer = '';
    let step = 0;
    const detectedBounces = [];
    const detectedOptOuts = [];
    const clientInquiries = [];
    const outOfOffice = [];

    socket.on('data', async (data) => {
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
        // Search messages from last 7 days
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
        socket.write(`A04 FETCH ${fetchIds} (BODY[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO)] BODY[TEXT]<0.3500>)\r\n`);
      } else if (step === 4 && buffer.includes('A04 OK')) {
        const chunks = buffer.split(/\* \d+ FETCH/g).slice(1);
        for (const chunk of chunks) {
          const fromMatch = chunk.match(/From:\s*([^\r\n]+)/i);
          const subjMatch = chunk.match(/Subject:\s*([^\r\n]+)/i);
          const dateMatch = chunk.match(/Date:\s*([^\r\n]+)/i);
          const msgIdMatch = chunk.match(/Message-ID:\s*([^\r\n]+)/i);

          const fromStr = fromMatch ? fromMatch[1].trim() : '';
          const subjStr = subjMatch ? subjMatch[1].trim() : '';
          const dateStr = dateMatch ? dateMatch[1].trim() : '';
          const msgId = msgIdMatch ? msgIdMatch[1].trim() : '';

          const isBounce = fromStr.toLowerCase().includes('mailer-daemon') ||
                           fromStr.toLowerCase().includes('postmaster') ||
                           subjStr.toLowerCase().includes('delivery status notification') ||
                           subjStr.toLowerCase().includes('undeliverable') ||
                           subjStr.toLowerCase().includes('failure');

          if (isBounce) {
            // Extract failed recipient email
            const emailMatch = chunk.match(/Final-Recipient:\s*rfc822;\s*([^\r\n;]+)/i) ||
                               chunk.match(/Original-Recipient:\s*rfc822;\s*([^\r\n;]+)/i) ||
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
                detectedBounces.push({
                  email: cleanedEmail,
                  domain: cleanedEmail.split('@')[1] || '',
                  reason: diagMatch ? diagMatch[1].trim() : 'Address not found / Rejected by host',
                  date: dateStr,
                  subject: subjStr
                });
              }
            }
          } else {
            // Non-bounce: check if it's related to legal campaign outreach
            const senderEmailMatch = fromStr.match(/<([^>]+)>/) || fromStr.match(/([^\s<]+@[^\s>]+)/);
            const senderEmail = senderEmailMatch ? senderEmailMatch[1].toLowerCase().trim() : '';
            const senderDomain = senderEmail.split('@')[1] || '';

            // STRICT FILTER 1: Exclude self test emails
            if (senderEmail === GMAIL_USER) {
              continue;
            }

            // STRICT FILTER 2: Exclude non-campaign domains (newsletters, platforms, personal mail)
            const ignoredDomains = [
              'reddit.com', 'google.com', 'googlemail.com', 'apple.com', 'netflix.com',
              'canva.com', 'unstop.news', 'himalayas.app', 'openai.com', 'amazon.com',
              'adobe.com', 'pinterest.com', 'payoneer.com', 'heygen.com', 'mobbin.com',
              'youtube.com', 'github.com', 'linkedin.com', 'microsoft.com', 'zoom.us'
            ];
            const isIgnored = ignoredDomains.some(d => senderDomain.includes(d));
            if (isIgnored) continue;

            const isContactedDomain = trackedDomainsSet.has(senderDomain);
            const isContactedEmail = trackedEmailsSet.has(senderEmail);
            const isReSubject = subjStr.toLowerCase().startsWith('re:') || subjStr.toLowerCase().includes('automatic reply:');

            // Only process if it touches our legal campaign
            if (isContactedDomain || isContactedEmail || isReSubject) {
              // Extract body text cleanly
              const rawBody = chunk.split('\r\n\r\n').slice(1).join('\r\n\r\n') || chunk;
              const cleanedText = cleanBodyText(rawBody);
              const textSample = cleanedText.toLowerCase();

              // Extract sender name
              const nameMatch = fromStr.match(/^"?([^"<]+)"?\s*</);
              const senderName = nameMatch ? nameMatch[1].trim() : senderEmail.split('@')[0];

              // Check if auto-reply / out of office
              if (
                subjStr.toLowerCase().includes('automatic reply:') ||
                subjStr.toLowerCase().includes('out of office') ||
                textSample.includes('out of the office') ||
                textSample.includes('auto-generated')
              ) {
                outOfOffice.push({ from: fromStr, email: senderEmail, subject: subjStr, date: dateStr });
              } else if (
                textSample.includes('stop') ||
                textSample.includes('unsubscribe') ||
                textSample.includes('remove') ||
                textSample.includes('not interested') ||
                textSample.includes('do not contact') ||
                textSample.includes('take off')
              ) {
                // Opt-out detection
                detectedOptOuts.push({
                  from: fromStr,
                  email: senderEmail,
                  domain: senderDomain,
                  subject: subjStr,
                  snippet: cleanedText.slice(0, 150),
                  date: dateStr
                });
              } else if (suppressionSet.has(senderEmail)) {
                // Already suppressed opt-out or bounce, skip from inquiry pool
                continue;
              } else {
                // Genuine Client Inquiry / Human Reply
                clientInquiries.push({
                  from: fromStr,
                  name: senderName,
                  email: senderEmail,
                  domain: senderDomain,
                  subject: subjStr,
                  snippet: cleanedText.slice(0, 400),
                  date: dateStr,
                  messageId: msgId
                });
              }
            }
          }
        }
        step = 5;
        socket.write(`A99 LOGOUT\r\n`);
      } else if (step === 5 && buffer.includes('A99 OK')) {
        socket.end();

        // 1. Process Bounces: Auto-quarantine & Database auto-clean
        let newlySuppressedBounces = 0;
        const bouncedEmailsSet = new Set();
        const bouncedDomainsSet = new Set();

        for (const b of detectedBounces) {
          bouncedEmailsSet.add(b.email);
          if (b.domain) bouncedDomainsSet.add(b.domain);

          if (!suppressionSet.has(b.email)) {
            suppressionSet.add(b.email);
            newlySuppressedBounces++;
          }
        }

        // 2. Process Opt-Outs: Auto-quarantine
        let newlySuppressedOptOuts = 0;
        for (const o of detectedOptOuts) {
          if (!suppressionSet.has(o.email)) {
            suppressionSet.add(o.email);
            newlySuppressedOptOuts++;
          }
        }

        // Save updated suppression list
        if (newlySuppressedBounces > 0 || newlySuppressedOptOuts > 0) {
          const updatedList = Array.from(suppressionSet).map(email => {
            const isOpt = detectedOptOuts.some(o => o.email === email);
            return {
              email,
              reason: isOpt ? 'Opt-Out Request' : 'Delivery Failure / Bounce (550 / Access Denied)',
              updatedAt: new Date().toISOString()
            };
          });
          fs.writeFileSync(suppressionPath, JSON.stringify(updatedList, null, 2), 'utf-8');
          if (!silent) {
            console.log(`🔒 Auto-Quarantined ${newlySuppressedBounces + newlySuppressedOptOuts} address(es) into suppression_list.json!`);
          }
        }

        // 3. Database Auto-Clean: Remove dead/bounced leads from tracked domains & emails
        // so they do not falsely consume valid outreach quota and can be cleanly replaced!
        let cleanedDomainsCount = 0;
        let cleanedEmailsCount = 0;

        if (bouncedEmailsSet.size > 0 && fs.existsSync(trackedEmailsPath)) {
          const originalEmails = JSON.parse(fs.readFileSync(trackedEmailsPath, 'utf-8'));
          const filteredEmails = originalEmails.filter(e => !bouncedEmailsSet.has(e.toLowerCase()));
          if (filteredEmails.length !== originalEmails.length) {
            cleanedEmailsCount = originalEmails.length - filteredEmails.length;
            fs.writeFileSync(trackedEmailsPath, JSON.stringify(filteredEmails, null, 2), 'utf-8');
          }
        }

        if (bouncedDomainsSet.size > 0 && fs.existsSync(trackedDomainsPath)) {
          const originalDomains = JSON.parse(fs.readFileSync(trackedDomainsPath, 'utf-8'));
          const filteredDomains = originalDomains.filter(d => !bouncedDomainsSet.has(d.toLowerCase()));
          if (filteredDomains.length !== originalDomains.length) {
            cleanedDomainsCount = originalDomains.length - filteredDomains.length;
            fs.writeFileSync(trackedDomainsPath, JSON.stringify(filteredDomains, null, 2), 'utf-8');
          }
        }

        if (!silent && (cleanedDomainsCount > 0 || cleanedEmailsCount > 0)) {
          console.log(`🧹 Auto-Cleaned Database: Removed ${cleanedEmailsCount} bounced email(s) and ${cleanedDomainsCount} domain(s) to open slots for verified replacements.`);
        }

        // 4. Stage Client Responses & Staged Replies
        const stagedReplies = [];
        if (clientInquiries.length > 0) {
          fs.writeFileSync(inboundLeadsPath, JSON.stringify(clientInquiries, null, 2), 'utf-8');

          for (const inquiry of clientInquiries) {
            const replyDraft = generateClientReplyDraft(inquiry);
            stagedReplies.push(replyDraft);

            if (autoSendReplies) {
              try {
                await sendEmailDirect({
                  user: GMAIL_USER,
                  password: GMAIL_APP_PASSWORD,
                  to: replyDraft.to,
                  subject: replyDraft.subject,
                  body: replyDraft.body,
                  inReplyTo: replyDraft.inReplyTo,
                  references: replyDraft.references
                });
                replyDraft.status = 'sent_live';
                replyDraft.sentAt = new Date().toISOString();
                console.log(`🚀 [Auto-Reply Sent] To: ${replyDraft.to} | Subject: "${replyDraft.subject}"`);
              } catch (sendErr) {
                console.error(`❌ [Auto-Reply Failed] To: ${replyDraft.to}: ${sendErr.message}`);
                replyDraft.status = 'failed';
              }
            }
          }

          fs.writeFileSync(stagedRepliesPath, JSON.stringify(stagedReplies, null, 2), 'utf-8');
        }

        // Print Sentinel Audit Summary
        if (!silent) {
          console.log('\n-------------------------------------------------------------');
          console.log('                   SENTINEL AUDIT REPORT                     ');
          console.log('-------------------------------------------------------------');
          console.log(`  🛑 Bounced Emails Detected    : ${detectedBounces.length} (Auto-quarantined)`);
          console.log(`  ✋ Opt-Out Requests Handled   : ${detectedOptOuts.length} (Auto-quarantined)`);
          console.log(`  🤖 Out-of-Office Auto-Replies : ${outOfOffice.length}`);
          console.log(`  💬 High-Priority Client Leads : ${clientInquiries.length}`);
          console.log(`  📝 Staged Response Drafts     : ${stagedReplies.length}`);
          console.log('-------------------------------------------------------------\n');

          if (detectedBounces.length > 0) {
            console.log('🛑 Auto-Handled Bounces:');
            detectedBounces.forEach((b, i) => {
              console.log(`  ${i + 1}. [QUARANTINED] ${b.email} -> ${b.reason}`);
            });
            console.log('');
          }

          if (detectedOptOuts.length > 0) {
            console.log('✋ Auto-Handled Opt-Outs:');
            detectedOptOuts.forEach((o, i) => {
              console.log(`  ${i + 1}. [SUPPRESSED] ${o.email} -> "${o.subject}"`);
            });
            console.log('');
          }

          if (clientInquiries.length > 0) {
            console.log('🔥 HIGH-PRIORITY PROSPECT INQUIRIES & STAGED REPLIES:');
            clientInquiries.forEach((c, i) => {
              console.log(`  ${i + 1}. FROM: ${c.from}`);
              console.log(`     SUBJ: "${c.subject}"`);
              console.log(`     DATE: ${c.date}`);
              console.log(`     SNIPPET: ${c.snippet.replace(/\n+/g, ' ')}`);
              const staged = stagedReplies.find(r => r.to === c.email);
              if (staged) {
                console.log(`     👉 STAGED REPLY READY: "${staged.subject}" (Status: ${staged.status})\n`);
              }
            });
          } else {
            console.log('ℹ️ No active human replies requiring response at this moment.\n');
          }
        }

        resolve({
          bounces: detectedBounces,
          optOuts: detectedOptOuts,
          inquiries: clientInquiries,
          outOfOffice,
          stagedReplies
        });
      }
    });

    socket.on('error', (err) => reject(err));
  });
}

/**
 * Watcher / Daemon Mode
 * Runs Sentinel on a regular interval (e.g. every 10 minutes)
 */
export async function startSentinelDaemon(intervalMinutes = 10) {
  console.log(`🛡️ Starting Sentinel Daemon in background (polling every ${intervalMinutes} minutes)...`);
  const ms = intervalMinutes * 60 * 1000;

  const loop = async () => {
    try {
      await runSentinel({ silent: false });
    } catch (e) {
      console.error(`[Sentinel Daemon Error] ${e.message}`);
    }
    setTimeout(loop, ms);
  };

  await loop();
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch') || args.includes('-w');
  const autoSend = args.includes('--auto-send');

  if (isWatch) {
    startSentinelDaemon(10).catch(console.error);
  } else {
    runSentinel({ autoSendReplies: autoSend }).catch(console.error);
  }
}
