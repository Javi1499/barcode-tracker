import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productRoutes from './routes/productRoutes';
import priceRoutes from './routes/priceRoutes';
import authRoutes from './routes/authRoutes';
import personalBarcodeRoutes from './routes/personalBarcodeRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'barcode-tracker-api',
    timestamp: new Date().toISOString()
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/personal-barcodes', personalBarcodeRoutes);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Barcode Tracker Backend corriendo en http://0.0.0.0:${PORT}`);
});

export default app;
