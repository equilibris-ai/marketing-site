"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

/*
 * A YouTube embed that reports to GA4 when a visitor starts the video and
 * when they watch it to the end — each at most once per page view.
 *
 * Uses the YouTube IFrame Player API (enablejsapi=1) to observe the player's
 * state. If the API script is blocked, the video still plays; it just goes
 * untracked.
 */

const API_SRC = "https://www.youtube.com/iframe_api";
const PLAYING = 1;
const ENDED = 0;

type PlayerStateEvent = { data: number };
type YouTubeApi = {
  Player: new (
    el: HTMLIFrameElement,
    opts: { events: { onStateChange: (e: PlayerStateEvent) => void } },
  ) => unknown;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/* Resolves once the IFrame API is loaded, injecting its script only once. */
function loadYouTubeApi(): Promise<YouTubeApi> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

type Props = { videoId: string; title: string };

export default function YouTubeVideo({ videoId, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let completed = false;
    const params = {
      video_provider: "youtube",
      video_title: title,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
    };

    loadYouTubeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      new YT.Player(iframeRef.current, {
        events: {
          onStateChange: ({ data }) => {
            if (data === PLAYING && !started) {
              started = true;
              trackEvent("video_start", params);
            } else if (data === ENDED && !completed) {
              completed = true;
              trackEvent("video_complete", { ...params, video_percent: 100 });
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [videoId, title]);

  return (
    <div className="video">
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
