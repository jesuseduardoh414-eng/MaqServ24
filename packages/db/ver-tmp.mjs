import { env } from './migrate/_env.mjs';
import pg from 'pg';
const c = new pg.Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query('select * from hero_sections');
r.rows.forEach(x=>console.log(JSON.stringify(x, null, 1)));
await c.end();
