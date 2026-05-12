const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeVideoId(videoUrl: string): string | null {
  if (!videoUrl) return null;

  // Check if it's already just the 11 character ID
  if (YOUTUBE_VIDEO_ID_PATTERN.test(videoUrl)) {
    return videoUrl;
  }

  // Use the same regex as frontend for consistency, handling URLs with or without http://
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = videoUrl.match(regExp);
  
  return match && match[2].length === 11 ? match[2] : null;
}
