#!/usr/bin/env node
/**
 * Empaqueta las 3 apps para subirlas a cPanel ("Setup Node.js App" / Passenger).
 *
 *   node scripts/empaquetar-cpanel.cjs             -> las tres
 *   node scripts/empaquetar-cpanel.cjs web admin   -> solo esas
 *   node scripts/empaquetar-cpanel.cjs --zip       -> ademas genera los .zip
 *   node scripts/empaquetar-cpanel.cjs --sin-build -> reutiliza el build anterior
 *
 * Deja en `dist-cpanel/` una carpeta por app, AUTOCONTENIDA: se sube tal cual y
 * en el servidor NO hace falta `npm install` ni `pnpm`. Eso es a proposito:
 * cPanel corre `npm install`, que no sabe resolver los `workspace:*` de pnpm, y
 * el hosting compartido normalmente no tiene RAM para un `next build`.
 *
 * Las tres trampas que este script resuelve (todas comprobadas, no teoricas):
 *
 *  1. SYMLINKS. `pnpm deploy` arma node_modules con enlaces simbolicos a rutas
 *     de TU PC. Al comprimir y descomprimir en cPanel llegan rotos. Por eso se
 *     fuerza `--config.node-linker=hoisted`: carpetas reales.
 *  2. MOTOR DE PRISMA. `pnpm deploy` reinstala @prisma/client desde cero y no
 *     corre `prisma generate`, asi que el paquete sale sin motor de consulta.
 *     Aqui se copia el cliente ya generado, que incluye los binarios de Linux
 *     gracias a `binaryTargets` en schema.prisma.
 *  3. ESTATICOS DE NEXT. El bundle `standalone` NO incluye `.next/static` ni
 *     `public`; si no se copian a mano, el sitio carga sin CSS ni imagenes.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const salida = path.join(raiz, 'dist-cpanel');

const argv = process.argv.slice(2);
const conZip = argv.includes('--zip');
const sinBuild = argv.includes('--sin-build');
const pedidas = argv.filter((a) => !a.startsWith('--'));
const validas = ['web', 'admin', 'api'];
const apps = pedidas.length ? pedidas : validas;

for (const a of apps) {
  if (!validas.includes(a)) {
    console.error(`App desconocida: "${a}". Validas: ${validas.join(', ')}`);
    process.exit(1);
  }
}

const log = (msg) => console.log(`\n== ${msg}`);

function correr(cmd) {
  execSync(cmd, { cwd: raiz, stdio: 'inherit', env: { ...process.env, BUILD_STANDALONE: '1' } });
}

/**
 * `next build --standalone` sobre pnpm CREA symlinks, y Windows no deja crearlos
 * salvo con el Modo de desarrollador encendido (o consola de administrador).
 * Sin esto el build muere con EPERM despues de varios minutos, asi que se
 * comprueba antes de empezar.
 */
function comprobarSymlinks() {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-check-'));
  try {
    fs.symlinkSync(dir, path.join(dir, 'prueba'), 'dir');
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Ruta del cliente Prisma ya generado dentro del store de pnpm. */
function clientePrismaGenerado() {
  const pnpmDir = path.join(raiz, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) return null;
  for (const dir of fs.readdirSync(pnpmDir)) {
    if (!dir.startsWith('@prisma+client@')) continue;
    const c = path.join(pnpmDir, dir, 'node_modules', '.prisma', 'client');
    if (fs.existsSync(path.join(c, 'schema.prisma'))) return c;
  }
  return null;
}

/** Dentro del bundle standalone, la carpeta que contiene el server.js real. */
function carpetaDelServer(destino, app) {
  for (const rel of [path.join('apps', app), '.']) {
    if (fs.existsSync(path.join(destino, rel, 'server.js'))) return rel;
  }
  return null;
}

function empaquetarNext(app) {
  log(`Empaquetando ${app} (Next.js standalone)`);
  const appDir = path.join(raiz, 'apps', app);
  const standalone = path.join(appDir, '.next', 'standalone');

  if (!fs.existsSync(standalone)) {
    throw new Error(
      `No existe ${path.relative(raiz, standalone)}.\n` +
        'El build tiene que correr con BUILD_STANDALONE=1 (este script ya lo hace; ' +
        'si usaste --sin-build, vuelve a compilar sin esa bandera).',
    );
  }

  const destino = path.join(salida, app);
  fs.rmSync(destino, { recursive: true, force: true });
  // `dereference`: convierte los symlinks que pnpm/Next dejan en archivos reales.
  // Un symlink dentro del ZIP llega roto a cPanel (trampa 1). Duplica algunos
  // paquetes y pesa mas, pero es la diferencia entre arrancar y no arrancar.
  fs.cpSync(standalone, destino, { recursive: true, dereference: true });

  const rel = carpetaDelServer(destino, app);
  if (!rel) throw new Error(`No encontre server.js dentro del bundle de ${app}.`);

  // Trampa 3: estaticos que Next NO mete en standalone.
  fs.cpSync(path.join(appDir, '.next', 'static'), path.join(destino, rel, '.next', 'static'), {
    recursive: true,
  });
  const publico = path.join(appDir, 'public');
  if (fs.existsSync(publico)) {
    fs.cpSync(publico, path.join(destino, rel, 'public'), { recursive: true });
  }

  // Passenger arranca el "Application startup file" desde la raiz de la app.
  // El server real quedo anidado (el bundle conserva la ruta del monorepo),
  // asi que se deja un cargador en la raiz.
  const relPosix = rel.split(path.sep).join('/');
  if (rel !== '.') {
    fs.writeFileSync(
      path.join(destino, 'server.js'),
      `// Arranque para cPanel/Passenger.\n` +
        `// El server real de Next vive en ${relPosix}/server.js: el bundle standalone\n` +
        `// conserva la estructura del monorepo. Este archivo solo lo carga.\n` +
        `// En cPanel, "Application startup file" = server.js (este).\n` +
        `require('./${relPosix}/server.js');\n`,
    );
  }

  asegurarSharpLinux(destino);
  avisarSymlinks(destino, app);
  console.log(`  OK  dist-cpanel/${app}   (arranque: server.js)`);
}

/**
 * Trampa 4: `next/image` optimiza en el servidor y para eso Next necesita
 * `sharp`, que trae un binario POR PLATAFORMA. Compilando en Windows solo se
 * instala @img/sharp-win32-x64, asi que en cPanel (Linux) toda imagen servida
 * por /_next/image responderia error 500.
 *
 * Se baja aqui el binario de Linux. Si el build se hizo en Linux (el workflow
 * de GitHub) ya esta y no se hace nada.
 */
function asegurarSharpLinux(destino) {
  const modulos = path.join(destino, 'node_modules');
  const yaEsta = path.join(modulos, '@img', 'sharp-linux-x64', 'lib', 'sharp-linux-x64.node');
  if (fs.existsSync(yaEsta)) {
    console.log('  OK  sharp para Linux ya incluido');
    return;
  }

  // Version exacta de sharp que resolvio el build, para no mezclar.
  let version = '0.34.5';
  const pkgSharp = path.join(modulos, 'sharp', 'package.json');
  if (fs.existsSync(pkgSharp)) version = JSON.parse(fs.readFileSync(pkgSharp, 'utf8')).version;

  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sharp-linux-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"tmp","version":"1.0.0"}');
    // `--libc=glibc` es imprescindible: sin el, npm ignora --os/--cpu y no baja
    // nada (comprobado). Con el, trae @img/sharp-linux-x64 y libvips.
    execSync(
      `npm install --prefix "${tmp}" --cpu=x64 --os=linux --libc=glibc ` +
        `--include=optional --no-save --no-audit --no-fund sharp@${version}`,
      { stdio: 'pipe' },
    );
    const origen = path.join(tmp, 'node_modules');
    for (const entrada of fs.readdirSync(origen)) {
      fs.cpSync(path.join(origen, entrada), path.join(modulos, entrada), {
        recursive: true,
        dereference: true,
        force: true,
      });
    }
    console.log(`  OK  sharp ${version} para Linux anadido`);
  } catch (e) {
    console.warn(`  AVISO no pude anadir sharp para Linux: ${e.message.split('\n')[0]}`);
    console.warn('        Sin el, /_next/image dara error en cPanel. Opciones:');
    console.warn('        - compilar con el workflow de GitHub (Linux), o');
    console.warn("        - poner `images: { unoptimized: true }` en next.config.ts");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function empaquetarApi() {
  log('Empaquetando api (NestJS)');
  const destino = path.join(salida, 'api');
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(salida, { recursive: true });

  // --legacy: pnpm 10 exige `inject-workspace-packages` para el deploy moderno.
  // --config.node-linker=hoisted: node_modules de carpetas reales (trampa 1).
  correr(
    `pnpm deploy --legacy --prod --filter @maqserv/api --config.node-linker=hoisted "${destino}"`,
  );

  // Trampa 2: reponer el cliente Prisma con sus motores.
  const generado = clientePrismaGenerado();
  if (!generado) {
    throw new Error(
      'No encontre el cliente Prisma generado. Corre antes:\n  pnpm --filter @maqserv/db generate',
    );
  }
  const motores = fs
    .readdirSync(generado)
    .filter((f) => f.startsWith('libquery_engine-') && f.endsWith('.so.node'));
  if (motores.length === 0) {
    throw new Error(
      'El cliente Prisma no trae motores de Linux. Revisa `binaryTargets` en\n' +
        'packages/db/prisma/schema.prisma y repite `pnpm --filter @maqserv/db generate`.',
    );
  }
  const destPrisma = path.join(destino, 'node_modules', '.prisma', 'client');
  fs.rmSync(destPrisma, { recursive: true, force: true });
  fs.cpSync(generado, destPrisma, { recursive: true });
  // Restos de `prisma generate` interrumpidos en Windows: pesan y no sirven.
  for (const f of fs.readdirSync(destPrisma)) {
    if (f.includes('.tmp')) fs.rmSync(path.join(destPrisma, f), { force: true });
  }
  console.log(`  OK  motores Prisma: ${motores.join(', ')}`);

  // Fuera el codigo fuente: en el servidor solo corre dist/.
  for (const sobra of ['src', 'tsconfig.json', 'nest-cli.json']) {
    fs.rmSync(path.join(destino, sobra), { recursive: true, force: true });
  }

  avisarSymlinks(destino, 'api');
  console.log('  OK  dist-cpanel/api   (arranque: dist/main.js)');
}

/** Un symlink sobreviviente llega roto a cPanel: mejor enterarse aqui. */
function avisarSymlinks(destino, app) {
  let encontrado = null;
  const recorrer = (dir, prof) => {
    if (prof > 6 || encontrado) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (encontrado) return;
      const p = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        encontrado = p;
        return;
      }
      if (e.isDirectory()) recorrer(p, prof + 1);
    }
  };
  recorrer(destino, 0);
  if (encontrado) {
    console.warn(`  AVISO ${app}: hay symlinks (${path.relative(salida, encontrado)}).`);
    console.warn('        Al comprimir y subir llegaran rotos.');
  }
}

function comprimir(app) {
  const destino = path.join(salida, app);
  const zip = `${destino}.zip`;
  log(`Comprimiendo ${app} (puede tardar varios minutos)`);
  fs.rmSync(zip, { force: true });
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${destino}\\*' -DestinationPath '${zip}' -Force"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`cd "${destino}" && zip -rqy "${zip}" .`, { stdio: 'inherit' });
  }
  const mb = (fs.statSync(zip).size / 1024 / 1024).toFixed(0);
  console.log(`  OK  dist-cpanel/${app}.zip (${mb} MB)`);
}

// ---------------------------------------------------------------------------

if (!sinBuild) {
  const necesitaSymlinks = apps.some((a) => a !== 'api');
  if (necesitaSymlinks && !comprobarSymlinks()) {
    console.error(
      '\nEste sistema no permite crear symlinks, y `next build --standalone`\n' +
        'los necesita: el build moriria con EPERM a mitad de camino.\n' +
        '\nArreglo (una sola vez, en Windows):\n' +
        '  Configuracion > Sistema > Para programadores > Modo de programador: ACTIVADO\n' +
        '  Luego cierra y vuelve a abrir la terminal.\n' +
        '\nAlternativa sin tocar Windows: compila en Linux con el workflow\n' +
        '  .github/workflows/empaquetar-cpanel.yml  (ver DEPLOY-CPANEL.md, fase 4B).\n',
    );
    process.exit(1);
  }
  log(`Compilando con BUILD_STANDALONE=1 (${apps.join(', ')})`);
  correr(`pnpm ${apps.map((a) => `--filter @maqserv/${a}...`).join(' ')} build`);
}

fs.mkdirSync(salida, { recursive: true });
for (const app of apps) {
  if (app === 'api') empaquetarApi();
  else empaquetarNext(app);
}
if (conZip) for (const app of apps) comprimir(app);

log('Listo');
console.log(`Carpetas en: ${salida}`);
console.log('Sigue DEPLOY-CPANEL.md a partir de la fase 4.');
