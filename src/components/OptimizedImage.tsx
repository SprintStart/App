import { FEATURE_LOW_BANDWIDTH_MODE } from '../lib/featureFlags';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
}: OptimizedImageProps) {
  if (!FEATURE_LOW_BANDWIDTH_MODE) {
    return <img src={src} alt={alt} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}
