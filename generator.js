/**
 * Dynamic AI Email Personalizer
 * Generates one-to-one conversational emails injecting {partner_name}, {firm_name}, and {bottleneck}.
 *
 * Employs Gemini API for distinct generation or an adaptive algorithmic template generator
 * to guarantee unique byte signatures across every message.
 */

export async function generatePersonalizedEmail({ partner_name, firm_name, bottleneck, apiKey }) {
  // If Gemini API Key is provided, call Gemini to generate unique copy
  if (apiKey && apiKey.trim() && apiKey !== 'your_gemini_api_key_here') {
    try {
      const generated = await callGeminiAPI({ partner_name, firm_name, bottleneck, apiKey });
      if (generated && generated.subject && generated.body) {
        return generated;
      }
    } catch (err) {
      console.warn(`[AI Engine] Gemini API call failed (${err.message}). Falling back to dynamic structural generator.`);
    }
  }

  // Dynamic Algorithmic Generator:
  // Randomizes sentence patterns, greetings, and closings to guarantee unique byte signatures per recipient
  return generateDynamicTemplate({ partner_name, firm_name, bottleneck });
}

async function callGeminiAPI({ partner_name, firm_name, bottleneck, apiKey }) {
  const prompt = `
You are writing a cold outreach email from a founder/consultant.
Recipient Details:
- Partner Name: ${partner_name}
- Firm Name: ${firm_name}
- Specific Bottleneck: ${bottleneck}

Rules:
1. Tone: Natural, friendly, concise, human (like a note typed in Gmail).
2. DO NOT use generic marketing fluff, buzzwords, or fake enthusiasm.
3. Keep the body under 90 words.
4. Output strict JSON with keys "subject" and "body".
5. In "body", use plain text only. No HTML tags, no tracking links, no markdown bold/italics.

Output format:
{
  "subject": "...",
  "body": "..."
}
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85, // Adds variation for unique byte signatures
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API returned status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini API');

  return JSON.parse(rawText);
}

function generateDynamicTemplate({ partner_name, firm_name, bottleneck }) {
  const firstName = partner_name.split(' ')[0] || partner_name;

  const subjectOptions = [
    `Quick note regarding ${firm_name}`,
    `Question about ${firm_name}'s workflow`,
    `${firm_name} & solving ${bottleneck}`,
    `Idea on ${bottleneck} for ${firm_name}`,
  ];

  const openings = [
    `Hi ${firstName},\n\nI was looking into ${firm_name} recently and noticed teams in your space often run into ${bottleneck}.`,
    `Hey ${firstName},\n\nHope your week is off to a solid start. Reaching out because several peers at ${firm_name} highlighted how ${bottleneck} slows down delivery.`,
    `Hi ${firstName},\n\nWanted to send a brief note directly to you at ${firm_name}. We've been looking closely at the friction caused by ${bottleneck}.`,
  ];

  const valueProps = [
    `We designed an automated workflow that cuts the turnaround time on this down to a couple of minutes without altering your current stack.`,
    `We recently put together a clean, lightweight agent setup that eliminates the manual back-and-forth around this completely.`,
    `Our focus is removing the operational drag here so your team can focus on execution rather than chasing updates.`,
  ];

  const callToActions = [
    `Are you open to a brief 5-minute glance at how it works next Tuesday?`,
    `Would it make sense to share a 2-minute walkthrough showing how we solved this for a similar firm?`,
    `Happy to send over a 1-page summary if you're exploring ways to streamline this.`,
  ];

  const closings = [
    `Best,\nAlex`,
    `Thanks,\nAlex`,
    `Cheers,\nAlex`,
  ];

  // Pick deterministic hash based on recipient details to ensure consistent yet distinct combinations
  const seed = (partner_name + firm_name + bottleneck)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const subject = subjectOptions[seed % subjectOptions.length];
  const opening = openings[seed % openings.length];
  const valueProp = valueProps[(seed >> 1) % valueProps.length];
  const cta = callToActions[(seed >> 2) % callToActions.length];
  const close = closings[(seed >> 3) % closings.length];

  const body = `${opening}\n\n${valueProp}\n\n${cta}\n\n${close}`;

  return { subject, body };
}
