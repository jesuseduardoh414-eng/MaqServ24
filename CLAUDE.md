# Instrucciones para Claude

## Commits

Todos los commits siguen [GUIA_COMMITS.md](GUIA_COMMITS.md). R4D Daily lee los commits de GitHub y arma el avance que revisa el dueño, que no es programador.

- Primera línea: `tipo(módulo): qué se hizo`, en minúsculas y sin punto final. Tipos: `feat`, `fix`, `style`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.
- El módulo es la parte del sistema que entiende quien lo usa: `login`, `cotizaciones`, `reportes`…
- Después, una línea en blanco y la explicación: qué puede hacer ahora el usuario o qué dejó de fallar, sin palabras técnicas. Si algo quedó pendiente, se dice.
- `Ticket: XX-n` o `Cierra: XX-n` sólo cuando el usuario da el ticket. No inventar claves.
- Un commit por cambio lógico, nunca commits automáticos con mensaje fijo.
- Nunca agregar coautor: sin `Co-Authored-By` ni ninguna mención a Claude o Anthropic en el mensaje. El avance es de quien hace el commit.
- Sólo se hace push cuando el usuario lo pide. El avance aparece en R4D Daily hasta que hay push.
