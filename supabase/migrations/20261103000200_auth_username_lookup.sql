-- دالة استرجاع البريد الإلكتروني لحساب المستخدم لتسجيل الدخول
-- تسمح بتسجيل الدخول باسم المستخدم أو البريد بكل مرونة وأمان

CREATE OR REPLACE FUNCTION public.get_auth_email_by_username(p_identifier text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(p.username) = lower(trim(p_identifier))
     OR lower(u.email) = lower(trim(p_identifier))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_username(text) TO anon, authenticated;
