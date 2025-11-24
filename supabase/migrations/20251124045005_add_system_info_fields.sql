/*
  # Add System Information Fields
  
  1. Changes to servers table
    - Add `cpu_model` (text) - CPU model name and info
    - Add `cpu_cores` (integer) - Number of CPU cores
    - Add `total_ram` (bigint) - Total RAM in bytes
    - Add `total_disk` (bigint) - Total disk space in bytes
    - Add `architecture` (text) - CPU architecture (x86_64, arm64)
    - Add `public_ip` (text) - Public IP address
    - Add `private_ip` (text) - Private IP address
    - Add `uptime_seconds` (bigint) - System uptime in seconds
    - Add `boot_time` (timestamptz) - Last boot timestamp
    - Add `kernel_version` (text) - Full kernel version string
    
  2. Important Notes
    - All fields are nullable to support gradual rollout
    - Agent will populate these fields during registration and updates
    - Frontend will display comprehensive system information
*/

-- Add new system information fields to servers table
DO $$
BEGIN
  -- CPU Information
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'cpu_model'
  ) THEN
    ALTER TABLE servers ADD COLUMN cpu_model text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'cpu_cores'
  ) THEN
    ALTER TABLE servers ADD COLUMN cpu_cores integer;
  END IF;
  
  -- Memory & Disk
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'total_ram'
  ) THEN
    ALTER TABLE servers ADD COLUMN total_ram bigint;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'total_disk'
  ) THEN
    ALTER TABLE servers ADD COLUMN total_disk bigint;
  END IF;
  
  -- Network
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'architecture'
  ) THEN
    ALTER TABLE servers ADD COLUMN architecture text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'public_ip'
  ) THEN
    ALTER TABLE servers ADD COLUMN public_ip text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'private_ip'
  ) THEN
    ALTER TABLE servers ADD COLUMN private_ip text;
  END IF;
  
  -- Uptime & Boot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'uptime_seconds'
  ) THEN
    ALTER TABLE servers ADD COLUMN uptime_seconds bigint;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'boot_time'
  ) THEN
    ALTER TABLE servers ADD COLUMN boot_time timestamptz;
  END IF;
  
  -- Kernel
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servers' AND column_name = 'kernel_version'
  ) THEN
    ALTER TABLE servers ADD COLUMN kernel_version text;
  END IF;
END $$;