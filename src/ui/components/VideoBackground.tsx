import React, { useEffect, useRef, useState } from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("VideoBackground.tsx");

interface VideoBackgroundProps {
  opacity?: number;
  fallbackColor?: string;
  logLevel?: "verbose" | "normal";
}

/**
 * A React component that renders a video background.
 * - It uses a custom video protocol to securely load videos from any location
 * - If the video fails to load, it falls back to a solid color background.
 *
 * @component
 * @param {number} [opacity=1] - The opacity of the video background.
 * @param {string} [fallbackColor="#87BEC5"] - The fallback background color if the video fails to load.
 * @param {string} [logLevel="normal"] - Controls verbosity of video events logging.
 * @returns {JSX.Element} The VideoBackground component.
 */
const VideoBackground: React.FC<VideoBackgroundProps> = ({
  opacity = 1,
  fallbackColor = "#87BEC5",
  logLevel = "normal",
}) => {
  // State for video functionality
  const [videoError, setVideoError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [suspendCount, setSuspendCount] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    bufferingEvents: 0,
    suspendEvents: 0,
    playbackStartTime: 0,
    lastSuspendTime: 0,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suspendLogThresholdRef = useRef<number>(10); // Log after this many suspend events
  const suspendLogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;

  // New flag to track if "Multiple video suspends detected" has been logged
  const hasLoggedSuspendsRef = useRef<boolean>(false);

  // Clear any existing timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
      if (suspendLogTimerRef.current) {
        clearTimeout(suspendLogTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchBackgroundSetting = async () => {
      try {
        const background = await window.electron.getSetting("background");
        logger.info("Background setting:", background);

        if (background) {
          setIsLoading(true);
          const videoFilePath =
            await window.electron.convertToVideoFileUrl(background);
          logger.info("Converted video file path:", videoFilePath);

          // Add cache busting parameter to prevent browser caching issues
          const cacheBuster = Date.now();
          setVideoSrc(`${videoFilePath}?nocache=${cacheBuster}`);
          setVideoError(false);
        }
      } catch (error) {
        logger.error("Error fetching background setting:", error);
        setVideoSrc(null);
        setVideoError(true);
        setIsLoading(false);
      }
    };

    fetchBackgroundSetting();
  }, []);

  // Reset retry count when video source changes
  useEffect(() => {
    if (videoSrc) {
      setRetryCount(0);
      setSuspendCount(0);
      setPerformanceMetrics({
        bufferingEvents: 0,
        suspendEvents: 0,
        playbackStartTime: 0,
        lastSuspendTime: 0,
      });
    }
  }, [videoSrc]);

  // Set up performance monitoring interval
  useEffect(() => {
    if (videoSrc && !isLoading && !videoError) {
      // Only log detailed metrics every 60 seconds to avoid console spam
      metricsIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video) return;

        logger.info("Video performance metrics:", {
          bufferingEvents: performanceMetrics.bufferingEvents,
          suspendEvents: performanceMetrics.suspendEvents,
          currentPlaybackTime: video.currentTime,
          bufferedRanges: Array.from(
            { length: video.buffered.length },
            (_, i) => ({
              start: video.buffered.start(i),
              end: video.buffered.end(i),
            })
          ),
          droppedFrames: video.getVideoPlaybackQuality?.()
            ? video.getVideoPlaybackQuality().droppedVideoFrames
            : "unsupported",
        });
      }, 60000); // Log every 60 seconds
    }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [videoSrc, isLoading, videoError, performanceMetrics]);

  // Handle video events for better playback management
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    const handleCanPlay = () => {
      logger.info("Video can play");
      setIsLoading(false);
      setPerformanceMetrics((prev) => ({
        ...prev,
        playbackStartTime: Date.now(),
      }));

      // Reset the suspend log flag when the video starts playing
      hasLoggedSuspendsRef.current = false;
    };

    const handleSuspend = () => {
      const now = Date.now();
      const currentSuspendCount = suspendCount + 1;
      const timeSinceLastSuspend = now - performanceMetrics.lastSuspendTime;

      // Update metrics
      setPerformanceMetrics((prev) => ({
        ...prev,
        suspendEvents: prev.suspendEvents + 1,
        lastSuspendTime: now,
      }));

      // Update suspend count
      setSuspendCount(currentSuspendCount);

      // Clear any existing timer to ensure we don't log multiple times
      if (suspendLogTimerRef.current) {
        clearTimeout(suspendLogTimerRef.current);
      }

      // Log only once per playback session
      if (
        !hasLoggedSuspendsRef.current &&
        (currentSuspendCount % suspendLogThresholdRef.current === 0 ||
          logLevel === "verbose")
      ) {
        hasLoggedSuspendsRef.current = true; // Mark as logged for this session

        // Use a small delay to batch potential rapid suspend events
        suspendLogTimerRef.current = setTimeout(() => {
          logger.info("Multiple video suspends detected", {
            suspendCount: currentSuspendCount,
            timeSinceLastSuspend,
            bufferLength: getBufferLength(video),
            currentTime: video.currentTime,
            readyState: video.readyState,
          });
        }, 100);
      }
    };

    const handlePlay = () => {
      logger.info("Video playing");
    };

    const handleEnded = () => {
      logger.info("Video playback ended, preparing to loop");

      try {
        // Some browsers need this explicit loop handling
        video.currentTime = 0;

        // Use requestAnimationFrame for smoother loop transition
        requestAnimationFrame(() => {
          video.play().catch((err) => {
            logger.warn("Error during loop replay:", err);
            handleVideoError("loop");
          });
        });
      } catch (err) {
        logger.warn("Error during loop handling:", err);
        handleVideoError("loop");
      }
    };

    const handleWaiting = () => {
      setPerformanceMetrics((prev) => ({
        ...prev,
        bufferingEvents: prev.bufferingEvents + 1,
      }));

      logger.info("Video waiting for data", {
        currentTime: video.currentTime,
        readyState: video.readyState,
        bufferLength: getBufferLength(video),
      });
    };

    // Set up all our listeners
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("suspend", handleSuspend);
    video.addEventListener("waiting", handleWaiting);

    // Set video to fully preload data
    video.preload = "auto";

    // Attempt to improve performance with better buffering
    if (
      "media" in navigator &&
      navigator.media &&
      typeof navigator.media === "object" &&
      "preload" in navigator.media
    ) {
      try {
        // @ts-expect-error - This API might not be available in all browsers
        navigator.media.preload
          .video({
            url: videoSrc,
            priority: "high",
            cachingStrategy: "persistent",
          })
          .catch((e: unknown) => {
            logger.warn("Navigator API failed on attempt:", e);
          });
      } catch (e) {
        logger.warn("Navigator API not supported:", e);
      }
    }

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("suspend", handleSuspend);
      video.removeEventListener("waiting", handleWaiting);
    };
  }, [videoSrc, logLevel, suspendCount, performanceMetrics]);

  // Helper function to calculate the buffer length
  const getBufferLength = (video: HTMLVideoElement): number => {
    if (video.buffered.length === 0) return 0;
    return video.buffered.end(video.buffered.length - 1) - video.currentTime;
  };

  const handleVideoError = (context = "load") => {
    const video = videoRef.current;
    if (!video) return;

    logger.error(`Video error occurred during ${context}`, {
      currentSrc: video.currentSrc,
      networkState: video.networkState,
      errorCode: video.error?.code,
      errorMessage: video.error?.message,
      currentTime: video.currentTime,
      readyState: video.readyState,
    });

    // If we haven't exceeded max retries, try again
    if (retryCount < maxRetries && videoSrc) {
      logger.info(`Retrying video load (${retryCount + 1}/${maxRetries})`);
      setRetryCount((prev) => prev + 1);

      // Force a reload with a new cache buster
      const currentSrc = videoSrc.split("?")[0];
      const newCacheBuster = Date.now();

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }

      // Clear source first
      setVideoSrc(null);

      // Then set a new source with cache buster after a short delay
      retryTimerRef.current = setTimeout(() => {
        if (videoRef.current) {
          setVideoSrc(`${currentSrc}?nocache=${newCacheBuster}`);
        }
      }, 1000);
    } else {
      logger.warn(
        `Max retries (${maxRetries}) reached or no video source. Showing fallback.`
      );
      setVideoError(true);
      setIsLoading(false);
    }
  };

  const videoStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity, // Hide video until it's ready
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none", // Prevent interaction with the video
    background: "transparent",
    zIndex: -1,
  };

  const fallbackStyle: React.CSSProperties = {
    backgroundColor: fallbackColor,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity,
    zIndex: -1,
  };

  return (
    <>
      {videoSrc && !videoError ? (
        <video
          id="video-bg"
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={videoStyle}
          src={videoSrc ?? undefined}
          onError={() => handleVideoError("initial")}
          // Force crossOrigin to anonymous for better browser handling
          crossOrigin="anonymous"
          // Additional event handlers for better debugging and performance logging
          onLoadStart={() => logger.info("Video load started")}
          onStalled={() => logger.warn("Video playback stalled")}
          onCanPlayThrough={() => {
            logger.info("Video can play through without buffering");
            setIsLoading(false);
          }}
        ></video>
      ) : (
        <div style={fallbackStyle}></div>
      )}
    </>
  );
};

export default VideoBackground;
