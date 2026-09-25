import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos demo para pruebas...');

  // 1. Usuario Cazador Demo
  const user = await prisma.user.upsert({
    where: { email: 'hunter@dealhunter.app' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'hunter@dealhunter.app',
      username: 'cazador_cdmx',
      name: 'Javier Cazaofertas',
      reputation: 150
    }
  });

  // 2. Tiendas Demo
  const storeWalmart = await prisma.store.upsert({
    where: {
      store_branch_unique: {
        name: 'Walmart',
        branch: 'Miramontes'
      }
    },
    update: {},
    create: {
      name: 'Walmart',
      branch: 'Miramontes',
      city: 'CDMX',
      state: 'CDMX'
    }
  });

  const storeAurrera = await prisma.store.upsert({
    where: {
      store_branch_unique: {
        name: 'Bodega Aurrera',
        branch: 'Plaza Tepeyac'
      }
    },
    update: {},
    create: {
      name: 'Bodega Aurrera',
      branch: 'Plaza Tepeyac',
      city: 'CDMX',
      state: 'CDMX'
    }
  });

  // 3. Producto Demo: Consola PlayStation 5
  const ps5Barcode = '7501055312345';
  const ps5 = await prisma.product.upsert({
    where: { barcode: ps5Barcode },
    update: {},
    create: {
      barcode: ps5Barcode,
      name: 'Consola PlayStation 5 Slim 1TB',
      brand: 'Sony',
      category: 'Videojuegos'
    }
  });

  // Historial de precios previo para probar la bajada de liquidación:
  // Registro 1: Hace 30 días a $11,999.00
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

  // Registro 2: Hace 10 días a $8,500.00
  const date10DaysAgo = new Date();
  date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);

  await prisma.priceEntry.deleteMany({ where: { productId: ps5.id } });

  await prisma.priceEntry.create({
    data: {
      productId: ps5.id,
      userId: user.id,
      storeId: storeWalmart.id,
      reportedPrice: 11999.00,
      originalPrice: 12999.00,
      discountPercent: 7.6,
      priceType: 'REGULAR',
      notes: 'Precio normal de lista en vitrina',
      createdAt: date30DaysAgo
    }
  });

  await prisma.priceEntry.create({
    data: {
      productId: ps5.id,
      userId: user.id,
      storeId: storeAurrera.id,
      reportedPrice: 8500.00,
      originalPrice: 11999.00,
      discountPercent: 29.1,
      priceType: 'LIQUIDATION_SECOND',
      notes: 'Etiqueta amarilla con terminación .02 en pasillo central',
      createdAt: date10DaysAgo
    }
  });

  console.log(`✅ Base de datos sembrada con éxito.`);
  console.log(`   Código de prueba para escanear/digitar: ${ps5Barcode}`);
  console.log(`   (Tiene 2 registros previos para verificar el aviso "Se registró hace 10 días a $8,500")`);
}

main()
  .catch((e) => {
    console.error('Error al sembrar datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
