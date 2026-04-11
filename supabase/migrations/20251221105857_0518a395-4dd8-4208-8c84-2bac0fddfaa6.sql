-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text DEFAULT 'اسم الشركة',
  company_logo text,
  report_background text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for all users (since no auth)
CREATE POLICY "Enable read access for all users" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.company_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.company_settings FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.company_settings FOR DELETE USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings row
INSERT INTO public.company_settings (company_name) VALUES ('اسم الشركة');