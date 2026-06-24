-- Create the item-photos storage bucket.
-- Files are stored at {household_id}/{item_id}/{filename} so storage policies
-- can scope access by the household_id prefix without querying the items table.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-photos',
  'item-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Household members can upload photos under their own household_id prefix
CREATE POLICY "household_members_upload_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'item-photos' AND
    (storage.foldername(name))[1] = get_my_household_id()::text
  );

-- Household members can view their own photos
CREATE POLICY "household_members_view_photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'item-photos' AND
    (storage.foldername(name))[1] = get_my_household_id()::text
  );

-- Household members can delete their own photos
CREATE POLICY "household_members_delete_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'item-photos' AND
    (storage.foldername(name))[1] = get_my_household_id()::text
  );
