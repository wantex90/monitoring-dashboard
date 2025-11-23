/*
  # Add Email Column to User Profiles

  1. Changes
    - Add `email` column to user_profiles table
    - Update trigger to auto-populate email on user creation
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add email column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text DEFAULT '';
  END IF;
END $$;

-- Update function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN new.email LIKE '%@admin.%' THEN 'admin'
      ELSE 'user'
    END,
    new.email
  )
  ON CONFLICT (id) DO UPDATE
  SET email = new.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;