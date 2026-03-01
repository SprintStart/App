/*
  # Enhance Ad Metrics and Add Storage for Images

  1. Changes
    - Add sponsor_name and description fields to sponsored_ads for better reporting
    - Create storage bucket for ad banner images with public access
    - Add policies for admin access to upload images
  
  2. Security
    - Only admins can upload/delete images in ad-banners bucket
    - Images are publicly readable for display
*/

-- Add additional fields to sponsored_ads table for better reporting
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'sponsor_name') THEN
    ALTER TABLE sponsored_ads ADD COLUMN sponsor_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'description') THEN
    ALTER TABLE sponsored_ads ADD COLUMN description text;
  END IF;
END $$;

COMMENT ON COLUMN sponsored_ads.sponsor_name IS 'Name of the sponsoring organization for reporting';
COMMENT ON COLUMN sponsored_ads.description IS 'Internal description for admin reference';

-- Create storage bucket for ad banners if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-banners',
  'ad-banners',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for ad banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload ad banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update ad banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete ad banners" ON storage.objects;

-- Allow public read access to ad-banners bucket
CREATE POLICY "Public read access for ad banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ad-banners');

-- Allow admins to upload ad banners
CREATE POLICY "Admins can upload ad banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad-banners' AND
  EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND admin_allowlist.is_active = true
  )
);

-- Allow admins to update ad banners
CREATE POLICY "Admins can update ad banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ad-banners' AND
  EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND admin_allowlist.is_active = true
  )
);

-- Allow admins to delete ad banners
CREATE POLICY "Admins can delete ad banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad-banners' AND
  EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND admin_allowlist.is_active = true
  )
);

-- Verify indexes on ad metrics tables for performance
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created_at ON ad_impressions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_placement ON ad_impressions(ad_id, placement);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_created_at ON ad_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_placement ON ad_clicks(ad_id, placement);