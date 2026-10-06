import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const savePersonalBarcodeSchema = z.object({
  userId: z.string().min(1, 'El ID de usuario es requerido'),
  barcode: z.string().min(4, 'Código de barras requerido'),
  name: z.string().min(2, 'El nombre del producto es requerido'),
  brand: z.string().optional(),
  category: z.string().optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().optional(),
  storeName: z.string().optional(),
  storeBranch: z.string().optional(),
  notes: z.string().max(500).optional()
});

const updatePersonalBarcodeSchema = z.object({
  userId: z.string().min(1, 'El ID de usuario es requerido'),
  name: z.string().min(2, 'El nombre del producto es requerido').optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  price: z.number().positive().optional().nullable(),
  originalPrice: z.number().positive().optional().nullable(),
  storeName: z.string().optional().nullable(),
  storeBranch: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

/**
 * Obtener todos los códigos guardados en el banco personal del usuario
 */
export async function getPersonalBarcodes(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'userId es requerido para consultar el banco personal'
      });
    }

    const items = await prisma.personalBarcode.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    return res.json({
      success: true,
      count: items.length,
      data: items.map(item => ({
        id: item.id,
        barcode: item.barcode,
        name: item.name,
        brand: item.brand,
        category: item.category,
        price: item.price ? Number(item.price) : null,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
        storeName: item.storeName,
        storeBranch: item.storeBranch,
        notes: item.notes,
        isPublished: item.isPublished,
        productId: item.productId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error al obtener banco personal de códigos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el banco personal'
    });
  }
}

/**
 * Guardar un código de barras en el banco personal propio
 */
export async function savePersonalBarcode(req: Request, res: Response) {
  try {
    const validated = savePersonalBarcodeSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: validated.userId }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado o no encontrado'
      });
    }

    const cleanBarcode = validated.barcode.trim();

    // Crear el código personal en su banco privado
    const item = await prisma.personalBarcode.create({
      data: {
        userId: user.id,
        barcode: cleanBarcode,
        name: validated.name.trim(),
        brand: validated.brand?.trim(),
        category: validated.category?.trim(),
        price: validated.price,
        originalPrice: validated.originalPrice,
        storeName: validated.storeName?.trim(),
        storeBranch: validated.storeBranch?.trim(),
        notes: validated.notes?.trim(),
        isPublished: false
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Código guardado exitosamente en tu banco personal',
      data: {
        ...item,
        price: item.price ? Number(item.price) : null,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : null
      }
    });
  } catch (error: any) {
    console.error('Error al guardar en banco personal:', error);
    if (error?.errors) {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Datos incompletos',
        errors: error.errors
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error interno al guardar en tu banco personal'
    });
  }
}

/**
 * Actualizar un código del banco personal (sólo por su dueño)
 */
export async function updatePersonalBarcode(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const validated = updatePersonalBarcodeSchema.parse(req.body);

    const item = await prisma.personalBarcode.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Código no encontrado en el banco personal'
      });
    }

    if (item.userId !== validated.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este código'
      });
    }

    const updated = await prisma.personalBarcode.update({
      where: { id },
      data: {
        name: validated.name ? validated.name.trim() : item.name,
        brand: validated.brand !== undefined ? (validated.brand ? validated.brand.trim() : null) : item.brand,
        category: validated.category !== undefined ? (validated.category ? validated.category.trim() : null) : item.category,
        price: validated.price !== undefined ? validated.price : item.price,
        originalPrice: validated.originalPrice !== undefined ? validated.originalPrice : item.originalPrice,
        storeName: validated.storeName !== undefined ? (validated.storeName ? validated.storeName.trim() : null) : item.storeName,
        storeBranch: validated.storeBranch !== undefined ? (validated.storeBranch ? validated.storeBranch.trim() : null) : item.storeBranch,
        notes: validated.notes !== undefined ? (validated.notes ? validated.notes.trim() : null) : item.notes
      }
    });

    return res.json({
      success: true,
      message: 'Código actualizado en tu banco personal',
      data: {
        ...updated,
        price: updated.price ? Number(updated.price) : null,
        originalPrice: updated.originalPrice ? Number(updated.originalPrice) : null
      }
    });
  } catch (error: any) {
    console.error('Error al actualizar código personal:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar código personal'
    });
  }
}

/**
 * Eliminar un código del banco personal
 */
export async function deletePersonalBarcode(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req.query.userId as string) || req.body?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'userId requerido para eliminar el código'
      });
    }

    const item = await prisma.personalBarcode.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Código no encontrado'
      });
    }

    if (item.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este código'
      });
    }

    await prisma.personalBarcode.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Código eliminado de tu banco personal'
    });
  } catch (error) {
    console.error('Error al eliminar código personal:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar el código'
    });
  }
}

/**
 * Publicar un código del banco personal en la comunidad (Banco de Ofertas público)
 */
export async function publishPersonalBarcode(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { userId, storeName, storeBranch, priceType = 'LIQUIDATION_FINAL' } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'userId requerido para publicar el código'
      });
    }

    const item = await prisma.personalBarcode.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Código personal no encontrado'
      });
    }

    if (item.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Sólo el dueño puede publicar este código'
      });
    }

    const cleanBarcode = item.barcode.trim();
    const cleanStore = (storeName || item.storeName || 'Walmart').trim();
    const cleanBranch = (storeBranch || item.storeBranch || 'Sucursal Principal').trim();
    const itemPrice = item.price ? Number(item.price) : 0;

    if (itemPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El código debe tener un precio mayor a 0 para publicarse en la comunidad'
      });
    }

    // 1. Buscar o registrar la tienda
    const store = await prisma.store.upsert({
      where: {
        store_branch_unique: {
          name: cleanStore,
          branch: cleanBranch
        }
      },
      update: {},
      create: {
        name: cleanStore,
        branch: cleanBranch
      }
    });

    // 2. Buscar o crear el producto en el catálogo general, asignando createdById
    let product = await prisma.product.findUnique({
      where: { barcode: cleanBarcode }
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          barcode: cleanBarcode,
          name: item.name.trim(),
          brand: item.brand?.trim(),
          category: item.category?.trim(),
          createdById: item.userId
        }
      });
    }

    // 3. Crear el PriceEntry público
    let calculatedDiscount: number | null = null;
    if (item.originalPrice && Number(item.originalPrice) > itemPrice) {
      calculatedDiscount =
        Math.round(((Number(item.originalPrice) - itemPrice) / Number(item.originalPrice)) * 100 * 10) / 10;
    }

    const newPriceEntry = await prisma.priceEntry.create({
      data: {
        productId: product.id,
        userId: item.userId,
        storeId: store.id,
        reportedPrice: itemPrice,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
        discountPercent: calculatedDiscount,
        priceType: priceType as any,
        notes: item.notes || 'Publicado desde mi banco personal de códigos'
      }
    });

    // 4. Actualizar el código personal como publicado
    await prisma.personalBarcode.update({
      where: { id },
      data: {
        isPublished: true,
        productId: product.id
      }
    });

    // 5. Premiar con +10 puntos de reputación
    await prisma.user.update({
      where: { id: item.userId },
      data: { reputation: { increment: 10 } }
    });

    return res.json({
      success: true,
      message: '¡Código y liquidación publicados con éxito en la comunidad! (+10 pts)',
      data: {
        product,
        priceEntry: newPriceEntry
      }
    });
  } catch (error) {
    console.error('Error al publicar código personal:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al publicar el código en la comunidad'
    });
  }
}
