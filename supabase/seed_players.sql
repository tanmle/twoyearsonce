-- Seed BeerCup players.
-- Run after supabase/schema.sql in the Supabase SQL editor.
-- Change role to 'admin' for whoever should be able to manually sync handicaps.

insert into public.players (id, name, avatar, role) values
  ('huy', 'Huy', 'https://ui-avatars.com/api/?name=Huy&background=00F06A&color=02090F&bold=true', 'admin'),
  ('tien', 'Tien', 'https://ui-avatars.com/api/?name=Tien&background=00F06A&color=02090F&bold=true', 'player'),
  ('lam', 'Lam', 'https://ui-avatars.com/api/?name=Lam&background=00F06A&color=02090F&bold=true', 'player'),
  ('tai', 'Tai', 'https://ui-avatars.com/api/?name=Tai&background=00F06A&color=02090F&bold=true', 'player'),
  ('tang', 'Tang', 'https://ui-avatars.com/api/?name=Tang&background=00F06A&color=02090F&bold=true', 'player'),
  ('tuc', 'Tuc', 'https://ui-avatars.com/api/?name=Tuc&background=00F06A&color=02090F&bold=true', 'player'),
  ('co', 'Co', 'https://ui-avatars.com/api/?name=Co&background=00F06A&color=02090F&bold=true', 'player'),
  ('thuong', 'Thuong', 'https://ui-avatars.com/api/?name=Thuong&background=00F06A&color=02090F&bold=true', 'player'),
  ('tan', 'Tan', 'https://ui-avatars.com/api/?name=Tan&background=00F06A&color=02090F&bold=true', 'player'),
  ('long', 'Long', 'https://ui-avatars.com/api/?name=Long&background=00F06A&color=02090F&bold=true', 'player')
on conflict (id) do update set
  name = excluded.name,
  avatar = excluded.avatar,
  role = excluded.role;
