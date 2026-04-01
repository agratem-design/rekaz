
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Auth upload images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');
CREATE POLICY "Auth delete images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'images');
CREATE POLICY "Auth update images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'images');
