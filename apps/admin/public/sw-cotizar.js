/*
 * Acceso directo a los cotizadores (2026-10-29): lo que piden los navegadores
 * para ofrecer "Instalar". No guarda nada: todo va a la red como siempre (los
 * precios tienen que ser los de hoy). Si no hay señal, una pantalla que lo dice
 * en vez del dinosaurio del navegador.
 */
const SIN_CONEXION = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b0d11;color:#e7ebf1;font-family:system-ui,sans-serif;text-align:center">
<div><h1 style="font-size:20px;margin:0 0 8px">Sin conexión</h1>
<p style="margin:0 0 18px;color:#9aa4b2">El cotizador necesita internet para usar los precios de hoy. Revisa tu señal.</p>
<button onclick="location.reload()" style="height:40px;padding:0 18px;border:0;border-radius:8px;background:#1E90FF;color:#fff;font-weight:600">Reintentar</button></div>
</body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(SIN_CONEXION, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
