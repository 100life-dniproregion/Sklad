-- Row Level Security — захист даних
-- Run this AFTER 001_create_tables.sql

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Всі авторизовані користувачі можуть читати
CREATE POLICY "read_all_items" ON items FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_movements" ON movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_warehouses" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_all_settings" ON settings FOR SELECT TO authenticated USING (true);

-- Всі авторизовані можуть створювати і оновлювати
CREATE POLICY "write_items" ON items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_items" ON items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_movements" ON movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "write_warehouses" ON warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_warehouses" ON warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_projects" ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Заборонити видалення (тільки soft delete через is_deleted)
CREATE POLICY "no_delete_items" ON items FOR DELETE TO authenticated USING (false);
CREATE POLICY "no_delete_movements" ON movements FOR DELETE TO authenticated USING (false);
