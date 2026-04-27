-- 1. Tabla de Perfiles (Extensión de auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Moderadores
CREATE TABLE moderadores (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Locutores
CREATE TABLE locutores (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Directores de Horario (Dh)
CREATE TABLE directores_horario (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  categoria TEXT NOT NULL,
  dias_horario TEXT[] NOT NULL,
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  nombre TEXT NOT NULL,
  pais TEXT,
  fecha_ingreso DATE,
  fecha_cumple DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Directiva General (DG)
CREATE TABLE directiva_general (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  pais TEXT,
  fecha_ingreso DATE,
  fecha_cumple DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Reportes
CREATE TABLE reportes (
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

-- 7. Función y Trigger para crear perfil automáticamente al registrarse
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Políticas de Seguridad (RLS)
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven sus propios reportes
CREATE POLICY "Usuarios ven sus propios reportes" ON reportes
  FOR SELECT USING (auth.uid() = user_id);

-- El Admin ve todos los reportes
CREATE POLICY "Admins ven todos los reportes" ON reportes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Permitir insertar reportes a usuarios autenticados
CREATE POLICY "Usuarios insertan sus reportes" ON reportes
  FOR INSERT WITH CHECK (auth.uid() = user_id);