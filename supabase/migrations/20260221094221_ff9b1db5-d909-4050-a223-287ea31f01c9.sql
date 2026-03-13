-- Improve audit trigger to skip system-generated balance-only updates on treasuries
-- When a DB trigger updates treasuries.balance, auth.uid() is null and only balance changes
-- These are redundant since the actual transaction is already audited
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _user_email text;
  _old jsonb;
  _new jsonb;
  _changed jsonb;
  _record_id text;
  _key text;
BEGIN
  _user_id := auth.uid();
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    _record_id := _old->>'id';
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'DELETE', _user_id, _user_email, _old, NULL, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _record_id := _new->>'id';
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'INSERT', _user_id, _user_email, NULL, _new, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _record_id := _new->>'id';
    _changed := '{}'::jsonb;
    FOR _key IN SELECT jsonb_object_keys(_new)
    LOOP
      IF _key NOT IN ('updated_at', 'created_at') AND (_old->_key IS DISTINCT FROM _new->_key) THEN
        _changed := _changed || jsonb_build_object(_key, jsonb_build_object('old', _old->_key, 'new', _new->_key));
      END IF;
    END LOOP;
    
    -- Skip logging if no meaningful fields changed
    IF _changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    
    -- Skip system-generated balance-only updates (from triggers) on treasuries
    -- These are redundant because the transaction itself is already audited
    IF _user_id IS NULL AND TG_TABLE_NAME = 'treasuries' THEN
      -- Check if only 'balance' changed (system trigger update)
      IF (SELECT count(*) FROM jsonb_object_keys(_changed) k WHERE k != 'balance') = 0 THEN
        RETURN NEW;
      END IF;
    END IF;
    
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'UPDATE', _user_id, _user_email, _old, _new, _changed);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;