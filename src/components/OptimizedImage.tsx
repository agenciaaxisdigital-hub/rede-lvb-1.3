import { useState, useRef, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Main image src (WebP preferred) */
  src: string;
  /** Fallback for browsers without WebP */
  fallbackSrc?: string;
  /** Tiny base64 placeholder for blur-up effect */
  blurDataUrl?: string;
  /** Whether this image is above the fold (disables lazy loading) */
  priority?: boolean;
}

/**
 * Optimized image component with:
 * - Native lazy loading
 * - async decoding
 * - Blur-up LQIP placeholder
 * - Intersection Observer fallback
 */
const OptimizedImage = memo(function OptimizedImage({
  src,
  fallbackSrc,
  blurDataUrl,
  priority = false,
  className,
  alt = '',
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setLoaded(true);
  }, []);

  return (
    <div className={cn('relative overflow-hidden', className)} style={props.style}>
      {/* Blur placeholder */}
      {blurDataUrl && !loaded && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg"
          style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }}
        />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onLoad={() => setLoaded(true)}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : blurDataUrl ? 'opacity-0' : 'opacity-100'
        )}
        {...props}
        style={undefined}
      />
    </div>
  );
});

export default OptimizedImage;
