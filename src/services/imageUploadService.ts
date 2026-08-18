import { supabase } from '@/integrations/supabase/client';
import { generateSafeUUID } from '@/lib/uuid';

export type ImageUploadProvider = 'supabase_storage' | 'imgbb' | 'freeimage' | 'postimages' | 'cloudinary' | 'google_drive';

let cachedSettings: any = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds cache

export const getCompanySettingsForUpload = async () => {
  if (cachedSettings && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedSettings;
  }
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching company settings:', error);
    return null;
  }
  cachedSettings = data;
  cacheTimestamp = Date.now();
  return data;
};

export const getImageUploadProvider = async (): Promise<ImageUploadProvider> => {
  const settings = await getCompanySettingsForUpload();
  return (settings?.image_upload_provider as ImageUploadProvider) || 'supabase_storage';
};

export const clearImageUploadCache = () => {
  cachedSettings = null;
  cacheTimestamp = 0;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function sanitizeStorageKey(name: string): string {
  return name
    .replace(/[^\w.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Converts Google Drive URLs to direct image URLs
 */
export function normalizeGoogleImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return url || '';
  
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Pattern 1: drive.google.com/uc?id=XXXXX or drive.google.com/uc?export=view&id=XXXXX
  const ucMatch = trimmed.match(/drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) {
    return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  }

  // Pattern 2: drive.google.com/file/d/XXXXX/view
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }

  // Pattern 3: drive.google.com/open?id=XXXXX
  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  }

  return trimmed;
}

function generateUUID(): string {
  return generateSafeUUID();
}

// Upload directly to Supabase storage
const uploadToSupabaseStorage = async (file: File, name?: string): Promise<string> => {
  const ext = file.name?.split('.').pop() || 'png';
  const rawName = name || generateUUID();
  const fileName = `${sanitizeStorageKey(rawName)}-${Date.now()}.${ext}`;
  const filePath = fileName;

  console.log('Uploading to Supabase Storage...', filePath);
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file, {
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error('فشل رفع الصورة إلى Supabase Storage: ' + error.message);
  }

  const { data: publicData } = supabase.storage
    .from('images')
    .getPublicUrl(data.path);

  console.log('Supabase Storage upload success:', publicData.publicUrl);
  return publicData.publicUrl;
};

const uploadBase64ToSupabaseStorage = async (base64: string, name?: string): Promise<string> => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const file = new File([blob], `${name || 'image'}.png`, { type: 'image/png' });

  return uploadToSupabaseStorage(file, name);
};

// Upload directly to ImgBB
const uploadToImgbbDirect = async (base64: string, name?: string): Promise<string> => {
  const settings = await getCompanySettingsForUpload();
  const apiKey = settings?.imgbb_api_key;
  if (!apiKey) throw new Error('مفتاح ImgBB API غير مُعد في إعدادات النظام');

  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('image', base64);
  if (name) formData.append('name', name);

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  if (response.ok && result?.data?.url) {
    return result.data.url;
  }
  throw new Error(result?.error?.message || 'فشل رفع الصورة إلى ImgBB');
};

// Upload directly to FreeImage
const uploadToFreeImageDirect = async (base64: string, name?: string): Promise<string> => {
  const settings = await getCompanySettingsForUpload();
  const apiKey = settings?.freeimage_api_key;
  if (!apiKey) throw new Error('مفتاح FreeImage API غير مُعد في إعدادات النظام');

  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('image', base64);
  if (name) formData.append('name', name);

  const response = await fetch('https://freeimage.host/api/1/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  if (response.ok && result?.image?.url) {
    return result.image.url;
  }
  throw new Error(result?.error?.message || 'فشل رفع الصورة إلى FreeImage');
};

// Upload directly to PostImages
const uploadToPostImagesDirect = async (base64: string, name?: string): Promise<string> => {
  const settings = await getCompanySettingsForUpload();
  const apiKey = settings?.postimages_api_key;
  if (!apiKey) throw new Error('مفتاح PostImages API غير مُعد في إعدادات النظام');

  const formBody: Record<string, string> = {
    key: apiKey,
    o: '2b819584285c102318568238c7d4a4c7',
    m: '59c2ad4b46b0c1e12d5703302bff0120',
    version: '1.0.1',
    portable: '1',
    image: base64,
  };
  if (name) {
    formBody.name = name;
    formBody.type = 'png';
  }

  const encodedBody = Object.keys(formBody)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(formBody[k])}`)
    .join('&');

  const response = await fetch('https://api.postimage.org/1/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: encodedBody,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error('فشل رفع الصورة إلى PostImages');
  }

  const hotlinkMatch = responseText.match(/<hotlink>(https?:\/\/[^<]+)<\/hotlink>/);
  const directMatch = responseText.match(/<direct_link>(https?:\/\/[^<]+)<\/direct_link>/);
  
  const imageUrl = hotlinkMatch?.[1] || directMatch?.[1];
  if (!imageUrl) {
    throw new Error('فشل استخراج رابط الصورة من PostImages');
  }
  return imageUrl;
};

// Upload directly to Google Drive via Apps Script
const uploadToGoogleDriveDirect = async (base64: string, name?: string, mimeType?: string, folder?: string): Promise<string> => {
  const settings = await getCompanySettingsForUpload();
  const scriptUrl = folder === 'billboard-photos' || folder === 'billboard-exports'
    ? (settings?.google_drive_billboard_script_url || settings?.google_drive_script_url)
    : settings?.google_drive_script_url;

  if (!scriptUrl) throw new Error('رابط Google Apps Script الخاص بـ Google Drive غير مُعد في إعدادات النظام');

  const rawName = name || `file_${Date.now()}`;
  const fileName = rawName.toLowerCase().endsWith('.jpg') ? rawName : `${rawName}.jpg`;

  console.log(`Uploading to Google Drive... folder: ${folder || 'general'}`);
  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      file: base64,
      name: fileName,
      type: mimeType || 'image/jpeg',
      folder: folder || 'general',
    }),
  });

  const result = await response.json();
  if (response.ok && result?.url) {
    return normalizeGoogleImageUrl(result.url);
  }
  throw new Error(result?.error || 'فشل رفع الملف إلى Google Drive');
};

// Upload via edge function proxy (for Cloudinary or others)
const uploadViaProxy = async (base64: string, provider: ImageUploadProvider, name?: string, folder?: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('upload-image', {
    body: { base64, name, provider, folder },
  });

  if (error) throw new Error(`فشل رفع الصورة إلى ${provider}: ` + error.message);
  if (!data?.url) throw new Error(data?.error || `فشل رفع الصورة إلى ${provider}`);
  return data.url;
};

// Main function to upload File
export const uploadImage = async (file: File, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  
  if (provider === 'supabase_storage') {
    return uploadToSupabaseStorage(file, name);
  }

  const base64 = await fileToBase64(file);
  
  if (provider === 'imgbb') return uploadToImgbbDirect(base64, name);
  if (provider === 'freeimage') return uploadToFreeImageDirect(base64, name);
  if (provider === 'postimages') return uploadToPostImagesDirect(base64, name);
  if (provider === 'google_drive') return uploadToGoogleDriveDirect(base64, name, file.type || 'image/jpeg', folder);
  
  return uploadViaProxy(base64, provider, name, folder);
};

// Main function to upload base64 string
export const uploadBase64Image = async (base64Data: string, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  if (provider === 'supabase_storage') {
    return uploadBase64ToSupabaseStorage(cleanBase64, name);
  }
  
  if (provider === 'imgbb') return uploadToImgbbDirect(cleanBase64, name);
  if (provider === 'freeimage') return uploadToFreeImageDirect(cleanBase64, name);
  if (provider === 'postimages') return uploadToPostImagesDirect(cleanBase64, name);
  if (provider === 'google_drive') return uploadToGoogleDriveDirect(cleanBase64, name, undefined, folder);
  
  return uploadViaProxy(cleanBase64, provider, name, folder);
};

// Upload with automatic fallback to Supabase Storage if the primary provider fails
export const uploadImageWithFallback = async (file: File, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  
  if (provider === 'supabase_storage') {
    return uploadToSupabaseStorage(file, name);
  }

  try {
    return await uploadImage(file, name, folder);
  } catch (err) {
    console.warn(`${provider} failed, falling back to Supabase Storage:`, err);
    try {
      return await uploadToSupabaseStorage(file, name);
    } catch (fallbackErr) {
      console.error('Supabase Storage fallback also failed:', fallbackErr);
      throw err; // throw original error
    }
  }
};
