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
const day5Leads = JSON.parse(fs.readFileSync(path.join(brainScratch, 'day5_parsed_leads.json'), 'utf-8'));

function escapeCsvField(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

async function main() {
  console.log(`Starting IMAP thread resolution for ${day5Leads.length} Day 5 leads...`);
  const rows = [['email', 'subject', 'body', 'status', 'sent_at', 'in_reply_to', 'is_followup']];

  let resolvedCount = 0;

  for (let i = 0; i < day5Leads.length; i++) {
    const lead = day5Leads[i];
    process.stdout.write(`[${i + 1}/${day5Leads.length}] Resolving thread for ${lead.email}... `);

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
    const bumpBody = `Hi ${lead.name || 'there'},

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
  const targetPath = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender/contacts_engine2_day5_followups.csv';
  fs.writeFileSync(targetPath, csvContent, 'utf-8');

  console.log(`\n🎉 Day 5 Follow-ups generated successfully!`);
  console.log(`Total leads: ${day5Leads.length}`);
  console.log(`Natively resolved threads: ${resolvedCount}`);
  console.log(`Unthreaded bumps: ${day5Leads.length - resolvedCount}`);
  console.log(`Saved to: ${targetPath}`);
}

main().catch(err => {
  console.error('Fatal error resolving threads:', err);
  process.exit(1);
});
