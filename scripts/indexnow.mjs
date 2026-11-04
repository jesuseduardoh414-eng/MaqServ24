#!/usr/bin/env node
// IndexNow: avisa a Bing (y Yandex, Naver, Seznam, Yep) de URLs nuevas o cambiadas.
// Google no usa IndexNow. Node 18+, sin dependencias. Copiar a scripts/indexnow.mjs del proyecto.
//
// Requisitos:
//   1. Clave de 32 caracteres:  node -e "console.log(crypto.randomUUID().replaceAll('-',''))"
//   2. Archivo public/<clave>.txt cuyo contenido es la clave (se publica en https://dominio/<clave>.txt)
//   3. Variables INDEXNOW_KEY y SITE_URL (en .env o en el entorno de CI). La clave no es secreta,
//      pero se deja fuera del código para poder rotarla.
//
// Uso:
//   node scripts/indexnow.mjs https://dominio.com/a https://dominio.com/b   # URLs concretas
//   node scripts/indexnow.mjs --desde 2026-10-01                            # del sitemap, con lastmod >= fecha
//   node scripts/indexnow.mjs --todo                                        # todo el sitemap (solo la primera vez)
//   node scripts/indexnow.mjs --probar                                      # solo comprueba la clave publicada

const args = process.argv.slice(2)
const KEY = process.env.INDEXNOW_KEY
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '')
if (!KEY || !SITE) {
  console.error('Faltan INDEXNOW_KEY o SITE_URL.')
  process.exit(1)
}
const host = new URL(SITE).host
const keyLocation = `${SITE}/${KEY}.txt`
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow'

async function comprobarClave() {
  const r = await fetch(keyLocation)
  const texto = (await r.text()).trim()
  if (!r.ok || texto !== KEY) {
    console.error(`La clave no está publicada en ${keyLocation} (estado ${r.status}). Despliega public/${KEY}.txt primero.`)
    process.exit(1)
  }
  console.log(`Clave publicada correctamente en ${keyLocation}`)
}

async function urlsDelSitemap(desde) {
  const vistos = new Set()
  const urls = []
  async function leer(url) {
    if (vistos.has(url)) return
    vistos.add(url)
    const xml = await (await fetch(url)).text()
    // índice de sitemaps
    for (const m of xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/g)) await leer(m[1])
    for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1]
      const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1]
      if (!loc) continue
      if (desde && (!lastmod || new Date(lastmod) < desde)) continue
      urls.push(loc)
    }
  }
  await leer(`${SITE}/sitemap.xml`)
  return urls
}

async function enviar(urlList) {
  const ajenas = urlList.filter((u) => new URL(u).host !== host)
  if (ajenas.length) {
    console.error(`Estas URLs no son de ${host}:`, ajenas.join(', '))
    process.exit(1)
  }
  for (let i = 0; i < urlList.length; i += 10000) {
    const lote = urlList.slice(i, i + 10000)
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: KEY, keyLocation, urlList: lote }),
    })
    const significado = {
      200: 'aceptadas', 202: 'recibidas (la clave se validará después)', 400: 'petición mal formada',
      403: 'clave no válida o no publicada', 422: 'URLs que no son del dominio', 429: 'demasiadas peticiones',
    }[r.status] || 'respuesta inesperada'
    console.log(`IndexNow: ${lote.length} URL(s) → ${r.status} ${significado}`)
    if (r.status >= 400) process.exit(1)
  }
}

if (args.includes('--probar')) {
  await comprobarClave()
} else {
  await comprobarClave()
  let urls
  if (args.includes('--todo')) urls = await urlsDelSitemap(null)
  else if (args.includes('--desde')) urls = await urlsDelSitemap(new Date(args[args.indexOf('--desde') + 1]))
  else urls = args.filter((a) => a.startsWith('http'))
  if (!urls.length) {
    console.log('No hay URLs que enviar.')
  } else {
    await enviar([...new Set(urls)])
  }
}
