import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Validación del payload para registrar una nueva entrada de precio
const recordPriceSchema = z.object({
  barcode: z.string().min(6, 'El código de barras debe tener al menos 6 caracteres'),
  productName: z.string().min(2, 'El nombre del producto es requerido').optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  reportedPrice: z.number().positive('El precio reportado debe ser mayor a 0'),
  originalPrice: z.number().positive('El precio original debe ser mayor a 0').optional(),
  storeName: z.string().min(2, 'El nombre de la tienda es requerido'),
  storeBranch: z.string().min(2, 'La sucursal es requerida'),
  priceType: z.enum([
    'REGULAR',
    'PROMOTION',
    'LIQUIDATION_FIRST',
    'LIQUIDATION_SECOND',
    'LIQUIDATION_FINAL',
    'UNKNOWN'
  ]).default('LIQUIDATION_FINAL'),
  stockEstimate: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  photoProofUrl: z.string().url().optional(),
  userId: z.string({ required_error: 'El ID de usuario es obligatorio para registrar aportes' }).min(1, 'El ID de usuario es requerido')
});

/**
 * Registra un nuevo avistamiento de precio para un producto (nuevo o existente).
 * Requiere que el usuario esté autenticado para atribuirle la autoría y reputación comunitaria.
 */
export async function addPriceEntry(req: Request, res: Response) {
  try {
    const validatedData = recordPriceSchema.parse(req.body);

    const {
      barcode,
      productName,
      brand,
      category,
      reportedPrice,
      originalPrice,
      storeName,
      storeBranch,
      priceType,
      stockEstimate,
      notes,
      photoProofUrl,
      userId
    } = validatedData;

    // Verificar que el usuario exista en la BD (debe estar registrado/autenticado)
    const userRecord = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userRecord) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión con una cuenta registrada para poder agregar o compartir productos y liquidaciones.'
      });
    }

    // 1. Buscar o registrar la tienda física y sucursal
    const store = await prisma.store.upsert({
      where: {
        store_branch_unique: {
          name: storeName.trim(),
          branch: storeBranch.trim()
        }
      },
      update: {},
      create: {
        name: storeName.trim(),
        branch: storeBranch.trim()
      }
    });

    // 2. Buscar si el producto ya existe en nuestro banco de códigos
    const existingProduct = await prisma.product.findUnique({
      where: { barcode: barcode.trim() },
      include: {
        priceEntries: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Obtener el último precio registrado previo
          include: { store: true }
        }
      }
    });

    const previousEntry = existingProduct?.priceEntries[0] || null;
    let product = existingProduct;

    // Si el producto no existía, se crea su ficha inicial en el catálogo
    if (!product) {
      if (!productName) {
        return res.status(400).json({
          success: false,
          message: 'El producto es nuevo en el sistema. Debes proporcionar un nombre para registrarlo.'
        });
      }

      product = await prisma.product.create({
        data: {
          barcode: barcode.trim(),
          name: productName.trim(),
          brand: brand?.trim(),
          category: category?.trim()
        },
        include: {
          priceEntries: {
            include: { store: true }
          }
        }
      });
    }

    // 3. Calcular porcentaje de descuento
    // Prioridad: Contra originalPrice tachado de etiqueta, o contra el último precio registrado
    let calculatedDiscount: number | null = null;
    const basePrice = originalPrice ?? (previousEntry ? Number(previousEntry.reportedPrice) : null);

    if (basePrice && basePrice > reportedPrice) {
      calculatedDiscount = Math.round(((basePrice - reportedPrice) / basePrice) * 100 * 10) / 10;
    }

    // 4. CREACIÓN DEL NUEVO REGISTRO HISTÓRICO (INMUTABLE)
    // No hacemos update de PriceEntry existente; creamos una nueva fila con timestamp automático
    const newPriceEntry = await prisma.priceEntry.create({
      data: {
        productId: product.id,
        userId: userRecord.id,
        storeId: store.id,
        reportedPrice,
        originalPrice: originalPrice ?? (previousEntry ? previousEntry.reportedPrice : null),
        discountPercent: calculatedDiscount,
        priceType,
        stockEstimate,
        notes,
        photoProofUrl
      },
      include: {
        store: true,
        user: {
          select: {
            id: true,
            username: true,
            reputation: true
          }
        }
      }
    });

    // 4.1. Asignar puntos de reputación al usuario que registró la oferta
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { reputation: { increment: 10 } }
    });

    // 5. Análisis de variación para feedback inmediato al usuario
    let priceComparisonInsight = null;
    if (previousEntry) {
      const prevPriceNum = Number(previousEntry.reportedPrice);
      const diff = reportedPrice - prevPriceNum;
      const daysSinceLastReport = Math.floor(
        (new Date().getTime() - new Date(previousEntry.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      priceComparisonInsight = {
        previousPrice: prevPriceNum,
        previousStore: `${previousEntry.store.name} (${previousEntry.store.branch})`,
        reportedAt: previousEntry.createdAt,
        daysSinceLastReport,
        difference: diff,
        isDrop: diff < 0,
        percentageChange: Math.round(((reportedPrice - prevPriceNum) / prevPriceNum) * 100 * 10) / 10,
        message: diff < 0
          ? `¡Gran cazada! Este producto bajó $${Math.abs(diff).toFixed(2)} respecto al reporte de hace ${daysSinceLastReport} días ($${prevPriceNum.toFixed(2)}).`
          : diff === 0
          ? `El precio se mantiene idéntico al último reporte de hace ${daysSinceLastReport} días.`
          : `El precio subió $${diff.toFixed(2)} respecto al último reporte.`
      };
    } else {
      priceComparisonInsight = {
        message: '¡Primer avistamiento de este producto en el sistema! Gracias por iniciar el historial.'
      };
    }

    return res.status(201).json({
      success: true,
      message: 'Precio registrado con éxito en el historial.',
      data: {
        product: {
          id: product.id,
          barcode: product.barcode,
          name: product.name,
          category: product.category
        },
        currentEntry: newPriceEntry,
        comparison: priceComparisonInsight
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación en los datos enviados',
        errors: error.errors
      });
    }

    console.error('Error al registrar precio:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al registrar el precio'
    });
  }
}

/**
 * Obtiene el historial completo de precios de un producto por código de barras
 * Ordenado cronológicamente para alimentar la gráfica / línea de tiempo en la app móvil.
 */
export async function getProductPriceHistory(req: Request, res: Response) {
  try {
    const { barcode } = req.params;

    const product = await prisma.product.findUnique({
      where: { barcode },
      include: {
        priceEntries: {
          orderBy: { createdAt: 'desc' },
          include: {
            store: true,
            user: {
              select: { id: true, username: true, reputation: true }
            },
            _count: {
              select: { votes: true }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado con el código de barras proporcionado'
      });
    }

    // Calcular estadísticas históricas
    const prices = product.priceEntries.map(e => Number(e.reportedPrice));
    const lowestPrice = prices.length ? Math.min(...prices) : null;
    const highestPrice = prices.length ? Math.max(...prices) : null;
    const currentPrice = prices.length ? prices[0] : null;

    return res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          category: product.category,
          workingVotesCount: product.workingVotesCount,
          brokenReportsCount: product.brokenReportsCount,
          isReportedBroken: product.brokenReportsCount >= 5
        },
        stats: {
          totalSightings: product.priceEntries.length,
          currentPrice,
          lowestPrice,
          highestPrice,
          isAtAllTimeLow: currentPrice !== null && lowestPrice !== null && currentPrice <= lowestPrice,
          workingVotesCount: product.workingVotesCount,
          brokenReportsCount: product.brokenReportsCount,
          isReportedBroken: product.brokenReportsCount >= 5
        },
        // Historial completo listo para graficar en React Native
        history: product.priceEntries.map(entry => ({
          id: entry.id,
          price: Number(entry.reportedPrice),
          originalPrice: entry.originalPrice ? Number(entry.originalPrice) : null,
          discountPercent: entry.discountPercent,
          priceType: entry.priceType,
          store: `${entry.store.name} - ${entry.store.branch}`,
          city: entry.store.city,
          notes: entry.notes,
          photoProofUrl: entry.photoProofUrl,
          createdAt: entry.createdAt,
          user: entry.user.username,
          votesCount: entry._count.votes
        }))
      }
    });
  } catch (error) {
    console.error('Error al obtener historial de producto:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el historial de precios'
    });
  }
}
