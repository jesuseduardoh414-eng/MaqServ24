import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tipoDeCatalogo } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProductForm } from '@/components/ProductForm';
import { D } from '@/components/design-tokens';

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
    const tarjeta: React.CSSProperties = {
      display: 'block', textDecoration: 'none', color: D.text, background: D.card,
      border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: 22,
    };
    return (
      <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '4px 0 40px' }}>
          <Link href={proveedor ? '/proveedores' : '/catalogo/servicios'} style={{ fontSize: 12.5, color: D.muted2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="ph ph-arrow-left" /> {proveedor ? 'Proveedores' : 'Servicios'}
          </Link>
          <h1 style={{ margin: '8px 0 4px', fontSize: 26, letterSpacing: '-0.02em', color: D.text }}>¿Qué vas a dar de alta?</h1>
          {proveedor ? (
            <p style={{ margin: '0 0 22px', fontSize: 13.5, color: D.muted2 }}>
              A nombre de <strong style={{ color: D.text }}>{proveedor.name}</strong>. Según lo que elijas cambian las preguntas.
            </p>
          ) : <div style={{ height: 18 }} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <Link href={`${base}servicio`} style={tarjeta}>
              <i className="ph ph-wrench" style={{ fontSize: 26, color: D.accent }} />
              <h2 style={{ margin: '10px 0 6px', fontSize: 18 }}>Un servicio</h2>
              <p style={{ margin: 0, fontSize: 13.5, color: D.muted2, lineHeight: 1.55 }}>
                Se cotiza: renta de maquinaria, pipas y volteos, triturados, materiales o asfalto. Lleva tarifas por día,
                viaje, tonelada o m³, mínimo, horario y traslado.
              </p>
            </Link>
            <Link href={`${base}producto`} style={{ ...tarjeta, opacity: hayCategoriasDeProducto ? 1 : 0.75 }}>
              <i className="ph ph-package" style={{ fontSize: 26, color: D.accent }} />
              <h2 style={{ margin: '10px 0 6px', fontSize: 18 }}>Un producto</h2>
              <p style={{ margin: 0, fontSize: 13.5, color: D.muted2, lineHeight: 1.55 }}>
                Se vende a precio fijo y va al carrito, con existencias. Para artículos que no se cotizan.
              </p>
              {!hayCategoriasDeProducto ? (
                <p style={{ margin: '10px 0 0', fontSize: 12.5, color: D.warn }}>
                  Primero crea una categoría de productos en Catálogo → Categorías.
                </p>
              ) : null}
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {tipo === 'producto' && !hayCategoriasDeProducto ? (
        <div style={{ maxWidth: 1120, margin: '0 auto 16px', padding: '12px 16px', borderRadius: 12, border: `1px solid color-mix(in srgb, ${D.warn} 45%, transparent)`, color: D.text, fontSize: 13.5 }}>
          No hay categorías de productos todavía (las cinco líneas son de servicios). Crea una en{' '}
          <Link href="/categorias" style={{ color: D.accent, fontWeight: 700 }}>Catálogo → Categorías</Link> para poder guardar el producto.
        </div>
      ) : null}
      <ProductForm initial={proveedor ? { providerId: proveedor.id } : {}} categories={categories} providers={providers} tipo={tipo} />
    </AdminShell>
  );
}
