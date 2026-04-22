/**
 * A client to fetch stock video assets from Pexels.
 */
export async function searchPexelsVideo(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[Pexels] No API Key found in environment.");
    return null;
  }

  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      console.error(`[Pexels] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (data.videos && data.videos.length > 0) {
      // Get the HD or SD link (preferring mp4)
      const video = data.videos[0];
      const file =
        video.video_files.find((f: any) => f.quality === "hd" || f.quality === "sd") ||
        video.video_files[0];
      console.log(`[Pexels] Found video for "${query}": ${file.link}`);
      return file.link;
    }

    console.log(`[Pexels] No videos found for "${query}"`);
    return null;
  } catch (error) {
    console.error(`[Pexels] Failed to search for "${query}":`, error);
    return null;
  }
}
