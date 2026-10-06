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
        createdBy: {
          select: { id: true, username: true }
        },
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
      const brokenReportsCount = await prisma.barcodeReport.count({
        where: { barcode: barcode.trim(), type: 'BROKEN' }
      });
      const workingVotesCount = await prisma.barcodeReport.count({
        where: { barcode: barcode.trim(), type: 'WORKING' }
      });

      return res.status(200).json({
        success: true,
        exists: false,
        barcode: barcode.trim(),
        workingVotesCount,
        brokenReportsCount,
        isReportedBroken: brokenReportsCount >= 5,
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
          category: product.category,
          createdById: product.createdById,
          createdBy: product.createdBy ? {
            id: product.createdBy.id,
            username: product.createdBy.username
          } : null,
          workingVotesCount: product.workingVotesCount,
          brokenReportsCount: product.brokenReportsCount,
          isReportedBroken: product.brokenReportsCount >= 5
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
        recentSightingsCount: product.priceEntries.length,
        workingVotesCount: product.workingVotesCount,
        brokenReportsCount: product.brokenReportsCount,
        isReportedBroken: product.brokenReportsCount >= 5
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
          workingVotesCount: p.workingVotesCount,
          brokenReportsCount: p.brokenReportsCount,
          isReportedBroken: p.brokenReportsCount >= 5,
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

/**
 * Calificar o reportar un código de barras.
 * type: 'WORKING' (funciona en checador) | 'BROKEN' (no funciona / error en checador).
 * Si acumula 5 o más reportes de 'BROKEN', la app muestra una alerta comunitaria.
 */
export async function submitBarcodeFeedback(req: Request, res: Response) {
  try {
    const { barcode, type, reason, userId } = req.body;

    if (!barcode || !type || !['WORKING', 'BROKEN'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Código de barras y tipo de reporte válido (WORKING o BROKEN) requeridos'
      });
    }

    const cleanBarcode = String(barcode).trim();

    // Buscar si el producto existe
    const product = await prisma.product.findUnique({
      where: { barcode: cleanBarcode }
    });

    // Guardar reporte individual
    await prisma.barcodeReport.create({
      data: {
        barcode: cleanBarcode,
        productId: product ? product.id : null,
        userId: userId || null,
        type,
        reason: reason || null
      }
    });

    let updatedWorking = 0;
    let updatedBroken = 0;

    if (product) {
      const updatedProduct = await prisma.product.update({
        where: { id: product.id },
        data: {
          workingVotesCount: type === 'WORKING' ? { increment: 1 } : undefined,
          brokenReportsCount: type === 'BROKEN' ? { increment: 1 } : undefined
        }
      });
      updatedWorking = updatedProduct.workingVotesCount;
      updatedBroken = updatedProduct.brokenReportsCount;
    } else {
      updatedWorking = await prisma.barcodeReport.count({
        where: { barcode: cleanBarcode, type: 'WORKING' }
      });
      updatedBroken = await prisma.barcodeReport.count({
        where: { barcode: cleanBarcode, type: 'BROKEN' }
      });
    }

    const isReportedBroken = updatedBroken >= 5;

    return res.json({
      success: true,
      data: {
        barcode: cleanBarcode,
        type,
        workingVotesCount: updatedWorking,
        brokenReportsCount: updatedBroken,
        isReportedBroken
      },
      message:
        type === 'WORKING'
          ? '¡Gracias! Se registró que este código funciona en el checador.'
          : isReportedBroken
          ? 'Reporte registrado. Este código acumula 5 o más reportes y se alertará a la comunidad.'
          : `Reporte registrado (${updatedBroken}/5 reportes para alerta comunitaria).`
    });
  } catch (error) {
    console.error('Error al registrar feedback de código:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el reporte del código'
    });
  }
}

/**
 * Permite actualizar el nombre, marca o categoría del producto.
 * REGLA ESTRICTA: Sólo la persona que creó el código/producto puede editar su nombre o información.
 * Cualquier otro usuario sólo tiene permitido registrar nuevos precios.
 */
export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { userId, name, brand, category, description } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para editar el producto'
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id },
          { barcode: id }
        ]
      },
      include: {
        createdBy: { select: { id: true, username: true } }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Regla de Permisos: Si tiene creador y no coincide con el usuario actual, rechazar
    if (product.createdById && product.createdById !== userId) {
      const creatorName = product.createdBy?.username ? `@${product.createdBy.username}` : 'su creador';
      return res.status(403).json({
        success: false,
        message: `Este producto fue registrado por ${creatorName}. Únicamente su creador puede editar el nombre o código de barras. Puedes agregar un nuevo precio de liquidación.`
      });
    }

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name: name ? String(name).trim() : product.name,
        brand: brand !== undefined ? (brand ? String(brand).trim() : null) : product.brand,
        category: category !== undefined ? (category ? String(category).trim() : null) : product.category,
        description: description !== undefined ? (description ? String(description).trim() : null) : product.description,
        createdById: product.createdById || userId
      }
    });

    return res.json({
      success: true,
      message: 'Producto actualizado exitosamente por su creador',
      data: updated
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el producto'
    });
  }
}

