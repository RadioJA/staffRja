-- 1. Tabla de Perfiles (Extensión de auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Moderadores
CREATE TABLE IF NOT EXISTS moderadores (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  categoria TEXT NOT NULL,
  dias_horario TEXT[] NOT NULL, -- Array de días (ej: {'Lunes', 'Martes'})
  inicio TEXT NOT NULL,         -- Formato "HH:MM AM/PM"
  fin TEXT NOT NULL,
  nombre TEXT NOT NULL,
  pais TEXT NOT NULL,
  fecha_ingreso DATE,
  fecha_cumple DATE,
  director_horario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users
);

-- 3. Tabla de Locutores
CREATE TABLE IF NOT EXISTS locutores (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  categoria TEXT NOT NULL,
  dias_horario TEXT[] NOT NULL,
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  nombre TEXT NOT NULL,
  programa TEXT,
  canto TEXT,
  slogan TEXT,
  pais TEXT,
  fecha_ingreso DATE,
  fecha_cumple DATE,
  director TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users
);

-- 4. Tabla de Directores de Horario (Dh)
CREATE TABLE IF NOT EXISTS directores_horario (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  categoria TEXT NOT NULL,
  dias_horario TEXT[] NOT NULL,
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  nombre TEXT NOT NULL,
  pais TEXT,
  fecha_ingreso DATE,
  fecha_cumple DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users
);

-- 5. Tabla de Directiva General (DG)
CREATE TABLE IF NOT EXISTS directiva_general (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  pais TEXT,
  fecha_ingreso DATE,
  fecha_cumple DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users
);

-- 6. Tabla de Reportes
CREATE TABLE IF NOT EXISTS reportes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  user_email TEXT,
  categoria TEXT NOT NULL,
  mes INTEGER NOT NULL, -- 0-11 (Enero-Diciembre)
  fecha DATE NOT NULL,
  director TEXT NOT NULL,
  estuvo TEXT NOT NULL, -- 'Sí' o 'No'
  cubrio TEXT,
  loc1 TEXT,
  loc2 TEXT,
  whatsapp TEXT,
  chat TEXT,
  redes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de Configuración de Certificados
CREATE TABLE IF NOT EXISTS cert_configs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  config_name TEXT UNIQUE DEFAULT 'default',
  cert_x INTEGER DEFAULT 50,
  cert_y INTEGER DEFAULT 52,
  cert_dir_x INTEGER DEFAULT 75,
  cert_dir_y INTEGER DEFAULT 83,
  cert_firma_x INTEGER DEFAULT 75,
  cert_firma_y INTEGER DEFAULT 75,
  cert_firma_w INTEGER DEFAULT 15,
  cert_firma_dg_x INTEGER DEFAULT 25,
  cert_firma_dg_y INTEGER DEFAULT 75,
  cert_firma_dg_w INTEGER DEFAULT 15,
  director_nombre TEXT,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Función y Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario Nuevo'), 
    NEW.email,
    CASE WHEN NEW.email = 'ministrylion@gmail.com' THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. Políticas de Seguridad (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE locutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE directores_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE directiva_general ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

-- Políticas para Perfiles (Limpieza Total)
DROP POLICY IF EXISTS "Perfiles visibles por usuarios autenticados" ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Admins pueden actualizar todos los perfiles" ON profiles;
DROP POLICY IF EXISTS "Admins pueden borrar perfiles" ON profiles;
DROP POLICY IF EXISTS "Select_Policy_profiles" ON profiles;
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Función auxiliar para verificar si el usuario es admin
-- Se usa SECURITY DEFINER para que la función tenga permisos de lectura sobre la tabla profiles
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Select_Policy_profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios pueden insertar su propio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins pueden actualizar todos los perfiles" ON profiles FOR UPDATE USING (is_admin());
CREATE POLICY "Admins pueden borrar perfiles" ON profiles FOR DELETE USING (is_admin());

-- Aplicar políticas restrictivas a todas las tablas de gestión
-- Moderadores, Locutores, DH, DG y Reportes seguirán la misma lógica:

DO $body$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['moderadores', 'locutores', 'directores_horario', 'directiva_general', 'reportes'];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        -- Asegurar que la columna user_id existe antes de procesar las políticas
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN user_id UUID DEFAULT auth.uid() REFERENCES auth.users', t);
        END IF;

        -- Eliminar políticas anteriores para evitar conflictos
        EXECUTE format('DROP POLICY IF EXISTS "Acceso total %s" ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Usuarios ven sus propios %s" ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Select_Policy_%s" ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Insert_Policy_%s" ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Update_Policy_%s" ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Delete_Policy_%s" ON %I', t, t);
        
        -- 1. SELECT: Usuarios ven lo suyo, Admins ven TODO
        EXECUTE format('CREATE POLICY "Select_Policy_%s" ON %I FOR SELECT USING (auth.uid() = user_id OR is_admin())', t, t);
        
        -- 2. INSERT: Cualquier autenticado puede insertar
        EXECUTE format('CREATE POLICY "Insert_Policy_%s" ON %I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', t, t);
        
        -- 3. UPDATE: Usuarios editan lo suyo, Admins editan TODO
        EXECUTE format('CREATE POLICY "Update_Policy_%s" ON %I FOR UPDATE USING (auth.uid() = user_id OR is_admin())', t, t);
        
        -- 4. DELETE: SOLO Administradores
        EXECUTE format('CREATE POLICY "Delete_Policy_%s" ON %I FOR DELETE USING (is_admin())', t, t);
    END LOOP;
END $body$;

-- 10. Políticas específicas para cert_configs (Configuración Global)
ALTER TABLE cert_configs ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas genéricas previas para esta tabla
-- 1. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Lectura_Global_Cert_Configs" ON cert_configs;
DROP POLICY IF EXISTS "Escritura_Admin_Cert_Configs" ON cert_configs;
DROP POLICY IF EXISTS "Insert_Admin_Cert_Configs" ON cert_configs;
DROP POLICY IF EXISTS "Update_Admin_Cert_Configs" ON cert_configs;

-- 2. Permitir que cualquier usuario autenticado LEA la configuración
CREATE POLICY "Lectura_Global_Cert_Configs" 
ON cert_configs FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. Permitir INSERCIÓN a Administradores
CREATE POLICY "Insert_Admin_Cert_Configs" 
ON cert_configs FOR INSERT 
WITH CHECK (is_admin());

-- 4. Permitir ACTUALIZACIÓN a Administradores
CREATE POLICY "Update_Admin_Cert_Configs" 
ON cert_configs FOR UPDATE 
USING (is_admin()) 
WITH CHECK (is_admin());

-- 5. Permitir ELIMINACIÓN a Administradores
CREATE POLICY "Delete_Admin_Cert_Configs" 
ON cert_configs FOR DELETE 
USING (is_admin());

-- RECTIFICACIÓN MANUAL: Asegurar que el admin principal tenga el rol correcto
-- Ejecuta esto para actualizar tu usuario actual si ya existe
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'ministrylion@gmail.com';