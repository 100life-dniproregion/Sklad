-- УВАГА: спочатку створіть користувача через Supabase Dashboard:
-- Authentication → Users → Add user → вкажіть email і пароль → Auto Confirm = ON
-- Потім виконайте цей запит, замінивши email на ваш:

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
WHERE email = 'inconnueolga@gmail.com';

-- Для інших користувачів:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role": "logistics"}' WHERE email = '...';
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role": "field"}' WHERE email = '...';
