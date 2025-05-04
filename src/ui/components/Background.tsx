import React, { useEffect, useRef, useState } from "react";
import { createLogger, createVideoLogger } from "../util/uiLogger";

const logger = createLogger("VideoBackground.tsx");
const videoLogger = createVideoLogger("VideoBackground.tsx");

interface VideoBackgroundProps {
  opacity?: number;
  fallbackColor?: string;
  logLevel?: "verbose" | "normal";
}

/**
 * A React component that renders a background with fallback options.
 * - First attempts to use a video background
 * - If video fails, falls back to an image background
 * - If both fail, uses a solid color background
 *
 * @component
 * @param {number} [opacity=1] - The opacity of the background.
 * @param {string} [fallbackColor="#87BEC5"] - The fallback background color if both video and image fail.
 * @param {string} [logLevel="normal"] - Controls verbosity of video events logging.
 * @returns {JSX.Element} The VideoBackground component.
 */
const VideoBackground: React.FC<VideoBackgroundProps> = ({
  opacity = 1,
  fallbackColor = "#87BEC5",
  logLevel = "normal",
}) => {
  // State for background functionality
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
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
  const imageRef = useRef<HTMLImageElement>(null);
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
    const fetchBackgroundSettings = async () => {
      try {
        // First check for video background
        const videoBackground =
          await window.electron.getSetting("videoBackground");
        logger.info("videoBackground setting:", videoBackground);
        videoLogger.info("videoBackground setting:", videoBackground);

        if (videoBackground) {
          const fileType = await window.electron.getFileType(videoBackground);
          if (fileType === "video/mp4") {
            setIsLoading(true);
            const videoFilePath =
              await window.electron.convertToVideoFileUrl(videoBackground);
            logger.info("Converted video file path:", videoFilePath);
            videoLogger.info("Converted video file path:", videoFilePath);

            // Add cache busting parameter to prevent browser caching issues
            const cacheBuster = Date.now();
            setVideoSrc(`${videoFilePath}?nocache=${cacheBuster}`);
            setVideoError(false);
            return; // Exit early if we have a valid video
          } else {
            logger.info(
              `videoBackground ${videoBackground} is not a video file, checking for image fallback.`
            );
            videoLogger.info(
              `videoBackground ${videoBackground} is not a video file, checking for image fallback.`
            );
            setVideoSrc(null);
            setVideoError(true);
          }
        } else {
          // No video setting found
          setVideoError(true);
          setVideoSrc(null);
        }

        // If we get here, video failed or doesn't exist, check for image background
        const imageBackground =
          await window.electron.getSetting("imageBackground");
        logger.info("imageBackground setting:", imageBackground);
        const imageFilePath =
          await window.electron.getBackgroundImagePath(imageBackground);
        logger.info("Converted image file path:", imageFilePath);

        if (imageBackground) {
          logger.info("Converted image file path:", imageFilePath);

          // Add cache busting parameter
          const cacheBuster = Date.now();
          setImageSrc(`${imageFilePath}?nocache=${cacheBuster}`);
          setImageError(false);
          setIsLoading(false);
        } else {
          // No image setting found
          setImageError(true);
          setImageSrc(null);
          setIsLoading(false);
        }
      } catch (error) {
        logger.error("Error fetching background settings:", error);
        videoLogger.error("Error fetching background settings:", error);
        setVideoSrc(null);
        setImageSrc(null);
        setVideoError(true);
        setImageError(true);
        setIsLoading(false);
      }
    };
    fetchBackgroundSettings();

    const handleReload = () => {
      logger.info("Received reload event, reloading background settings...");
      fetchBackgroundSettings(); // Re-fetch the background settings
    };

    window.electron.on("reloadBackground", handleReload);

    return () => {
      window.electron.off("reloadBackground", handleReload);
    };
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

        videoLogger.info("Video performance metrics:", {
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
      videoLogger.info("Video can play");
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
          videoLogger.info("Multiple video suspends detected", {
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
      videoLogger.info("Video playing");
    };

    const handleEnded = () => {
      videoLogger.info("Video playback ended, preparing to loop");

      try {
        // Some browsers need this explicit loop handling
        video.currentTime = 0;

        // Use requestAnimationFrame for smoother loop transition
        requestAnimationFrame(() => {
          video.play().catch((err) => {
            videoLogger.warn("Error during loop replay:", err);
            handleVideoError("loop");
          });
        });
      } catch (err) {
        videoLogger.warn("Error during loop handling:", err);
        handleVideoError("loop");
      }
    };

    const handleWaiting = () => {
      setPerformanceMetrics((prev) => ({
        ...prev,
        bufferingEvents: prev.bufferingEvents + 1,
      }));

      videoLogger.info("Video waiting for data", {
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
            videoLogger.warn("Navigator API failed on attempt:", e);
          });
      } catch (e) {
        videoLogger.warn("Navigator API not supported:", e);
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

    videoLogger.error(`Video error occurred during ${context}`, {
      currentSrc: video.currentSrc,
      networkState: video.networkState,
      errorCode: video.error?.code,
      errorMessage: video.error?.message,
      currentTime: video.currentTime,
      readyState: video.readyState,
    });

    // If we haven't exceeded max retries, try again
    if (retryCount < maxRetries && videoSrc) {
      videoLogger.info(`Retrying video load (${retryCount + 1}/${maxRetries})`);
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
        `Max retries (${maxRetries}) reached or no video source. Trying image fallback.`
      );
      videoLogger.warn(
        `Max retries (${maxRetries}) reached or no video source. Trying image fallback.`
      );
      setVideoError(true);
      checkImageBackground();
    }
  };

  // Function to check for an image background when video fails
  const checkImageBackground = async () => {
    try {
      // Check for image background if not already checked
      if (!imageSrc) {
        const localizedPath =
          await window.electron.getSetting("imageBackground");
        const imageBackground =
          await window.electron.getBackgroundImagePath(localizedPath);
        logger.info("Falling back to imageBackground:", imageBackground);

        if (imageBackground) {
          const imageFilePath =
            await window.electron.getBackgroundImagePath(imageBackground);
          logger.info("Converted image file path:", imageFilePath);

          // Add cache busting parameter
          const cacheBuster = Date.now();
          setImageSrc(`${imageFilePath}?nocache=${cacheBuster}`);
          setImageError(false);
        } else {
          setImageError(true);
        }
      }
      setIsLoading(false);
    } catch (error) {
      logger.error("Error fetching image background:", error);
      setImageSrc(null);
      setImageError(true);
      setIsLoading(false);
    }
  };

  // Handle image error
  const handleImageError = () => {
    logger.error("Image failed to load, using fallback color");
    setImageError(true);
    setIsLoading(false);
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

  const imageStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity, // Hide image until it's ready
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none", // Prevent interaction with the image
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

  // Case 1: Video is available and working
  if (videoSrc && !videoError) {
    return (
      <video
        id="video-bg"
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop
        style={videoStyle}
        src={videoSrc}
        onError={() => handleVideoError("initial")}
        // Force crossOrigin to anonymous for better browser handling
        crossOrigin="anonymous"
        // Additional event handlers for better debugging and performance logging
        onLoadStart={() => videoLogger.info("Video load started")}
        onStalled={() => videoLogger.warn("Video playback stalled")}
        onCanPlayThrough={() => {
          videoLogger.info("Video can play through without buffering");
          setIsLoading(false);
        }}
      ></video>
    );
  }

  // Case 2: Video failed, try image background
  if (imageSrc && !imageError) {
    return (
      <img
        id="image-bg"
        ref={imageRef}
        src={imageSrc}
        style={imageStyle}
        onError={handleImageError}
        alt="Background"
      />
    );
  }

  // Case 3: Both video and image failed or don't exist, use fallback color
  return <div style={fallbackStyle}></div>;
};

export default VideoBackground;
