/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import 'asciinema-player/dist/bundle/asciinema-player.css';

const NARROW_MAX_WIDTH = 640;

export default function TerminalDemo({ src, narrowSrc, posterAt, label }) {
  const containerRef = useRef(null);
  const castUrl = useBaseUrl(src);
  const narrowCastUrl = useBaseUrl(narrowSrc);

  useEffect(() => {
    let player;
    let cancelled = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = window.matchMedia(`(max-width: ${NARROW_MAX_WIDTH}px)`).matches;

    import('asciinema-player').then((AsciinemaPlayer) => {
      if (cancelled || !containerRef.current) return;
      player = AsciinemaPlayer.create(narrow ? narrowCastUrl : castUrl, containerRef.current, {
        autoPlay: !reduceMotion,
        loop: true,
        fit: 'width',
        theme: 'gitproxy',
        poster: `npt:${posterAt}`,
        controls: 'auto',
      });
    });

    return () => {
      cancelled = true;
      player?.dispose();
    };
  }, [castUrl, narrowCastUrl, posterAt]);

  return <div ref={containerRef} className='terminal-demo' role='img' aria-label={label} />;
}
