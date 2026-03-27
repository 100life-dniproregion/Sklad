-- Початкові дані: склади, проєкти, налаштування

INSERT INTO warehouses (name, address, city) VALUES
  ('Офіс', 'майдан Праці, 1', 'Кривий Ріг'),
  ('Центральний склад', 'вул. Вільної Іхерії, 4', 'Кривий Ріг'),
  ('Мобільний пункт', 'вул. Шевченка, 3', 'Новомосковськ');

INSERT INTO projects (name, donor_source, start_date, end_date) VALUES
  ('Підтримка ВПО', 'UHF/OCHA', '2025-01-01', '2026-06-30'),
  ('Доступні ліки', 'Global Fund', '2024-10-01', '2026-12-31'),
  ('Реабілітація', 'GFFO/Humedica', '2025-06-01', '2026-12-31');

INSERT INTO settings DEFAULT VALUES;
