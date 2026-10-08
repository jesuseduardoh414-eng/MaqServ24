import type { ReactNode } from 'react';

/** Tabla básica del admin con el estilo del kit (`.adm-tbl` en globals.css). */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="adm-panel is-clip" style={{ overflowX: 'auto' }}>
      <table className="adm-tbl" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <td style={muted ? { color: 'var(--adm-muted)' } : undefined}>{children}</td>;
}
