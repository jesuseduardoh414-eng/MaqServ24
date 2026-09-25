import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  /** Un número de query string solo si es válido: un `?minPrice=abc` no debe filtrar nada. */
  private static num(v: string | undefined): number | undefined {
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  /** Cuántos servicios y productos hay publicados: el sitio decide con esto qué pestañas enseña. */
  @Get('resumen')
  resumen() {
    return this.products.resumen();
  }

  @Get('products')
  listProducts(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('subcategory') subcategory?: string,
    @Query('featured') featured?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('availability') availability?: string,
    @Query('sort') sort?: string,
    @Query('kind') kind?: string,
  ) {
    // Valores fuera de catálogo se ignoran (no se filtra por basura de la URL).
    const avail = availability === 'now' || availability === 'rent' || availability === 'offer' ? availability : undefined;
    const order = sort === 'low' || sort === 'high' || sort === 'new' ? sort : undefined;
    return this.products.list({
      page: page ? Number(page) : undefined,
      search: search || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      featured: featured === '1' || featured === 'true',
      minPrice: CatalogController.num(minPrice),
      maxPrice: CatalogController.num(maxPrice),
      minRating: CatalogController.num(minRating),
      availability: avail,
      sort: order,
      kind: kind === 'servicio' || kind === 'producto' ? kind : undefined,
    });
  }

  /** Subcategorías activas de una categoría (para los filtros del catálogo). */
  @Get('categories/:slug/subcategories')
  async subcategories(@Param('slug') slug: string) {
    const cat = await prisma.categories.findUnique({ where: { cat_slug: slug } });
    if (!cat) return [];
    const subs = await prisma.subcategories.findMany({
      where: { category_id: cat.id, status: 1 },
      orderBy: { sub_name: 'asc' },
    });
    return subs.map((s) => ({ id: s.id, name: s.sub_name, slug: s.sub_slug }));
  }

  @Get('products/:id')
  productById(@Param('id', ParseIntPipe) id: number) {
    return this.products.byId(id);
  }

  @Get('categories')
  listCategories() {
    return this.categories.list();
  }
}
