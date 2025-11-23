/*
  # Add Superadmin View All Profiles Policy

  1. Changes
    - Add policy for superadmin to view all user profiles
  
  2. Security
    - Superadmin can view all profiles
    - Maintains existing policies for admin and users
*/

-- Add policy for superadmin to view all profiles
CREATE POLICY "Superadmin can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'superadmin'
    )
  );
