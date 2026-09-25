import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Consulta un código de barras para saber si ya existe en el sistema.
 * Si existe, retorna el último precio registrado para que la app informe:
 * "Este producto se registró hace X tiempo a $Y".
 */
export async function lookupBarcode(req: Request, res: Response) {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Código de barras requerido' });
    }

    const product = await prisma.product.findUnique({
      where: { barcode: barcode.trim() },
      include: {
        priceEntries: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            store: true,
            user: { select: { username: true } }
          }
        }
      }
    });

    if (!product) {
      return res.status(200).json({
        success: true,
        exists: false,
        barcode: barcode.trim(),
        message: 'Código no registrado previamente. Debe llenarse el formulario de nuevo producto.'
      });
    }

    const latestEntry = product.priceEntries[0] || null;
    const daysSince = latestEntry
      ? Math.floor((Date.now() - new Date(latestEntry.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return res.status(200).json({
      success: true,
      exists: true,
      data: {
        product: {
          id: product.id,
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          category: product.category
        },
        latestPriceEntry: latestEntry
          ? {
              price: Number(latestEntry.reportedPrice),
              originalPrice: latestEntry.originalPrice ? Number(latestEntry.originalPrice) : null,
              discountPercent: latestEntry.discountPercent,
              store: `${latestEntry.store.name} (${latestEntry.store.branch})`,
              createdAt: latestEntry.createdAt,
              daysSinceLastReport: daysSince,
              registeredBy: latestEntry.user.username,
              notes: latestEntry.notes
            }
          : null,
        recentSightingsCount: product.priceEntries.length
      }
    });
  } catch (error) {
    console.error('Error al consultar código:', error);
    return res.status(500).json({ success: false, message: 'Error en la búsqueda del código' });
  }
}

/**
 * Banco de Códigos y Liquidaciones de la Comunidad.
 * Permite buscar por término ("PlayStation 5", "Mayonesa", etc.) o filtrar por tienda.
 */
export async function searchCommunityDeals(req: Request, res: Response) {
  try {
    const { query, storeName, limit = '20' } = req.query;

    const whereClause: any = {};

    if (query && typeof query === 'string' && query.trim() !== '') {
      whereClause.OR = [
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { barcode: { contains: query.trim() } },
        { brand: { contains: query.trim(), mode: 'insensitive' } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      take: Math.min(Number(limit), 50),
      include: {
        priceEntries: {
          where: storeName
            ? {
                store: {
                  name: { contains: String(storeName).trim(), mode: 'insensitive' }
                }
              }
            : undefined,
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            store: true,
            user: { select: { username: true, reputation: true } }
          }
        }
      }
    });

    // Filtrar productos que tengan al menos 1 reporte de precio
    const formatted = products
      .filter(p => p.priceEntries.length > 0)
      .map(p => {
        const latest = p.priceEntries[0];
        const allPrices = p.priceEntries.map(e => Number(e.reportedPrice));
        return {
          id: p.id,
          barcode: p.barcode,
          name: p.name,
          category: p.category,
          latestDeal: {
            price: Number(latest.reportedPrice),
            originalPrice: latest.originalPrice ? Number(latest.originalPrice) : null,
            discountPercent: latest.discountPercent,
            priceType: latest.priceType,
            store: `${latest.store.name} - ${latest.store.branch}`,
            city: latest.store.city,
            reportedAt: latest.createdAt,
            hunter: latest.user.username,
            notes: latest.notes
          },
          lowestReportedPrice: Math.min(...allPrices)
        };
      });

    return res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Error en búsqueda comunitaria:', error);
    return res.status(500).json({ success: false, message: 'Error al buscar en el banco de ofertas' });
  }
}
