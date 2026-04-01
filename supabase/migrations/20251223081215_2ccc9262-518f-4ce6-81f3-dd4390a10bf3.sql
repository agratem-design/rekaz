-- Allow unauthenticated users to look up profiles by username, display_name, or access_code for login purposes
CREATE POLICY "Allow login lookup by identifier"
ON public.profiles
FOR SELECT
USING (true);