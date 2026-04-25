
import { Store, Product, Order } from './types';

export const CLOTHING_CATEGORIES = [
  'Camisetas', 'Camisas', 'Sudaderas', 'Pantalones', 'Faldas',
  'Chaquetas/Abrigos', 'Trajes', 'Vestidos', 'Calzado', 'Ropa Interior',
  'Pijamas', 'Ropa de Baño', 'Accesorios'
];

export let stores: Store[] = [
  {
    id: '1',
    name: 'Retrospect Vintage',
    category: 'Vintage & Retro',
    imageUrl: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400&h=300&fit=crop&q=80',
    description: 'Vintage finds from the 90s and unique, locally sourced apparel.',
    address: '123 Fashion Ave, Style City',
  },
  {
    id: '2',
    name: 'The Modernist',
    category: 'Minimalist Staples',
    imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop&q=80',
  },
  {
    id: '3',
    name: 'Artisan Accents',
    category: 'Handcrafted Jewelry',
    imageUrl: 'https://images.unsplash.com/photo-1573408301185-9519f94fbf33?w=400&h=300&fit=crop&q=80',
  },
  {
    id: 'sol-y-luna',
    name: 'Boutique Sol y Luna',
    category: 'Organic Fashion',
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop&q=80',
    description: 'Handmade with 100% organic linen, this jacket is not only elegant but also sustainable.',
    address: '456 Sunny Rd, Meadow City',
  }
];

export const products: Product[] = [
  { id: '1', name: "T-Shirt Gráfica 'Sol'", price: 25.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=400&h=600&fit=crop&q=80', category: 'Camisetas', gender: 'Mujer', stock: 3 },
  { id: '2', name: "Abrigo de Lana 'Otoño'", price: 120.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=600&fit=crop&q=80', category: 'Chaquetas/Abrigos', gender: 'Mujer', isFavorite: true, stock: 15 },
  { id: '3', name: "Collar de Plata Artesanal", price: 45.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=600&fit=crop&q=80', category: 'Accesorios', gender: 'Mujer', stock: 20 },
  { id: '4', name: "Jeans Rectos 'Urbano'", price: 70.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=600&fit=crop&q=80', category: 'Pantalones largos', gender: 'Hombre', stock: 0 },
  { id: '5', name: "Botines de Cuero 'Viajero'", price: 95.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=600&fit=crop&q=80', category: 'Calzado', gender: 'Hombre', stock: 8 },
  { id: '6', name: "Vestido Floral 'Prado'", price: 80.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop&q=80', category: 'Vestidos', gender: 'Mujer', stock: 10 },
  { id: 'chaqueta-lino', name: "Chaqueta de Lino 'Sol'", price: 89.99, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna',
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=600&fit=crop&q=80',
    description: "Una pieza versátil y atemporal, perfecta para los días de verano. Hecha a mano con lino 100% orgánico, esta chaqueta no solo es elegante, sino también sostenible.",
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: [
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1529139574466-a303027f1d8b?w=400&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1551232864-3f0890e1f97c?w=400&h=600&fit=crop&q=80',
    ],
    category: 'Chaquetas/Abrigos',
    gender: 'Mujer',
    stock: 5,
  },
  { id: '8', name: "Vestido 'Ibiza'", price: 75.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=600&fit=crop&q=80', category: 'Vestidos', gender: 'Mujer', stock: 12 },
  { id: '9', name: "Bolso de Paja", price: 49.99, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=600&fit=crop&q=80', category: 'Accesorios', gender: 'Mujer', stock: 25 },
  { id: '10', name: "Bufanda de Lana", price: 35.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&h=600&fit=crop&q=80', category: 'Accesorios', gender: 'Mujer', stock: 30 },
  { id: '11', name: "Zapatillas Minimalistas", price: 110.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=600&fit=crop&q=80', category: 'Calzado', gender: 'Mujer', isFavorite: true, stock: 4 },
  { id: '12', name: "Camisa de Lino Blanca", price: 65.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=600&fit=crop&q=80', category: 'Camisas', gender: 'Hombre', stock: 18 },
  { id: '13', name: "Vestido de Noche Vintage", price: 150.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=600&fit=crop&q=80', category: 'Vestidos', gender: 'Mujer', stock: 7 },
  { id: '14', name: "Pantalones Chinos Beige", price: 75.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=600&fit=crop&q=80', category: 'Pantalones largos', gender: 'Hombre', stock: 9 },
  { id: '15', name: "Anillo de Oro Artesanal", price: 90.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=400&h=600&fit=crop&q=80', category: 'Accesorios', gender: 'Mujer', stock: 11 },
  { id: '16', name: "Bomber Jacket '90s'", price: 95.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=600&fit=crop&q=80', category: 'Chaquetas/Abrigos', gender: 'Hombre', stock: 2 },
  { id: '17', name: "Falda Midi Plisada", price: 55.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=400&h=600&fit=crop&q=80', category: 'Faldas', gender: 'Mujer', isFavorite: true, stock: 6 },
  { id: '18', name: "Sandalias de Cuero", price: 60.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=600&fit=crop&q=80', category: 'Calzado', gender: 'Mujer', stock: 14 },
  { id: '19', name: "Camiseta Básica Orgánica", price: 30.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=600&fit=crop&q=80', category: 'Camisetas', gender: 'Mujer', stock: 40 },
  { id: '20', name: "Pendientes de Plata", price: 40.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=600&fit=crop&q=80', category: 'Accesorios', gender: 'Mujer', stock: 22 },
  { id: '21', name: "Sombrero de Paja 'Verano'", price: 28.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=400&h=600&fit=crop&q=80', category: 'Accesorios', gender: 'Mujer', stock: 1 },
];

export const orders: Order[] = [
    {
        id: 'ORD-001',
        customerId: '',
        customerName: 'Elena García',
        date: '2026-01-09',
        status: 'Nuevo',
        items: [
            { product: products[1], quantity: 1, variant: 'Talla M' },
            { product: products[2], quantity: 1 }
        ],
        total: 165.00,
    },
    {
        id: 'ORD-002',
        customerId: '',
        customerName: 'Elena García',
        date: '2026-01-08',
        status: 'En Proceso',
        items: [
            { product: products[3], quantity: 2, variant: 'Talla 32' }
        ],
        total: 140.00,
    },
    {
        id: 'ORD-003',
        customerId: '',
        customerName: 'Elena García',
        date: '2026-01-05',
        status: 'Completado',
        items: [
            { product: products[4], quantity: 1, variant: 'Talla 38' }
        ],
        total: 95.00,
    },
    {
        id: 'ORD-004',
        customerId: '',
        customerName: 'Elena García',
        date: '2026-01-09',
        status: 'Nuevo',
        items: [
            { product: products[0], quantity: 1, variant: 'Talla S' },
        ],
        total: 25.00,
    }
];
