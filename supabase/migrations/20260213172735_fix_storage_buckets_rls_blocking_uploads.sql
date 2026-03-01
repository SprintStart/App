/*
  # Fix Storage Buckets RLS - ROOT CAUSE FOUND

  ## CRITICAL DISCOVERY
  The storage.buckets table has RLS ENABLED but NO POLICIES!
  This blocks ALL access to buckets, which prevents uploads.

  ## Root Cause
  - storage.buckets: RLS enabled, 0 policies → blocks everything
  - storage.objects: RLS enabled, permissive policies → would work BUT...
  - Upload requires access to BOTH tables
  - No bucket access = upload fails with RLS error

  ## Solution
  Add permissive policies to storage.buckets to allow public read access

  ## Security
  - Public can SELECT buckets (safe - just bucket metadata)
  - This allows the storage API to verify bucket exists and is accessible
*/

-- Enable public read access to storage buckets
CREATE POLICY "Public can view all storage buckets"
  ON storage.buckets
  FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to view buckets (redundant but explicit)
CREATE POLICY "Authenticated can view all storage buckets"
  ON storage.buckets
  FOR SELECT
  TO authenticated
  USING (true);
