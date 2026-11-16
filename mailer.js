import tls from 'node:tls';

/**
 * Sends a pure text/plain email via Gmail SMTP (smtp.gmail.com:465) using native Node.js TLS.
 * ZERO third-party dependencies required.
 *
 * Adheres strictly to:
 * - MIME text/plain format (no tracking pixels, no HTML wrappers)
 * - RFC 5321 / RFC 5322 standards
 * - Resilient TLS socket lifecycle with automatic retry on transient ECONNRESET
 */
function sendEmailDirectSingle({ user, password, to, subject, body, inReplyTo, references }) {
  const cleanPassword = (password || '').replace(/\s+/g, '');
  const cleanBody = (body || '').replace(/\r?\n/g, '\r\n');

  return new Promise((resolve, reject) => {
    let buffer = '';
    let step = 'CONNECT';
    let settled = false;

    const socket = tls.connect({
      host: 'smtp.gmail.com',
      port: 465,
      servername: 'smtp.gmail.com',
      timeout: 25000,
    });

    const cleanup = () => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners('data');
      socket.removeAllListeners('timeout');
      socket.removeAllListeners('close');
      socket.removeAllListeners('end');
      socket.on('error', () => {}); // swallow any post-closure error events to prevent unhandled crash
      try {
        socket.destroy();
      } catch (_) {}
    };

    socket.on('error', (err) => {
      if (settled) return;
      cleanup();
      reject(new Error(`SMTP Connection Error: ${err.message}`));
    });

    socket.on('timeout', () => {
      if (settled) return;
      cleanup();
      reject(new Error('SMTP Connection timed out.'));
    });

    socket.on('close', (hadError) => {
      if (step !== 'DONE' && !settled) {
        cleanup();
        reject(new Error(`SMTP Socket closed unexpectedly during ${step}`));
      }
    });

    socket.on('end', () => {
      if (step !== 'DONE' && !settled) {
        cleanup();
        reject(new Error(`SMTP Socket ended unexpectedly during ${step}`));
      }
    });

    function sendCommand(cmd) {
      buffer = '';
      socket.write(cmd + '\r\n');
    }

    socket.on('data', (data) => {
      buffer += data.toString('utf-8');

      // An SMTP response may be multi-line (e.g. 250-... \r\n 250 ...).
      // The final line begins with the 3-digit code followed by a space ('250 ').
      const lines = buffer.split('\r\n').filter(Boolean);
      const lastLine = lines[lines.length - 1] || '';
      const match = lastLine.match(/^(\d{3})(?: (.*))?$/);

      if (!match) {
        // Not a complete SMTP line yet, keep buffering
        return;
      }

      const code = parseInt(match[1], 10);
      const msg = match[2] || '';

      try {
        switch (step) {
          case 'CONNECT':
            if (code !== 220) throw new Error(`Unexpected greeting: ${code} ${msg}`);
            step = 'EHLO';
            sendCommand('EHLO localhost');
            break;

          case 'EHLO':
            if (code !== 250) throw new Error(`EHLO rejected: ${code} ${msg}`);
            step = 'AUTH_LOGIN';
            sendCommand('AUTH LOGIN');
            break;

          case 'AUTH_LOGIN':
            if (code !== 334) throw new Error(`AUTH LOGIN failed: ${code} ${msg}`);
            step = 'AUTH_USER';
            sendCommand(Buffer.from(user).toString('base64'));
            break;

          case 'AUTH_USER':
            if (code !== 334) throw new Error(`Username rejected: ${code} ${msg}`);
            step = 'AUTH_PASS';
            sendCommand(Buffer.from(cleanPassword).toString('base64'));
            break;

          case 'AUTH_PASS':
            if (code !== 235) {
              throw new Error(`Authentication failed (${code} ${msg}). Check your GMAIL_USER and 16-character GMAIL_APP_PASSWORD.`);
            }
            step = 'MAIL_FROM';
            sendCommand(`MAIL FROM:<${user}>`);
            break;

          case 'MAIL_FROM':
            if (code !== 250) throw new Error(`MAIL FROM rejected: ${code} ${msg}`);
            step = 'RCPT_TO';
            sendCommand(`RCPT TO:<${to}>`);
            break;

          case 'RCPT_TO':
            if (code !== 250) throw new Error(`Recipient rejected (${to}): ${code} ${msg}`);
            step = 'DATA';
            sendCommand('DATA');
            break;

          case 'DATA':
            if (code !== 354) throw new Error(`DATA command rejected: ${code} ${msg}`);
            step = 'PAYLOAD';

            // Strictly text/plain UTF-8, no HTML, no tracking pixels, no bloated wrappers
            const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
            const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@gmail.com>`;

            const headersList = [
              `From: ${user}`,
              `To: ${to}`,
              `Subject: ${encodedSubject}`,
              `Date: ${new Date().toUTCString()}`,
              `Message-ID: ${messageId}`,
            ];

            if (inReplyTo) {
              headersList.push(`In-Reply-To: ${inReplyTo}`);
              headersList.push(`References: ${references || inReplyTo}`);
            }

            headersList.push(
              `MIME-Version: 1.0`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`
            );

            const rfcHeaders = headersList.join('\r\n');

            // Send headers + blank line + body + terminal '.'
            const fullPayload = `${rfcHeaders}\r\n\r\n${cleanBody}\r\n.\r\n`;
            buffer = '';
            socket.write(fullPayload);
            break;

          case 'PAYLOAD':
            if (code !== 250) throw new Error(`Message delivery rejected: ${code} ${msg}`);
            step = 'QUIT';
            sendCommand('QUIT');
            break;

          case 'QUIT':
            step = 'DONE';
            cleanup();
            resolve({ success: true, to, timestamp: new Date().toISOString() });
            break;

          default:
            cleanup();
            reject(new Error(`Unhandled SMTP state: ${step}`));
        }
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

/**
 * Resilient direct email sender with exponential backoff on transient network faults
 */
export async function sendEmailDirect(params, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendEmailDirectSingle(params);
    } catch (err) {
      const isTransient =
        err.message.includes('ECONNRESET') ||
        err.message.includes('closed unexpectedly') ||
        err.message.includes('ended unexpectedly') ||
        err.message.includes('timed out') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('EAI_AGAIN') ||
        err.message.includes('EHOSTUNREACH') ||
        err.message.includes('ENETUNREACH') ||
        err.message.includes('Connection Error');

      if (attempt < maxRetries && isTransient) {
        const waitMs = attempt * 4000;
        console.warn(`   ⚠️ [Transient Network Reset] ${err.message}. Retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}
