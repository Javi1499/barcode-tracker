# 🏷️ Barcode Tracker (Tracker de Liquidaciones y Ofertas)

Aplicación móvil colaborativa (React Native + Expo CLI) y backend escalable (Node.js + Express + Prisma + PostgreSQL) diseñada para que los usuarios físicos ("cazadores de ofertas") registren manualmente códigos de barras (EAN/UPC) y precios observados en tiendas (Walmart, Bodega Aurrera, Soriana, Chedraui), construyendo un historial inmutable de liquidaciones para detectar el momento óptimo de compra.

---

## 🏗️ Arquitectura del Proyecto

```
barcode-tracker/
├── backend/                  # Servidor API REST en Express + TypeScript
│   ├── prisma/
│   │   └── schema.prisma    # Esquema PostgreSQL con historial inmutable (1:N Product -> PriceEntry)
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── priceController.ts    # Controlador con lógica de registro histórico y comparativa
│   │   │   └── productController.ts  # Lookup de códigos y Banco Comunitario de Ofertas
│   │   ├── routes/
│   │   │   ├── priceRoutes.ts
│   │   │   └── productRoutes.ts
│   │   ├── lib/prisma.ts             # Instancia Singleton de Prisma Client
│   │   └── index.ts                  # Servidor Express
│   ├── package.json
│   └── tsconfig.json
│
└── mobile/                   # App móvil en React Native (Expo) + TypeScript
    ├── src/
    │   ├── screens/
    │   │   ├── ScannerScreen.tsx             # Escaneo cámara, galería y entrada manual
    │   │   ├── ProductPriceHistoryScreen.tsx # Línea de tiempo y gráfico de bajada de precios
    │   │   ├── AddPriceEntryScreen.tsx       # Formulario de nuevo precio / nuevo producto
    │   │   └── CommunityDealsScreen.tsx      # Banco de códigos colaborativo
    │   ├── services/
    │   │   ├── api.ts                        # Cliente HTTP hacia el backend
    │   │   └── barcodeScannerService.ts      # Lectura de códigos desde galería y cámara
    │   └── types/index.ts                    # Modelos de datos TypeScript
    ├── App.tsx
    ├── app.json
    └── package.json
```

---

## 🚀 Puesta en Marcha

### 1. Backend

1. Entra al directorio del backend:
   ```bash
   cd backend
   npm install
   ```

2. Configura tu base de datos PostgreSQL en `.env`:
   ```env
   PORT=4000
   DATABASE_URL="postgresql://usuario:password@localhost:5432/barcode_tracker?schema=public"
   ```

3. Ejecuta las migraciones de Prisma:
   ```bash
   npx prisma migrate dev --name init
   ```

4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

### 2. Frontend Móvil (React Native con Expo)

1. Entra al directorio móvil:
   ```bash
   cd mobile
   npm install
   ```

2. Inicia la aplicación con Expo:
   ```bash
   npm start
   ```

3. Puedes abrir la aplicación en tu celular usando la app **Expo Go** (escaneando el QR), o en simuladores de iOS / emuladores de Android.

---

## 🎯 Cumplimiento de Requisitos Funcionales

1. **Ingreso y Lectura de Códigos (3 vías):**
   - **Cámara física:** Visor en vivo con mirilla, enfoque y soporte de EAN-13, UPC-A, Code-128 mediante `expo-camera`.
   - **Galería:** Extracción de códigos a partir de fotografías tomadas previamente con `expo-image-picker`.
   - **Manual:** Modal para digitar directamente los números del código de barras.

2. **Registro Manual de Precios y Lógica de Historial:**
   - La consulta `GET /api/products/lookup/:barcode` revisa si el producto existe.
   - Si existe, notifica al usuario: *"Este producto se registró hace X días a $Y en Tienda Z"*.
   - Si no existe, permite registrar el nombre del producto, tienda y precio inicial.
   - Cada nuevo precio se almacena como una nueva fila en `PriceEntry`, **sin sobrescribir nunca** los precios anteriores.

3. **Línea de Tiempo y Detección de Descuentos:**
   - `ProductPriceHistoryScreen` compara el precio actual contra el inicial y el menor registrado.
   - Informa si se encuentra en **Mínimo Histórico** (momento ideal de compra) o si es primera/segunda liquidación (.03, .02, .01).

4. **Banco Comunitario de Códigos:**
   - Permite buscar productos por nombre (ej. "PlayStation 5") para descubrir en qué sucursales físicas otros cazadores han avistado ofertas recientemente.
