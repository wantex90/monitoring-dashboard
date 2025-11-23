/*
  # Update Role System and Add Telegram Configuration

  1. Changes
    - Update user_profiles role constraint to support: superadmin, admin, viewer, maintainer
    - Add telegram_config table for alert notifications
    - Update RLS policies for role-based access
    - Set existing admin users to superadmin role
  
  2. Roles
    - superadmin: Full access to all features including user management
    - admin: Full access to monitoring and servers
    - viewer: Read-only access to servers and metrics
    - maintainer: Can view and perform server operations but cannot delete

  3. Security
    - Enable RLS on telegram_config table
    - Add role-based policies for user management
*/

-- Drop existing role constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add new role constraint with all roles
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('superadmin', 'admin', 'viewer', 'maintainer', 'user'));

-- Update default role value
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'viewer';

-- Create telegram_config table
CREATE TABLE IF NOT EXISTS telegram_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  bot_token text NOT NULL DEFAULT '',
  chat_id text NOT NULL DEFAULT '',
  enabled boolean DEFAULT false,
  alert_on_offline boolean DEFAULT true,
  alert_on_high_cpu boolean DEFAULT true,
  alert_on_high_memory boolean DEFAULT true,
  alert_on_high_disk boolean DEFAULT true,
  cpu_threshold numeric DEFAULT 80,
  memory_threshold numeric DEFAULT 80,
  disk_threshold numeric DEFAULT 80,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on telegram_config
ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for telegram_config
CREATE POLICY "Users can view own telegram config"
  ON telegram_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram config"
  ON telegram_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram config"
  ON telegram_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram config"
  ON telegram_config FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update existing 'admin' role users to 'superadmin'
UPDATE user_profiles SET role = 'superadmin' WHERE role = 'admin';

-- Update existing 'user' role users to 'viewer'
UPDATE user_profiles SET role = 'viewer' WHERE role = 'user';

-- Update user_profiles RLS policies to include role checks
DROP POLICY IF EXISTS "Superadmin can update any profile" ON user_profiles;

CREATE POLICY "Superadmin can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Superadmin can delete any profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Add helper function to check user role
CREATE OR REPLACE FUNCTION get_user_role(user_id_param uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM user_profiles WHERE id = user_id_param;
$$;

-- Add trigger to auto-create user profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = NEW.email,
      updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create default admin user if not exists (via edge function or manual setup required)
COMMENT ON TABLE user_profiles IS 'Default admin: email=admin@admin.com, password=admin123456 (must be created via Supabase Auth)';
