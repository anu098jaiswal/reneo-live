-- ============================================================
-- Storage: product images
-- ============================================================
-- 1. In the Supabase dashboard: Storage → New bucket → name it
--    "product-images" → make it PUBLIC (so <img> tags can load
--    directly without signed URLs).
-- 2. Then run this in the SQL editor to lock down writes.

create policy "product_images_public_read"
on storage.objects for select
using ( bucket_id = 'product-images' );

create policy "product_images_authenticated_upload"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
);

create policy "product_images_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and owner = auth.uid()
);
