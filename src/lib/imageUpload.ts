import { supabase } from './supabase';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image to Supabase Storage
 * @param file - The image file to upload
 * @param teacherId - Teacher's user ID
 * @param quizId - Quiz/draft ID
 * @param questionId - Question ID
 * @returns Result with public URL or error
 */
export async function uploadQuestionImage(
  file: File,
  teacherId?: string,
  quizId?: string,
  questionId?: string
): Promise<ImageUploadResult> {
  try {
    // Check authentication status
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[ImageUpload] No valid session:', sessionError);
      return {
        success: false,
        error: 'You must be logged in to upload images. Please refresh and try again.',
      };
    }

    console.log('[ImageUpload] Session valid, user:', session.user.id);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
      };
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size exceeds 5MB limit.',
      };
    }

    // Generate organized path: teacherId/quizId/questionId/filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    let fileName: string;
    if (teacherId && quizId && questionId) {
      fileName = `${teacherId}/${quizId}/${questionId}/${timestamp}-${random}.${fileExt}`;
    } else {
      // Fallback to flat structure if IDs not provided
      fileName = `questions/${timestamp}-${random}.${fileExt}`;
    }

    console.log('[ImageUpload] Uploading to path:', fileName);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('question-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[ImageUpload] Storage error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image.',
      };
    }

    console.log('[ImageUpload] Upload successful:', data.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('question-images')
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (err) {
    console.error('Image upload error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Delete an image from Supabase Storage
 * @param imageUrl - The public URL of the image to delete
 * @returns Success status
 */
export async function deleteQuestionImage(imageUrl: string): Promise<boolean> {
  try {
    // Extract path from URL
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/question-images\/(.+)$/);

    if (!pathMatch) {
      console.error('Invalid image URL format');
      return false;
    }

    const filePath = pathMatch[1];

    // Delete from storage
    const { error } = await supabase.storage
      .from('question-images')
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Image delete error:', err);
    return false;
  }
}

/**
 * Validate image URL
 * @param url - The URL to validate
 * @returns True if URL is valid and accessible
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
