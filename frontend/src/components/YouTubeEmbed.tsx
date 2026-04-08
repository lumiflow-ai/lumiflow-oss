interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

export function YouTubeEmbed({ videoId, title = "YouTube Video" }: YouTubeEmbedProps) {
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${videoId}?controls=1&autoplay=0&color=white&rel=0`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
      className="youtube-embed"
    />
  );
}
