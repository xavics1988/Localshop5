-- ============================================================
-- Actualización de imágenes: reemplaza URLs de Google Aida
-- y picsum.photos por fotos de moda de Unsplash
-- ============================================================

-- Tiendas
update stores set image_url = 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400&h=300&fit=crop&q=80' where id = '1';
update stores set image_url = 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop&q=80' where id = '2';
update stores set image_url = 'https://images.unsplash.com/photo-1573408301185-9519f94fbf33?w=400&h=300&fit=crop&q=80' where id = '3';
update stores set image_url = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop&q=80' where id = 'sol-y-luna';

-- Productos
update products set image_url = 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=400&h=600&fit=crop&q=80' where id = '1';
update products set image_url = 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=600&fit=crop&q=80' where id = '2';
update products set image_url = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=600&fit=crop&q=80' where id = '3';
update products set image_url = 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=600&fit=crop&q=80' where id = '4';
update products set image_url = 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=600&fit=crop&q=80' where id = '5';
update products set image_url = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop&q=80' where id = '6';
update products set
  image_url = 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=600&fit=crop&q=80',
  images = array[
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1529139574466-a303027f1d8b?w=400&h=600&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551232864-3f0890e1f97c?w=400&h=600&fit=crop&q=80'
  ]
  where id = 'chaqueta-lino';
update products set image_url = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=600&fit=crop&q=80' where id = '8';
update products set image_url = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=600&fit=crop&q=80' where id = '9';
update products set image_url = 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&h=600&fit=crop&q=80' where id = '10';
update products set image_url = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=600&fit=crop&q=80' where id = '11';
update products set image_url = 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=600&fit=crop&q=80' where id = '12';
update products set image_url = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=600&fit=crop&q=80' where id = '13';
update products set image_url = 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=600&fit=crop&q=80' where id = '14';
update products set image_url = 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=400&h=600&fit=crop&q=80' where id = '15';
update products set image_url = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=600&fit=crop&q=80' where id = '16';
update products set image_url = 'https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=400&h=600&fit=crop&q=80' where id = '17';
update products set image_url = 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=600&fit=crop&q=80' where id = '18';
update products set image_url = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=600&fit=crop&q=80' where id = '19';
update products set image_url = 'https://images.unsplash.com/photo-1617038220319-276d3cfab212?w=400&h=600&fit=crop&q=80' where id = '20';
update products set image_url = 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=400&h=600&fit=crop&q=80' where id = '21';
