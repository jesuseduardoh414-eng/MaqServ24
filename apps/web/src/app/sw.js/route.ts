import { NextResponse } from 'next/server';

/**
 * Service worker de la PWA, servido en /sw.js.
 *
 * Va por route handler y no como archivo en `public/` por UNA razón: cada
 * compilación tiene que cambiar el archivo (aunque sea un byte) para que el
 * navegador instale el service worker nuevo y tire las cachés viejas. Aquí se
 * le pega la marca de la compilación (`BUILD_STAMP`, ver next.config.ts).
 *
 * QUÉ CACHEA Y QUÉ NO (lo importante para no romper nada):
 *  - HTML: NUNCA. Cada navegación va a la red; sin red, la página /sin-conexion.
 *    Cachear HTML mostraría precios viejos o la cabecera con una sesión que ya
 *    cerró. Lo que el panel publica sigue apareciendo al minuto, como hoy.
 *  - /_next/static: caché primero. Llevan hash en el nombre; nunca cambian.
 *  - /_next/image y activos de marca: sirve la copia y la renueva por detrás.
 *  - /api, /media y cualquier otro origen: ni se toca.
 *
 * Sin backticks ni `${}` dentro del código del worker: vive en un template
 * literal y se interpolarían.
 */
export const dynamic = 'force-dynamic';

const STAMP = process.env.BUILD_STAMP ?? 'dev';

const FUENTE = `
'use strict';
var VERSION = '__BUILD__';
var ESTATICOS = 'maqser24-estaticos-' + VERSION;
var IMAGENES = 'maqser24-imagenes-' + VERSION;
var ACTIVOS = 'maqser24-activos-' + VERSION;
var SIN_CONEXION = '/sin-conexion';
var PRECARGA = [SIN_CONEXION, '/manifest.webmanifest', '/pwa/icon-192.png', '/brand/maqser24-logo.png'];
var MAX_IMAGENES = 80;
var HTML_MINIMO = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#07090C;color:#F5F7FA;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:28px;margin:0 0 12px">Sin conexión</h1><p style="color:#A9B0B7;margin:0 0 24px">Revisa tu red y vuelve a intentarlo.</p><button onclick="location.reload()" style="font:inherit;font-weight:700;background:#008CFF;color:#07090C;border:0;padding:12px 24px;border-radius:6px;cursor:pointer">Reintentar</button></div></body></html>';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(ACTIVOS).then(function (c) {
      // Uno por uno y sin fallar la instalación: si una pieza no baja, el
      // worker se instala igual y la repone en cuanto la vea pasar.
      return Promise.all(PRECARGA.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('maqser24-') === 0 && k.slice(-VERSION.length) !== VERSION;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') { e.respondWith(navegar(req)); return; }
  if (url.pathname.indexOf('/_next/static/') === 0) { e.respondWith(cachePrimero(ESTATICOS, req)); return; }
  if (url.pathname.indexOf('/_next/image') === 0) { e.respondWith(cacheYRenovar(e, IMAGENES, req, MAX_IMAGENES)); return; }
  if (url.pathname.indexOf('/pwa/') === 0 || url.pathname.indexOf('/brand/') === 0 || url.pathname === '/manifest.webmanifest') {
    e.respondWith(cacheYRenovar(e, ACTIVOS, req, 0));
  }
  // Todo lo demás (/api, /media, /sw.js…) sigue su camino normal a la red.
});

function navegar(req) {
  return fetch(req).then(function (res) {
    // Mantener fresca la página sin conexión cada vez que se ve con red.
    if (res.ok && new URL(req.url).pathname === SIN_CONEXION) {
      var copia = res.clone();
      caches.open(ACTIVOS).then(function (c) { c.put(SIN_CONEXION, copia); });
    }
    return res;
  }).catch(function () {
    return caches.open(ACTIVOS).then(function (c) { return c.match(SIN_CONEXION); }).then(function (pagina) {
      return pagina || new Response(HTML_MINIMO, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    });
  });
}

function cachePrimero(nombre, req) {
  return caches.open(nombre).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res.ok) c.put(req, res.clone());
        return res;
      });
    });
  });
}

function cacheYRenovar(e, nombre, req, max) {
  return caches.open(nombre).then(function (c) {
    return c.match(req).then(function (hit) {
      var red = fetch(req).then(function (res) {
        if (res.ok) {
          return c.put(req, res.clone()).then(function () { return max ? recortar(c, max) : null; }).then(function () { return res; });
        }
        return res;
      }).catch(function () { return null; });
      if (hit) { e.waitUntil(red); return hit; }
      return red.then(function (res) { return res || Response.error(); });
    });
  });
}

function recortar(c, max) {
  return c.keys().then(function (keys) {
    if (keys.length <= max) return null;
    return Promise.all(keys.slice(0, keys.length - max).map(function (k) { return c.delete(k); }));
  });
}
`;

export function GET() {
  return new NextResponse(FUENTE.replace('__BUILD__', STAMP), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // El navegador revalida en cada comprobación; `updateViaCache: 'none'`
      // del registro hace lo mismo del lado del cliente.
      'Cache-Control': 'no-cache, max-age=0, must-revalidate',
    },
  });
}
