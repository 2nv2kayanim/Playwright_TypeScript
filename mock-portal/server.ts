import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

type BenefitType = 'Health' | 'Dental';
type JsonRecord = Record<string, unknown>;

const host = process.env.MOCK_PORTAL_HOST ?? '127.0.0.1';
const port = Number(process.env.MOCK_PORTAL_PORT ?? 3000);
const testEmail = process.env.BENEFITS_TEST_EMAIL || 'test.user@example.com';
const testPassword = process.env.BENEFITS_TEST_PASSWORD || 'TestPassword123!';
const balances: Record<BenefitType, number> = {
  Health: 1_250,
  Dental: 500,
};
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError(`MOCK_PORTAL_PORT must be a valid TCP port; received "${port}".`);
}

const loginPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in | Group Benefits Portal</title>
  </head>
  <body>
    <main>
      <h1>Group Benefits Portal</h1>
      <form id="login-form">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button type="submit">Sign in</button>
      </form>
      <p id="login-error" role="alert" hidden></p>
    </main>
    <script>
      const loginForm = document.querySelector('#login-form');
      const loginError = document.querySelector('#login-error');
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.get('email'),
            password: formData.get('password')
          })
        });
        if (response.ok) {
          window.location.assign('/benefits');
          return;
        }
        loginError.textContent = 'Email address or password is incorrect.';
        loginError.hidden = false;
      });
    </script>
  </body>
</html>`;

const benefitsPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My benefits | Group Benefits Portal</title>
  </head>
  <body>
    <main>
      <h1>My benefits</h1>
      <section aria-labelledby="health-heading">
        <h2 id="health-heading">Health coverage</h2>
        <p>Remaining balance: <output aria-label="Health remaining balance">${formatCurrency(balances.Health)}</output></p>
      </section>
      <section aria-labelledby="dental-heading">
        <h2 id="dental-heading">Dental coverage</h2>
        <p>Remaining balance: <output aria-label="Dental remaining balance">${formatCurrency(balances.Dental)}</output></p>
      </section>
      <section aria-labelledby="claim-heading">
        <h2 id="claim-heading">Submit a claim</h2>
        <form id="claim-form">
          <label for="benefit-type">Benefit type</label>
          <select id="benefit-type" name="benefitType">
            <option value="Health">Health</option>
            <option value="Dental">Dental</option>
          </select>
          <label for="claim-amount">Claim amount</label>
          <input id="claim-amount" name="amount" type="number" min="0.01" step="0.01" required>
          <label for="claim-description">Claim description</label>
          <textarea id="claim-description" name="description" required></textarea>
          <button type="submit">Submit claim</button>
        </form>
        <p id="claim-error" role="alert" hidden></p>
        <p id="claim-status" role="status" hidden></p>
      </section>
    </main>
    <script>
      const claimForm = document.querySelector('#claim-form');
      const claimError = document.querySelector('#claim-error');
      const claimStatus = document.querySelector('#claim-status');
      claimForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        claimError.hidden = true;
        claimStatus.hidden = true;
        const formData = new FormData(claimForm);
        const response = await fetch('/api/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benefitType: formData.get('benefitType'),
            amount: Number(formData.get('amount')),
            description: formData.get('description')
          })
        });
        const result = await response.json();
        if (!response.ok) {
          claimError.textContent = result.message;
          claimError.hidden = false;
          return;
        }
        claimStatus.textContent = 'Claim submitted successfully.';
        claimStatus.hidden = false;
      });
    </script>
  </body>
</html>`;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function sendJson(response: ServerResponse, statusCode: number, body: JsonRecord): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function isAuthenticated(request: IncomingMessage): boolean {
  return request.headers.cookie
    ?.split(';')
    .some((cookie) => cookie.trim() === 'benefits_session=mock-session') ?? false;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (request.method === 'GET' && requestUrl.pathname === '/login') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(loginPage);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/login') {
    let payload: unknown;
    try {
      payload = await readJson(request);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: 'Request body must be valid JSON.' });
        return;
      }
      throw error;
    }

    if (
      isJsonRecord(payload) &&
      payload.email === testEmail &&
      payload.password === testPassword
    ) {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'benefits_session=mock-session; HttpOnly; SameSite=Lax; Path=/',
      });
      response.end(JSON.stringify({ authenticated: true }));
      return;
    }

    sendJson(response, 401, { message: 'Invalid credentials.' });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/benefits') {
    if (!isAuthenticated(request)) {
      response.writeHead(302, { Location: '/login' });
      response.end();
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(benefitsPage);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/claims') {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { message: 'Authentication is required.' });
      return;
    }

    let payload: unknown;
    try {
      payload = await readJson(request);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: 'Request body must be valid JSON.' });
        return;
      }
      throw error;
    }

    if (!isJsonRecord(payload)) {
      sendJson(response, 400, { message: 'Claim details are required.' });
      return;
    }

    const benefit = payload.benefitType;
    const amount = payload.amount;
    const description = payload.description;
    if (
      (benefit !== 'Health' && benefit !== 'Dental') ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      typeof description !== 'string' ||
      description.trim().length === 0
    ) {
      sendJson(response, 400, { message: 'Claim details are invalid.' });
      return;
    }

    if (amount > balances[benefit]) {
      sendJson(response, 422, {
        message: 'Claim amount exceeds your available coverage limit.',
      });
      return;
    }

    sendJson(response, 201, { submitted: true });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    console.error('Mock portal request failed:', error);
    if (!response.headersSent) {
      sendJson(response, 500, { message: 'An unexpected mock portal error occurred.' });
      return;
    }
    response.destroy(error instanceof Error ? error : undefined);
  });
});

server.listen(port, host, () => {
  console.log(`Mock Group Benefits Portal listening at http://${host}:${port}`);
});
