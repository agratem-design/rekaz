-- Add meter_rate and piece_rate columns to technicians table
ALTER TABLE public.technicians
ADD COLUMN meter_rate numeric NULL,
ADD COLUMN piece_rate numeric NULL;