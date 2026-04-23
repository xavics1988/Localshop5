-- ============================================================
-- SEED DATA — Tiendas, Productos y Reseñas iniciales
-- Equivalente a data.ts del frontend
-- ============================================================

-- Tiendas
insert into stores (id, name, category, image_url, address, description) values
  ('1', 'Retrospect Vintage', 'Vintage & Retro',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuAbQ-A3BCsA4C009D4b8jwN6plAEWSWPdwZ9xgTacW2Ts0OJ7giwP0fyQL8_sthy1LxKN37kBGt3YQkiUmVGi6OcbmVBJYLRQudwA0eJmoKuFDSypfCETJErs_JXkVNwivOuvA2K4W_wYftoQqleiPe71V1blFuK-DejdLaaov9MwSFVBWDDMsJ7YO0I0pIzFtyR-GpoOlDYZ4imUoSTIQsup3kX2fw35pDhb57IAzjKw3ZucmtedS4Hoa5sZTXpgPDA1tNnGvZ49A',
   '123 Fashion Ave, Style City',
   'Vintage finds from the 90s and unique, locally sourced apparel.'),

  ('2', 'The Modernist', 'Minimalist Staples',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuBnM71MwXog-cBRMeTV-XzvqV_nNOlyCXYMdSTgKUaacQk17zyuiyUfU4WxzdsbZylqyLKHGE6quyNl-Sb4i8Rr2TNc0f8JOYLZVUZmhWkladUyDsGZiVfNV1pG449hNz34aA8Tn3wtVuqu4bN6GjkhQj29uBbq7sD4rK7nihXPdP1Biei6MYLVpPAQ1dFq4dh4Ve7JO7JiV-AFQDVtC33pKalSLozNzrnXfAsbze4r1bPgLZrO6y2LT1hkoKu0Tvq85GRKgGVU9MI',
   null, null),

  ('3', 'Artisan Accents', 'Handcrafted Jewelry',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCDkbSkHiSaUde-Glf2SJ3aozgylmHHipxv7bO4V8bPSVocpPydPeGumwJzjXaxmH5h079R55WWidBvUls-i74fcnWTiOEDcDPRW-BInjP2T3QG3eNO6AyeK8QTG8NhcaLcDlI26jpwtZBExLInDJa6amGS3reAOeRH5kDgINYZ_ldg1o1AZXRmDif-4yOmQ5HnhptYxseY3kGzD99Rk9_F1zUOVrcYnOTQT5_sblRcPd89d8AnBINkk1MUrACYuuJXw0QJISkcLpg',
   null, null),

  ('sol-y-luna', 'Boutique Sol y Luna', 'Organic Fashion',
   'https://picsum.photos/id/1011/200/200',
   '456 Sunny Rd, Meadow City',
   'Handmade with 100% organic linen, this jacket is not only elegant but also sustainable.')
on conflict (id) do nothing;

-- Productos (21 productos de data.ts)
insert into products (id, name, price, store_name, store_id, image_url, category, gender, stock, sizes, images, description) values
  ('1', 'T-Shirt Gráfica ''Sol''', 25.00, 'Retrospect Vintage', '1',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCpbVe_49kTAw4P0OnRTElQ_dfbeNAJlWitWJmIyQnVVRhg_Llus0KrgsWziv4Za-Roy4Ah6as2F2dqBOqbVJ2OqBTHkMzcyIE0H9UXJTL_V3_ZwPcgDOi-8SxwJHXoEeLFojCst-WKT37I4K8_5gXHd0swwa6eB8B4EFerDyGC1d1Ye-b-jHAJRrLt4DiO0nsiuwu7hOVSzGcevugFmqYMfmf-UV53r4k6YLiGfeDvm8Lvo-uEWWgSzlKRA8NgCFBtYzjxSKB-Fo4',
   'Camisetas', 'Mujer', 3, null, null, null),

  ('2', 'Abrigo de Lana ''Otoño''', 120.00, 'The Modernist', '2',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuD5hHPjI0c2OyUxMhxcI9y0GC8k2yrChSM1fI1YQhbkxYUm6nwRtB7BaBw0133beFDTgmTclq5UcTscYmo9hNjvW5MSS8zU3yMx3TCAl4ANzOU9Zxjk3S6DtIdAf5oqFBZhHjCVJgH3t5kr_xXMsPXRKwMcL9AxzTjKX0mqAwcwTtoe5bbDLMa_VwK5-VwDT3H_yvbUF2MZ9Nn3bm-0Npf5GYeF80SQAPZ6iL0o4AatjHy3kOeWuSrwA7dwKWITCwEMV65lnLy7ixM',
   'Chaquetas/Abrigos', 'Mujer', 15, null, null, null),

  ('3', 'Collar de Plata Artesanal', 45.00, 'Artisan Accents', '3',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCvnpEMRvmB1LkjdFbUMcaxgrrdrQcELxeG9UW0rz3dNAzv1vwrc1CAL4SFLNgFvAeGxhbZkxMcs_bNw3ZTkDxmr3pYrH6l8uLmU0u3je9EyhwgXrI18WsLNnuaPBbKJWZ4rx6t-podBcO57V9cR73YSp8Q09AuKW-6Vq8RlBeZhGFSDvdlNPsZARgtuRycsyfngi_h8kLiqdlKoXoSjaaY0fUWbwfPNNWJcu0xZJIAAg-3a32iQv9XG4OIW-T0PgS6zYYAQOjrY',
   'Accesorios', 'Mujer', 20, null, null, null),

  ('4', 'Jeans Rectos ''Urbano''', 70.00, 'The Modernist', '2',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuC3EL5GsGdmtnFcfTKqfg79ghEQqXxiKhKZAVx_sVeYWLPiBOshlWEqb4-WNuQf1KeWO2PdoD8PCkWf8cE7Wiswpgn2VFV_kUMFrAcLI1oDte9_kNJ7QlDAwyHcspQ3GcLq2wnshtJOKn1dR96QXtrZ-ZZoXUkooyQ8qzCjnDl3hDsrVLM_7uLTN-HqJbtwrqaliLd6OgLjJwCbMELRpwuEwyJi6bmGbEZpkKFTClUMqwBqdvHophjZ3hrrnxucDGOflYYfZYjWw2g',
   'Pantalones largos', 'Hombre', 0, null, null, null),

  ('5', 'Botines de Cuero ''Viajero''', 95.00, 'Retrospect Vintage', '1',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDxOlXwwOFEZC8X4eMj1uEgf8H625f4kBc1JQjKNIlMlds_swWHoiwJKDpXtdcAial8I2sEsfaACReqUAnNY-tz6bIKhO1wSMMujNRkqN6Z_FuFo2bPRkLHnJi4fWTXQ0VSOW7Mpp3eWuo3MGABUKEnnra4nW7ZkZdjPxACTLyLe9La6MZfrieIY1yTziZyhesuFjK9jXF4V0o6a6-HbtNS2XMzPqss21ngak7p6YUiy9MtRRq5KGRW9H6fzrT_gLs10Dup4k4D9fE',
   'Calzado', 'Hombre', 8, null, null, null),

  ('6', 'Vestido Floral ''Prado''', 80.00, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuA7OGu_SHKn2zu2crD2wAWQuwClyPq2RmlvLCKHQ34NCFjDgiSjvTxGvH_RxdtxHHsfv7tSe2_NRFnA-AWliu5NP6iG2xyN8cQCnAkDMzftnpvfBqmpuFunX9b0kWXNlhBuPMOC37JJjNiJz2dULt3NfXgNcgGurpDdAQUG5nx3S3XQ_scUMwU5e2SRZmz-6CYTUVH6Wj_HgABBQtJpUigH0Q8JJgxOz6qc-upDh4P71CYwuS6cyyagnFvA3d_tnY5G6Jindm5XIG0',
   'Vestidos', 'Mujer', 10, null, null, null),

  ('chaqueta-lino', 'Chaqueta de Lino ''Sol''', 89.99, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDRl-6Q8n6J7U3L-7jK_k1G8D1X7bY4f0B7h5N1F4pY7eJ2bZ7n8W0M4kX7x8W3z5Y9Z8H1k8b5b6M5k9e6I5u9N6K3b9k9E7l5p4y5O4b4J4k8b6N7j3e5h7i9l0',
   'Chaquetas/Abrigos', 'Mujer', 5,
   array['XS','S','M','L','XL'],
   array[
     'https://lh3.googleusercontent.com/aida-public/AB6AXuDRl-6Q8n6J7U3L-7jK_k1G8D1X7bY4f0B7h5N1F4pY7eJ2bZ7n8W0M4kX7x8W3z5Y9Z8H1k8b5b6M5k9e6I5u9N6K3b9k9E7l5p4y5O4b4J4k8b6N7j3e5h7i9l0',
     'https://picsum.photos/id/1080/400/600',
     'https://picsum.photos/id/1025/400/600'
   ],
   'Una pieza versátil y atemporal, perfecta para los días de verano. Hecha a mano con lino 100% orgánico, esta chaqueta no solo es elegante, sino también sostenible.'),

  ('8', 'Vestido ''Ibiza''', 75.00, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://picsum.photos/id/1015/400/600', 'Vestidos', 'Mujer', 12, null, null, null),

  ('9', 'Bolso de Paja', 49.99, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://picsum.photos/id/1020/400/600', 'Accesorios', 'Mujer', 25, null, null, null),

  ('10', 'Bufanda de Lana', 35.00, 'Artisan Accents', '3',
   'https://picsum.photos/id/10/400/600', 'Accesorios', 'Mujer', 30, null, null, null),

  ('11', 'Zapatillas Minimalistas', 110.00, 'The Modernist', '2',
   'https://picsum.photos/id/21/400/600', 'Calzado', 'Mujer', 4, null, null, null),

  ('12', 'Camisa de Lino Blanca', 65.00, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://picsum.photos/id/24/400/600', 'Camisas', 'Hombre', 18, null, null, null),

  ('13', 'Vestido de Noche Vintage', 150.00, 'Retrospect Vintage', '1',
   'https://picsum.photos/id/1047/400/600', 'Vestidos', 'Mujer', 7, null, null, null),

  ('14', 'Pantalones Chinos Beige', 75.00, 'The Modernist', '2',
   'https://picsum.photos/id/1055/400/600', 'Pantalones largos', 'Hombre', 9, null, null, null),

  ('15', 'Anillo de Oro Artesanal', 90.00, 'Artisan Accents', '3',
   'https://picsum.photos/id/111/400/600', 'Accesorios', 'Mujer', 11, null, null, null),

  ('16', 'Bomber Jacket ''90s''', 95.00, 'Retrospect Vintage', '1',
   'https://picsum.photos/id/145/400/600', 'Chaquetas/Abrigos', 'Hombre', 2, null, null, null),

  ('17', 'Falda Midi Plisada', 55.00, 'The Modernist', '2',
   'https://picsum.photos/id/163/400/600', 'Faldas', 'Mujer', 6, null, null, null),

  ('18', 'Sandalias de Cuero', 60.00, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://picsum.photos/id/211/400/600', 'Calzado', 'Mujer', 14, null, null, null),

  ('19', 'Camiseta Básica Orgánica', 30.00, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://picsum.photos/id/250/400/600', 'Camisetas', 'Mujer', 40, null, null, null),

  ('20', 'Pendientes de Plata', 40.00, 'Artisan Accents', '3',
   'https://picsum.photos/id/301/400/600', 'Accesorios', 'Mujer', 22, null, null, null),

  ('21', 'Sombrero de Paja ''Verano''', 28.00, 'Boutique Sol y Luna', 'sol-y-luna',
   'https://picsum.photos/id/355/400/600', 'Accesorios', 'Mujer', 1, null, null, null)
on conflict (id) do nothing;

-- Reseñas iniciales
insert into reviews (id, store_id, user_name, rating, comment, date) values
  ('rev1', '1', 'Ana Ruiz', 5, 'Increíble selección vintage, ¡me encanta!', '2024-06-12'),
  ('rev2', '1', 'Marco Polo', 4, 'Buena calidad pero precios algo altos.', '2024-06-15')
on conflict (id) do nothing;
