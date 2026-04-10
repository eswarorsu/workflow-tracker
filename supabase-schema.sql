-- ============================================
-- Work Process Tracker — Custom DB Auth Schema
-- Run this ENTIRE script in the Supabase SQL Editor
-- WARNING: This replaces the previous schema entirely.
-- ============================================

-- 0. Wipe existing to prevent constraint issues
DROP TABLE IF EXISTS public.dependencies CASCADE;
DROP TABLE IF EXISTS public.work_items CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Custom ENUM types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE work_status AS ENUM ('blocked', 'in-progress', 'done');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE dependency_type AS ENUM ('partial', 'full');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE work_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Custom Users table (Completely disconnected from Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Storing passwords explicitly since we bypassed Supabase Auth
    role user_role DEFAULT 'member',
    skills TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Work Items table
CREATE TABLE public.work_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    priority work_priority DEFAULT 'medium',
    required_skills TEXT[] DEFAULT '{}',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status work_status DEFAULT 'in-progress',
    assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    blocked_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Dependencies table (adjacency list)
CREATE TABLE public.dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_id UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    type dependency_type NOT NULL DEFAULT 'full',
    threshold INTEGER DEFAULT 100 CHECK (threshold > 0 AND threshold <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(predecessor_id, successor_id),
    CHECK (predecessor_id != successor_id)
);

-- 5. Disable RLS across the board
-- Because we are managing Auth internally via Next.js Server Actions, 
-- Server Actions operate effectively with full trust. Next.js enforces Route and Action security.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependencies DISABLE ROW LEVEL SECURITY;

-- 6. Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_items_updated_at
BEFORE UPDATE ON public.work_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- IMPORTANT: Supabase native Auth triggers are DROPPED entirely!
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
