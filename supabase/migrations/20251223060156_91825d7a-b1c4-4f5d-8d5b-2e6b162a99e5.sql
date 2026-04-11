-- Add username and title columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for username lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);