import tls from 'node:tls';

/**
 * Thread Resolver for Gmail Agent Sender
 * Connects via IMAP over native TLS to [Gmail]/Sent Mail to locate the original
 * sent email to a recipient, extracting its Message-ID, Subject, and Date.
 * This enables 100% native email threading (In-Reply-To & References RFC headers).
 */
export async function resolveOriginalThread({ user, password, toEmail }) {
  const cleanPassword = (password || '').replace(/\s+/g, '');
  const cleanEmail = (toEmail || '').trim().toLowerCase();

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      servername: 'imap.gmail.com',
      timeout: 12000,
    });

    let buffer = '';
    let step = 0;
    let result = { found: false, messageId: null, subject: '', date: '' };

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners('data');
      socket.removeAllListeners('timeout');
      socket.removeAllListeners('close');
      socket.removeAllListeners('end');
      socket.on('error', () => {}); // swallow post-closure errors
      try {
        socket.destroy();
      } catch (_) {}
    };

    socket.on('error', (err) => {
      cleanup();
      resolve({ found: false, error: err.message });
    });

    socket.on('timeout', () => {
      cleanup();
      resolve({ found: false, error: 'IMAP timeout' });
    });

    socket.on('data', (data) => {
      buffer += data.toString('utf-8');

      if (step === 0 && buffer.includes('* OK')) {
        step = 1;
        buffer = '';
        socket.write(`A01 LOGIN "${user}" "${cleanPassword}"\r\n`);
      } else if (step === 1 && buffer.includes('A01 OK')) {
        step = 2;
        buffer = '';
        socket.write(`A02 SELECT "[Gmail]/Sent Mail"\r\n`);
      } else if (step === 1 && buffer.includes('A01 NO')) {
        cleanup();
        resolve({ found: false, error: 'IMAP Authentication failed' });
      } else if (step === 2 && buffer.includes('A02 OK')) {
        step = 3;
        buffer = '';
        socket.write(`A03 SEARCH TO "${cleanEmail}"\r\n`);
      } else if (step === 3 && buffer.includes('A03 OK')) {
        const match = buffer.match(/\* SEARCH ([\d\s]+)/);
        const seqs = match ? match[1].trim().split(/\s+/).filter(Boolean) : [];
        if (seqs.length > 0) {
          const lastSeq = seqs[seqs.length - 1]; // most recent email sent to this contact
          step = 4;
          buffer = '';
          socket.write(`A04 FETCH ${lastSeq} (BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT DATE)])\r\n`);
        } else {
          step = 5;
          buffer = '';
          socket.write(`A05 LOGOUT\r\n`);
        }
      } else if (step === 4 && buffer.includes('A04 OK')) {
        const msgIdMatch = buffer.match(/Message-ID:\s*(<[^>]+>)/i);
        const subjectMatch = buffer.match(/Subject:\s*([^\r\n]+)/i);
        const dateMatch = buffer.match(/Date:\s*([^\r\n]+)/i);

        let subject = subjectMatch ? subjectMatch[1].trim() : '';
        const mimeMatch = subject.match(/=\?UTF-8\?B\?([^?]+)\?=/i);
        if (mimeMatch) {
          try {
            subject = Buffer.from(mimeMatch[1], 'base64').toString('utf-8');
          } catch (e) {}
        }

        if (msgIdMatch) {
          result = {
            found: true,
            messageId: msgIdMatch[1].trim(),
            subject: subject || '',
            date: dateMatch ? dateMatch[1].trim() : '',
          };
        }

        step = 5;
        buffer = '';
        socket.write(`A05 LOGOUT\r\n`);
      } else if (step === 5 && (buffer.includes('A05 OK') || buffer.includes('* BYE'))) {
        cleanup();
        resolve(result);
      }
    });
  });
}
