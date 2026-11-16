import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function loadEnv() {
  const envPath = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender/.env';
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
    if (key) env[key.trim()] = val;
  }
  return env;
}

const env = loadEnv();
const user = env.GMAIL_USER;
const pass = (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

const resolverModuleUrl = pathToFileURL('C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender/thread_resolver.js').href;
const { resolveOriginalThread } = await import(resolverModuleUrl);

const brainScratch = 'C:/Users/gana0/.gemini/antigravity/brain/bc622bf4-8573-4029-b5e1-1d0c764c5a6d/scratch';
const day6LeadsAll = JSON.parse(fs.readFileSync(path.join(brainScratch, 'day6_leads.json'), 'utf-8'));
let suppressionList = [];
try {
  suppressionList = JSON.parse(fs.readFileSync(path.join(brainScratch, 'suppression_list.json'), 'utf-8'));
} catch (e) {
  console.log('Warning: could not read suppression list:', e.message);
}
const suppressionSet = new Set(suppressionList.map(s => (typeof s === 'string' ? s : s.email || '').toLowerCase().trim()));

const day6Leads = day6LeadsAll.filter(l => !suppressionSet.has(l.email.toLowerCase().trim()));
console.log(`Filtered Day 6 leads: ${day6Leads.length} active leads (${day6LeadsAll.length - day6Leads.length} quarantined).`);

function escapeCsvField(val) {
  if (!val) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  console.log(`Starting IMAP thread resolution for ${day6Leads.length} Day 6 leads...`);
  const rows = [['email', 'subject', 'body', 'status', 'sent_at', 'in_reply_to', 'is_followup']];

  let resolvedCount = 0;

  for (let i = 0; i < day6Leads.length; i++) {
    const lead = day6Leads[i];
    const firstName = lead.body.match(/Hi\s+([^,\n]+),/)?.[1] || (lead.name ? lead.name.split(' ')[0] : 'there');
    process.stdout.write(`[${i + 1}/${day6Leads.length}] Resolving thread for ${lead.email}... `);

    let messageId = '';
    let resolvedSubject = lead.subject;

    try {
      const thread = await resolveOriginalThread({
        user,
        password: pass,
        toEmail: lead.email,
      });

      if (thread && thread.found && thread.messageId) {
        messageId = thread.messageId;
        if (thread.subject) {
          resolvedSubject = thread.subject;
        }
        resolvedCount++;
        console.log(`✅ FOUND (ID: ${messageId.substring(0, 25)}...)`);
      } else {
        console.log(`⚠️ Not found in Sent folder, will send as clean touch`);
      }
    } catch (e) {
      console.log(`❌ Resolver error: ${e.message}`);
    }

    const cleanSubj = resolvedSubject.toLowerCase().startsWith('re:') ? resolvedSubject : `Re: ${resolvedSubject}`;
    const bumpBody = `Hi ${firstName},

Following up on this quickly—did you get a chance to review whether your team is managing this manually?

Happy to show you how our private workflow handles it in under 5 minutes.

Best,
Ganesh`;

    rows.push([
      escapeCsvField(lead.email),
      escapeCsvField(cleanSubj),
      escapeCsvField(bumpBody),
      'pending',
      '',
      escapeCsvField(messageId),
      'true'
    ]);
  }

  const csvContent = rows.map(r => r.join(',')).join('\n');
  const targetPath = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender/contacts_engine2_day6_followups.csv';
  fs.writeFileSync(targetPath, csvContent, 'utf-8');

  console.log(`\n🎉 Day 6 Follow-ups generated successfully!`);
  console.log(`Total active leads: ${day6Leads.length}`);
  console.log(`Natively resolved threads: ${resolvedCount}`);
  console.log(`Unthreaded bumps: ${day6Leads.length - resolvedCount}`);
  console.log(`Saved to: ${targetPath}`);
}

main().catch(err => {
  console.error('Fatal resolution error:', err);
  process.exit(1);
});
