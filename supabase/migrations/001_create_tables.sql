-- WMS Database Schema for БО «100% Життя» Дніпровський регіон
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  donor_source TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'шт',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER DEFAULT 0,
  source TEXT,
  warehouse_id UUID REFERENCES warehouses(id),
  project_id UUID REFERENCES projects(id),
  inventory_number TEXT,
  expiry_date DATE DEFAULT '2099-12-31',
  price NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'UAH',
  manufacturer TEXT,
  batch_number TEXT,
  serial_number TEXT,
  condition TEXT DEFAULT 'Новий',
  storage_conditions TEXT,
  country_of_origin TEXT,
  external_barcode TEXT,
  qr_code UUID DEFAULT gen_random_uuid(),
  notes TEXT,
  receipt_date DATE,
  is_deleted BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_movement_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('incoming','outgoing','transfer','writeoff','adjustment')),
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,
  recipient_name TEXT,
  responsible_person TEXT,
  quality_check TEXT DEFAULT 'accepted',
  rejection_reason TEXT,
  reason TEXT,
  act_number TEXT,
  approved_by TEXT,
  notes TEXT,
  project_id UUID REFERENCES projects(id),
  device_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  organization_name TEXT DEFAULT 'БО «100% Життя» Дніпровський регіон',
  theme TEXT DEFAULT 'dark',
  critical_expiry_days INTEGER DEFAULT 30,
  warning_expiry_days INTEGER DEFAULT 90,
  dead_stock_days INTEGER DEFAULT 180,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER movements_updated_at BEFORE UPDATE ON movements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
