import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tipoDeCatalogo } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProductForm } from '@/components/ProductForm';
import { Note, PageHeader, Panel } from '@/components/ui';

/**
 * Alta de un servicio o producto. Con `?proveedor=<id>` (botón "Agregar" del
 * expediente del aliado) nace ya a nombre de ese aliado.
 *
 * SIN `?tipo=` PRIMERO SE PREGUNTA QUÉ ES (2026-09-25): un servicio se cotiza
 * (tarifas por día, viaje o tonelada, mínimo, horario, traslado) y un producto
 * se vende a precio fijo al carrito. El formulario cambia según la respuesta,
 * así que la pregunta va antes de llenarlo. Desde Catálogo → Servicios o
 * Productos el tipo ya viene decidido.
 */
export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ proveedor?: string; tipo?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'catalogo');
  const sp = await searchParams;
  const [categories, providers] = await Promise.all([
    adminFetch<Array<{ id: number; name: string; slug?: string; status?: number }>>('/admin/catalog/categories').then((c) => c ?? []),
    adminFetch<Array<{ id: number; name: string; level?: string }>>('/admin/catalog/providers').then((p) => p ?? []),
  ]);
  const pid = Number(sp.proveedor);
  const proveedor = Number.isInteger(pid) ? providers.find((p) => p.id === pid) : undefined;
  const tipo = sp.tipo === 'producto' ? 'producto' : sp.tipo === 'servicio' ? 'servicio' : null;
  const hayCategoriasDeProducto = categories.some((c) => tipoDeCatalogo(c.slug) === 'producto' && (c.status === undefined || c.status === 1));

  if (!tipo) {
    const base = `/productos/nuevo?${proveedor ? `proveedor=${proveedor.id}&` : ''}tipo=`;
    return (
      <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
        <style>{`
          a.alta-opcion.adm-trow { display: flex; align-items: flex-start; gap: 14px; padding-top: 18px; padding-bottom: 18px; }
          .alta-flecha { margin-left: auto; align-self: center; font-size: 16px; color: var(--adm-faint); transition: color .15s ease; }
          a.alta-opcion:hover .alta-flecha { color: var(--adm-text); }
        `}</style>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '4px 0 40px' }}>
          <PageHeader
            eyebrow={[[proveedor ? 'Proveedores' : 'Servicios', proveedor ? '/proveedores' : '/catalogo/servicios']]}
            title="¿Qué vas a dar de alta?"
            subtitle={proveedor ? (
              <>A nombre de <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{proveedor.name}</strong>. Según lo que elijas cambian las preguntas.</>
            ) : undefined}
          />
          {/* Es una elección entre dos, no dos tarjetas: una fila por opción en un solo panel. */}
          <Panel flush clip>
            <Link href={`${base}servicio`} className="adm-trow alta-opcion">
              <i className="ph ph-wrench" aria-hidden style={{ fontSize: 20, color: 'var(--adm-accent)', marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title">Un servicio</div>
                <p className="adm-cell-sub" style={{ margin: '3px 0 0', fontSize: 13.5, lineHeight: 1.55 }}>
                  Se cotiza: renta de maquinaria, pipas y volteos, triturados, materiales o asfalto. Lleva tarifas por día,
                  viaje, tonelada o m³, mínimo, horario y traslado.
                </p>
              </div>
              <i className="ph ph-arrow-right alta-flecha" aria-hidden />
            </Link>
            <Link href={`${base}producto`} className="adm-trow alta-opcion" style={{ opacity: hayCategoriasDeProducto ? 1 : 0.75 }}>
              <i className="ph ph-package" aria-hidden style={{ fontSize: 20, color: 'var(--adm-accent)', marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title">Un producto</div>
                <p className="adm-cell-sub" style={{ margin: '3px 0 0', fontSize: 13.5, lineHeight: 1.55 }}>
                  Se vende a precio fijo y va al carrito, con existencias. Para artículos que no se cotizan.
                </p>
                {!hayCategoriasDeProducto ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--adm-warn)' }}>
                    Primero crea una categoría de productos en Catálogo → Categorías.
                  </p>
                ) : null}
              </div>
              <i className="ph ph-arrow-right alta-flecha" aria-hidden />
            </Link>
          </Panel>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {tipo === 'producto' && !hayCategoriasDeProducto ? (
        <div style={{ maxWidth: 1120, margin: '0 auto 16px' }}>
          <Note tone="warn">
            No hay categorías de productos todavía (las cinco líneas son de servicios). Crea una en{' '}
            <Link href="/categorias" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Catálogo → Categorías</Link> para poder guardar el producto.
          </Note>
        </div>
      ) : null}
      <ProductForm initial={proveedor ? { providerId: proveedor.id } : {}} categories={categories} providers={providers} tipo={tipo} />
    </AdminShell>
  );
}
