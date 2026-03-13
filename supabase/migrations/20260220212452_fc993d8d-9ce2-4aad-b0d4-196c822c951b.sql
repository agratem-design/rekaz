-- Fix: Restrict profiles SELECT policy to prevent full user enumeration
-- Only users can view their own profile; admins can view all profiles

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all profiles (needed for user management)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
