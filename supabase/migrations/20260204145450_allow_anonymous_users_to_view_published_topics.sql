/*
  # Allow Anonymous Users to View Published Topics

  Students need to be able to see topics even when not logged in.
  Add RLS policy allowing anonymous users to SELECT published topics.
*/

CREATE POLICY "Anonymous users can view published topics"
  ON topics
  FOR SELECT
  TO anon
  USING (is_active = true AND is_published = true);
