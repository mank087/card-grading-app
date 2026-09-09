'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

/** Reserve the existing card frame while its photo loads, including cached images. */
export default function ProgressiveCardImage(props: ImageProps) {
  const key = typeof props.src === 'string' ? props.src : 'default' in props.src ? props.src.default.src : props.src.src
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  return <>
    {loaded !== key && <span className="dcm-photo-loading" aria-hidden="true" />}
    {failed === key ? <span className="dcm-photo-error">Card image unavailable</span> : <Image {...props}
      ref={image => { if (image?.complete && image.naturalWidth > 0) setLoaded(key) }}
      onLoad={event => { setLoaded(key); props.onLoad?.(event) }}
      onError={event => { setFailed(key); props.onError?.(event) }}
    />}
  </>
}
