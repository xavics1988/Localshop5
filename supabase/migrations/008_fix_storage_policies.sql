-- Ensure the product-images bucket exists and is public
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Drop existing policies to avoid conflicts
drop policy if exists "Authenticated users can upload product images" on storage.objects;
drop policy if exists "Public read access for product images" on storage.objects;
drop policy if exists "Authenticated users can delete product images" on storage.objects;
drop policy if exists "Authenticated users can update product images" on storage.objects;

-- Allow authenticated users to upload (insert)
create policy "Authenticated users can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

-- Allow authenticated users to update/upsert
create policy "Authenticated users can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images');

-- Allow anyone to read
create policy "Public read access for product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

-- Allow authenticated users to delete
create policy "Authenticated users can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');
