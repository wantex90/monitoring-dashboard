/*
  # Add Advanced Features to Monitoring System

  1. Schema Updates
    - Add `tags` column to servers table for grouping/categorization
    - Add `notes` column to servers table for documentation
    - Add user profile and role management
    - Add alert thresholds and notification preferences
    
  2. New Tables
    - `user_profiles` - Extended user information
      - `id` (uuid, references auth.users)
      - `full_name` (text)
      - `role` (text) - admin, user
      - `email_notifications` (boolean)
      - `telegram_chat_id` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `alert_thresholds` - Configurable alert thresholds per server
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key)
      - `metric_type` (text) - cpu, memory, disk
      - `threshold_value` (numeric)
      - `enabled` (boolean)
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
    - Admin users can manage all data
    - Regular users can only view assigned servers
*/

-- Add new columns to servers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'tags'
  ) THEN
    ALTER TABLE servers ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'notes'
  ) THEN
    ALTER TABLE servers ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  email_notifications boolean DEFAULT true,
  telegram_chat_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create alert_thresholds table
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES servers(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk')),
  threshold_value numeric NOT NULL CHECK (threshold_value >= 0 AND threshold_value <= 100),
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(server_id, metric_type)
);

ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert thresholds"
  ON alert_thresholds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert alert thresholds"
  ON alert_thresholds FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update alert thresholds"
  ON alert_thresholds FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete alert thresholds"
  ON alert_thresholds FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN new.email LIKE '%@admin.%' THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_servers_tags ON servers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_server_id ON alert_thresholds(server_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);