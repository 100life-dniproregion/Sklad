-- Увімкнути Realtime для синхронізації між пристроями
ALTER PUBLICATION supabase_realtime ADD TABLE items, movements, warehouses, projects;
