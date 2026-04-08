
import { Store, Product, Order } from './types';

export const CLOTHING_CATEGORIES = [
  'Camisetas', 'Camisas', 'Sudaderas', 'Pantalones', 'Faldas', 'Monos/Petos', 
  'Chaquetas/Abrigos', 'Trajes', 'Vestidos', 'Calzado', 'Ropa Interior', 
  'Pijamas', 'Ropa de Baño', 'Accesorios'
];

export let stores: Store[] = [
  {
    id: '1',
    name: 'Retrospect Vintage',
    category: 'Vintage & Retro',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAbQ-A3BCsA4C009D4b8jwN6plAEWSWPdwZ9xgTacW2Ts0OJ7giwP0fyQL8_sthy1LxKN37kBGt3YQkiUmVGi6OcbmVBJYLRQudwA0eJmoKuFDSypfCETJErs_JXkVNwivOuvA2K4W_wYftoQqleiPe71V1blFuK-DejdLaaov9MwSFVBWDDMsJ7YO0I0pIzFtyR-GpoOlDYZ4imUoSTIQsup3kX2fw35pDhb57IAzjKw3ZucmtedS4Hoa5sZTXpgPDA1tNnGvZ49A',
    description: 'Vintage finds from the 90s and unique, locally sourced apparel.',
    address: '123 Fashion Ave, Style City',
  },
  {
    id: '2',
    name: 'The Modernist',
    category: 'Minimalist Staples',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnM71MwXog-cBRMeTV-XzvqV_nNOlyCXYMdSTgKUaacQk17zyuiyUfU4WxzdsbZylqyLKHGE6quyNl-Sb4i8Rr2TNc0f8JOYLZVUZmhWkladUyDsGZiVfNV1pG449hNz34aA8Tn3wtVuqu4bN6GjkhQj29uBbq7sD4rK7nihXPdP1Biei6MYLVpPAQ1dFq4dh4Ve7JO7JiV-AFQDVtC33pKalSLozNzrnXfAsbze4r1bPgLZrO6y2LT1hkoKu0Tvq85GRKgGVU9MI',
  },
  {
    id: '3',
    name: 'Artisan Accents',
    category: 'Handcrafted Jewelry',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDkbSkHiSaUde-Glf2SJ3aozgylmHHipxv7bO4V8bPSVocpPydPeGumwJzjXaxmH5h079R55WWidBvUls-i74fcnWTiOEDcDPRW-BInjP2T3QG3eNO6AyeK8QTG8NhcaLcDlI26jpwtZBExLInDJa6amGS3reAOeRH5kDgINYZ_ldg1o1AZXRmDif-4yOmQ5HnhptYxseY3kGzD99Rk9_F1zUOVrcYnOTQT5_sblRcPd89d8AnBINkk1MUrACYuuJXw0QJISkcLpg',
  },
  {
    id: 'sol-y-luna',
    name: 'Boutique Sol y Luna',
    category: 'Organic Fashion',
    imageUrl: 'https://picsum.photos/id/1011/200/200',
    description: 'Handmade with 100% organic linen, this jacket is not only elegant but also sustainable.',
    address: '456 Sunny Rd, Meadow City',
  }
];

export const products: Product[] = [
  { id: '1', name: "T-Shirt Gráfica 'Sol'", price: 25.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpbVe_49kTAw4P0OnRTElQ_dfbeNAJlWitWJmIyQnVVRhg_Llus0KrgsWziv4Za-Roy4Ah6as2F2dqBOqbVJ2OqBTHkMzcyIE0H9UXJTL_V3_ZwPcgDOi-8SxwJHXoEeLFojCst-WKT37I4K8_5gXHd0swwa6eB8B4EFerDyGC1d1Ye-b-jHAJRrLt4DiO0nsiuwu7hOVSzGcevugFmqYMfmf-UV53r4k6YLiGfeDvm8Lvo-uEWWgSzlKRA8NgCFBtYzjxSKB-Fo4', category: 'Camisetas', gender: 'Mujer', stock: 3 },
  { id: '2', name: "Abrigo de Lana 'Otoño'", price: 120.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5hHPjI0c2OyUxMhxcI9y0GC8k2yrChSM1fI1YQhbkxYUm6nwRtB7BaBw0133beFDTgmTclq5UcTscYmo9hNjvW5MSS8zU3yMx3TCAl4ANzOU9Zxjk3S6DtIdAf5oqFBZhHjCVJgH3t5kr_xXMsPXRKwMcL9AxzTjKX0mqAwcwTtoe5bbDLMa_VwK5-VwDT3H_yvbUF2MZ9Nn3bm-0Npf5GYeF80SQAPZ6iL0o4AatjHy3kOeWuSrwA7dwKWITCwEMV65lnLy7ixM', category: 'Chaquetas/Abrigos', gender: 'Mujer', isFavorite: true, stock: 15 },
  { id: '3', name: "Collar de Plata Artesanal", price: 45.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvnpEMRvmB1LkjdFbUMcaxgrrdrQcELxeG9UW0rz3dNAzv1vwrc1CAL4SFLNgFvAeGxhbZkxMcs_bNw3ZTkDxmr3pYrH6l8uLmU0u3je9EyhwgXrI18WsLNnuaPBbKJWZ4rx6t-podBcO57V9cR73YSp8Q09AuKW-6Vq8RlBeZhGFSDvdlNPsZARgtuRycsyfngi_h8kLiqdlKoXoSjaaY0fUWbwfPNNWJcu0xZJIAAg-3a32iQv9XG4OIW-T0PgS6zYYAQOjrY', category: 'Accesorios', gender: 'Mujer', stock: 20 },
  { id: '4', name: "Jeans Rectos 'Urbano'", price: 70.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3EL5GsGdmtnFcfTKqfg79ghEQqXxiKhKZAVx_sVeYWLPiBOshlWEqb4-WNuQf1KeWO2PdoD8PCkWf8cE7Wiswpgn2VFV_kUMFrAcLI1oDte9_kNJ7QlDAwyHcspQ3GcLq2wnshtJOKn1dR96QXtrZ-ZZoXUkooyQ8qzCjnDl3hDsrVLM_7uLTN-HqJbtwrqaliLd6OgLjJwCbMELRpwuEwyJi6bmGbEZpkKFTClUMqwBqdvHophjZ3hrrnxucDGOflYYfZYjWw2g', category: 'Pantalones largos', gender: 'Hombre', stock: 0 },
  { id: '5', name: "Botines de Cuero 'Viajero'", price: 95.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDxOlXwwOFEZC8X4eMj1uEgf8H625f4kBc1JQjKNIlMlds_swWHoiwJKDpXtdcAial8I2sEsfaACReqUAnNY-tz6bIKhO1wSMMujNRkqN6Z_FuFo2bPRkLHnJi4fWTXQ0VSOW7Mpp3eWuo3MGABUKEnnra4nW7ZkZdjPxACTLyLe9La6MZfrieIY1yTziZyhesuFjK9jXF4V0o6a6-HbtNS2XMzPqss21ngak7p6YUiy9MtRRq5KGRW9H6fzrT_gLs10Dup4k4D9fE', category: 'Calzado', gender: 'Hombre', stock: 8 },
  { id: '6', name: "Vestido Floral 'Prado'", price: 80.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA7OGu_SHKn2zu2crD2wAWQuwClyPq2RmlvLCKHQ34NCFjDgiSjvTxGvH_RxdtxHHsfv7tSe2_NRFnA-AWliu5NP6iG2xyN8cQCnAkDMzftnpvfBqmpuFunX9b0kWXNlhBuPMOC37JJjNiJz2dULt3NfXgNcgGurpDdAQUG5nx3S3XQ_scUMwU5e2SRZmz-6CYTUVH6Wj_HgABBQtJpUigH0Q8JJgxOz6qc-upDh4P71CYwuS6cyyagnFvA3d_tnY5G6Jindm5XIG0', category: 'Vestidos', gender: 'Mujer', stock: 10 },
  { id: 'chaqueta-lino', name: "Chaqueta de Lino 'Sol'", price: 89.99, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', 
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDRl-6Q8n6J7U3L-7jK_k1G8D1X7bY4f0B7h5N1F4pY7eJ2bZ7n8W0M4kX7x8W3z5Y9Z8H1k8b5b6M5k9e6I5u9N6K3b9k9E7l5p4y5O4b4J4k8b6N7j3e5h7i9l0',
    description: "Una pieza versátil y atemporal, perfecta para los días de verano. Hecha a mano con lino 100% orgánico, esta chaqueta no solo es elegante, sino también sostenible.",
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDRl-6Q8n6J7U3L-7jK_k1G8D1X7bY4f0B7h5N1F4pY7eJ2bZ7n8W0M4kX7x8W3z5Y9Z8H1k8b5b6M5k9e6I5u9N6K3b9k9E7l5p4y5O4b4J4k8b6N7j3e5h7i9l0',
      'https://picsum.photos/id/1080/400/600',
      'https://picsum.photos/id/1025/400/600',
    ],
    category: 'Chaquetas/Abrigos',
    gender: 'Mujer',
    stock: 5,
  },
  { id: '8', name: "Vestido 'Ibiza'", price: 75.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://picsum.photos/id/1015/400/600', category: 'Vestidos', gender: 'Mujer', stock: 12 },
  { id: '9', name: "Bolso de Paja", price: 49.99, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://picsum.photos/id/1020/400/600', category: 'Accesorios', gender: 'Mujer', stock: 25 },
  { id: '10', name: "Bufanda de Lana", price: 35.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://picsum.photos/id/10/400/600', category: 'Accesorios', gender: 'Mujer', stock: 30 },
  { id: '11', name: "Zapatillas Minimalistas", price: 110.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://picsum.photos/id/21/400/600', category: 'Calzado', gender: 'Mujer', isFavorite: true, stock: 4 },
  { id: '12', name: "Camisa de Lino Blanca", price: 65.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://picsum.photos/id/24/400/600', category: 'Camisas', gender: 'Hombre', stock: 18 },
  { id: '13', name: "Vestido de Noche Vintage", price: 150.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://picsum.photos/id/1047/400/600', category: 'Vestidos', gender: 'Mujer', stock: 7 },
  { id: '14', name: "Pantalones Chinos Beige", price: 75.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://picsum.photos/id/1055/400/600', category: 'Pantalones largos', gender: 'Hombre', stock: 9 },
  { id: '15', name: "Anillo de Oro Artesanal", price: 90.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://picsum.photos/id/111/400/600', category: 'Accesorios', gender: 'Mujer', stock: 11 },
  { id: '16', name: "Bomber Jacket '90s'", price: 95.00, storeName: 'Retrospect Vintage', storeId: '1', imageUrl: 'https://picsum.photos/id/145/400/600', category: 'Chaquetas/Abrigos', gender: 'Hombre', stock: 2 },
  { id: '17', name: "Falda Midi Plisada", price: 55.00, storeName: 'The Modernist', storeId: '2', imageUrl: 'https://picsum.photos/id/163/400/600', category: 'Faldas', gender: 'Mujer', isFavorite: true, stock: 6 },
  { id: '18', name: "Sandalias de Cuero", price: 60.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://picsum.photos/id/211/400/600', category: 'Calzado', gender: 'Mujer', stock: 14 },
  { id: '19', name: "Camiseta Básica Orgánica", price: 30.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://picsum.photos/id/250/400/600', category: 'Camisetas', gender: 'Mujer', stock: 40 },
  { id: '20', name: "Pendientes de Plata", price: 40.00, storeName: 'Artisan Accents', storeId: '3', imageUrl: 'https://picsum.photos/id/301/400/600', category: 'Accesorios', gender: 'Mujer', stock: 22 },
  { id: '21', name: "Sombrero de Paja 'Verano'", price: 28.00, storeName: 'Boutique Sol y Luna', storeId: 'sol-y-luna', imageUrl: 'https://picsum.photos/id/355/400/600', category: 'Accesorios', gender: 'Mujer', stock: 1 },
];

export const orders: Order[] = [
    {
        id: 'ORD-001',
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
        customerName: 'Elena García',
        date: '2026-01-09',
        status: 'Nuevo',
        items: [
            { product: products[0], quantity: 1, variant: 'Talla S' },
        ],
        total: 25.00,
    }
];
