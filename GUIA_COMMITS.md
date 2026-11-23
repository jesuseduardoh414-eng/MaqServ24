# Cómo escribir tus commits (R4D Daily)

R4D Daily arma el avance diario y semanal del equipo **leyendo tus commits de GitHub**. Quien lee el resultado es el dueño del negocio, que **no es programador**. Por eso cada commit lleva dos cosas:

1. Una **primera línea** con un formato fijo (para clasificarlo).
2. Una **explicación en palabras normales** (para que el dueño entienda qué se hizo).

Si sigues esto, tu trabajo sale bien contado en Hoy, Semana, Proyectos y en el PDF semanal. No tienes que abrir ninguna herramienta extra: es solo cómo escribes el mensaje del commit.

---

## 0. Antes de empezar: conecta tu repositorio (una sola vez)

1. Entra a **https://crm-r4d-frontend.vercel.app** con tu cuenta.
2. Ve a **Mis repos** (menú izquierdo, sección Avances) y pulsa **Agregar repos**.
3. En GitHub elige dónde instalar la app **R4D Daily**: tu cuenta personal o una organización.
4. Marca **Only select repositories** y elige solo los repos que quieres reportar.
5. De regreso en Mis repos, asigna cada repo a su **proyecto** con el desplegable.
6. En **"Con qué hago commits"** agrega tu usuario de GitHub y los correos que usas en tus commits (ver sección 5).

Si tu repo es de una organización, un dueño de la organización tiene que aprobar la instalación una vez.

---

## 1. El formato

```
tipo(módulo): qué se hizo

Explicación para el dueño, en palabras normales.

Ticket: PI-12
```

| Parte | Obligatoria | Qué poner |
|---|---|---|
| `tipo` | Sí | Uno de la tabla de abajo |
| `(módulo)` | Recomendada | La parte del sistema que tocaste: `login`, `cotizaciones`, `carrito`, `reportes`… |
| `qué se hizo` | Sí | Una frase corta, en minúsculas, sin punto final |
| Explicación (cuerpo) | **Sí** | Qué cambia para el usuario o el negocio. Separada de la primera línea por **una línea en blanco** |
| `Ticket: PI-12` | Opcional | Liga el commit a un ticket |
| `Cierra: PI-12` | Opcional | Marca el ticket como terminado (pasa a revisión) |

### Tipos

El dueño no ve las palabras en inglés: ve el nombre de la derecha.

| Tipo | Úsalo cuando… | Lo ve el dueño como |
|---|---|---|
| `feat` | agregas algo nuevo | **Funcionalidad** |
| `fix` | arreglas un error | **Corrección** |
| `style` | cambias cómo se ve (colores, espacios, textos) sin cambiar lo que hace | **Diseño** |
| `refactor` | ordenas el código sin cambiar lo que hace | Mejora interna |
| `perf` | haces que algo vaya más rápido | Mejora interna |
| `test`, `docs`, `chore`, `build`, `ci` | pruebas, documentación, mantenimiento, configuración | Mejora interna |

---

## 2. Ejemplos

**Bien**

```
feat(cotizaciones): exporta la cotización a PDF

Ya se puede descargar cualquier cotización en PDF con el logo del cliente.
Falta la firma digital.

Ticket: PI-12
```

```
fix(login): la sesión se cerraba sola

La sesión duraba 5 minutos; ahora dura toda la jornada.
```

```
style(inicio): inicio adaptado a celular

La página de inicio ya se ve bien en teléfonos; antes se cortaban las fotos.
```

```
feat(pagos): agrega pago con tarjeta

El cliente ya puede pagar con tarjeta desde el checkout. Falta el recibo.

Cierra: PI-8
```

**Mal**

| Mensaje | Qué falla |
|---|---|
| `arreglos` | No dice qué ni dónde; no tiene tipo |
| `fix` | Sin descripción |
| `Update login.js` | Habla del archivo, no del resultado |
| `feat(api): refactor del servicio de pedidos con inyección de dependencias` | Técnico; el dueño no lo entiende |
| `fix(carrito): corrige el total` *(sin cuerpo)* | Falta la explicación: saldrá marcado **"sin explicación"** |

---

## 3. Cómo escribir la explicación

La explicación es para alguien que **no sabe programar**. Responde: *¿qué puede hacer ahora el usuario, o qué dejó de fallar?*

- Habla del **resultado**, no del código: "el cliente ya puede descargar el PDF", no "agregué el endpoint `/pdf`".
- Una o dos frases bastan.
- Evita palabras técnicas (endpoint, refactor, query, componente, hook, migración…). Si tienes que usarlas, dilo en simple.
- Si algo quedó pendiente, dilo: "Falta la firma digital".
- Un commit sin explicación **se guarda igual**, pero sale marcado con un aviso ámbar de "sin explicación" y el dueño lo ve.

---

## 3.1 Tickets

Cada proyecto tiene una clave corta (`PI`, `SQ`, `WB`…). Los tickets se llaman `PI-12`, `SQ-3`, etc.

| Escribe en el commit | Qué pasa |
|---|---|
| `Ticket: PI-12` | El commit queda ligado al ticket. Si estaba en **Por hacer**, pasa a **En curso** |
| `Cierra: PI-12` | El commit queda ligado y el ticket pasa a **En revisión** |
| `Ticket: PI-12, PI-13` | Varios tickets en el mismo commit |

- Ponlo **al final del cuerpo**, en su propia línea.
- `Cierra:` **no lo da por terminado**: el líder del proyecto o el admin revisa y lo aprueba como **Hecho**, o lo regresa a **En curso** con un comentario.
- La clave tiene que ser la de **ese proyecto**. Un `PI-12` en un repo ligado a otro proyecto se ignora.
- Si el ticket no está asignado a nadie, queda asignado a quien hizo el commit.

---

## 4. Cuándo cuenta tu trabajo

- Cuenta **cuando haces `push`**, no cuando haces `commit` en tu computadora. Si no empujas, no aparece.
- El día de trabajo **cierra a las 15:00** (sábados a las **13:00**).
- Lo que subas **después del cierre sigue contando para ese mismo día**, pero se marca como **"después del cierre"**.
- El **domingo** también se registra.
- Los commits de **merge** (`Merge pull request…`, `Merge branch…`) no cuentan como avances y no hace falta que sigan el formato.

---

## 5. Para que el commit sea tuyo

El sistema te reconoce por tu **usuario de GitHub** o por el **correo** con el que haces commits.

- Si instalaste la app desde tu cuenta personal, tu usuario de GitHub queda ligado solo.
- Si trabajas en un repo de la **organización**, entra a **Mis repos → "Con qué hago commits"** y agrega tu usuario de GitHub y/o tus correos.
- Revisa que tu correo de git coincida con uno de esos:
  ```
  git config user.email
  ```
  Si no, cámbialo: `git config --global user.email "tu@correo.com"`.

Si un commit no se puede ligar a nadie, se guarda con el nombre del autor pero **sin persona asignada**.

---

## 6. Plantilla para no olvidar el formato

Guarda esto como `~/.gitmessage`:

```
tipo(módulo): qué se hizo

# Explicación para el dueño, sin palabras técnicas:
# ¿Qué puede hacer ahora el usuario, o qué dejó de fallar?


# Ticket: PI-12
# Cierra: PI-12
```

Y actívala una sola vez:

```
git config --global commit.template ~/.gitmessage
```

A partir de ahí, `git commit` (sin `-m`) abre tu editor con la plantilla. Las líneas que empiezan con `#` no se guardan.

**Desde la terminal, en una línea:**

```
git commit -m "fix(carrito): corrige el total" \
           -m "El total ya suma bien el envío cuando hay dos o más productos." \
           -m "Ticket: PI-5"
```

Cada `-m` es un párrafo; GitHub los separa con línea en blanco.

**Desde la página de GitHub** (editar un archivo en el navegador): el título va en *Commit message* y la explicación en *Extended description*.

---

## 7. Lista rápida antes de hacer push

- [ ] La primera línea empieza con `feat`, `fix` o `style` (o refactor, perf, etc.) y tiene `(módulo)`.
- [ ] Hay una línea en blanco y debajo una explicación que entendería alguien que no programa.
- [ ] Si hay ticket, `Ticket:` o `Cierra:` al final, con la clave de **ese** proyecto.
- [ ] Mi correo de git es uno de los ligados en Mis repos.
- [ ] Hice `git push`.
