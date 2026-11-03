import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function crmApiDevPlugin() {
  return {
    name: 'crm-api-dev-plugin',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url?.split('?')[0];

        if (url === '/api/crm' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            let parsed: any = {};
            try { parsed = JSON.parse(body); } catch (_) {}

            // Google Sheets CSV proxy does not require Postgres
            if (parsed && parsed.action === 'fetch_google_sheet_csv' && parsed.url) {
              try {
                const resp = await fetch(parsed.url, {
                  redirect: 'follow',
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  }
                });
                if (!resp.ok) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    status: 'error',
                    message: `Ошибка загрузки таблицы Google (HTTP ${resp.status}: ${resp.statusText})`
                  }));
                  return;
                }
                const text = await resp.text();
                if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    status: 'error',
                    code: 'PRIVATE_SHEET',
                    message: 'Таблица закрыта настройками приватности Google. Откройте доступ по ссылке: в таблице нажмите «Поделиться» ➔ выберите «Все, у кого есть ссылка: Читатель».'
                  }));
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  status: 'success',
                  csv: text
                }));
                return;
              } catch (err: any) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  status: 'error',
                  message: `Сетевая ошибка при загрузке таблицы: ${err?.message || err}`
                }));
                return;
              }
            }

            const hasPostgres = Boolean(
              process.env.POSTGRES_URL || 
              process.env.STOREGE_POSTGRES_URL || 
              process.env.POSTGRES_URL_NON_POOLING || 
              process.env.DATABASE_URL
            );

            if (hasPostgres) {
              try {
                const { default: handler } = await import('./api/crm');
                let parsed = {};
                try { parsed = JSON.parse(body); } catch (_) {}
                const mockReq = { method: 'POST', body: parsed };
                let responseSent = false;
                const mockRes = {
                  status(code: number) {
                    res.statusCode = code;
                    return this;
                  },
                  json(data: any) {
                    if (responseSent) return;
                    responseSent = true;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                  end() {
                    if (responseSent) return;
                    responseSent = true;
                    res.end();
                  }
                };
                await handler(mockReq, mockRes);
                return;
              } catch (e: any) {
                console.warn('[Vite Dev Server] Postgres handler error, falling back:', e?.message);
              }
            }

            // Return clean JSON indicating local fallback should be used (avoids 404 in dev console)
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'error',
              code: 'NO_DATABASE_URL',
              message: 'POSTGRES_URL is not defined in this environment. Local storage fallback active.'
            }));
          });
          return;
        }

        if (url === '/api/messages') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([]));
          return;
        }

        if (url === '/api/ping') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crmApiDevPlugin()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
