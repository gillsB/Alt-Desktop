import React, { useEffect, useRef, useState } from "react";
import "../styles/Background.css";
import { createLogger, createVideoLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("Background.tsx");
const videoLogger = createVideoLogger("Background.tsx");

interface BackgroundProps {
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
 * @returns {JSX.Element} The Background component.
 */
const Background: React.FC<BackgroundProps> = ({
  opacity = 1,
  fallbackColor = "#87BEC5",
  logLevel = "normal",
}) => {
  // State for background functionality
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
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

  const fallbackToImage = async (overrides?: Partial<SettingsData>) => {
    logger.warn("Falling back to image background");
    videoLogger.warn("Falling back to image background");

    setVideoError(true);
    setVideoSrc(null);

    try {
      let imageBackground: string | null = null;
      if (overrides?.imageBackground === "") {
        logger.warn("Image background empty");
      } else {
        // Check for image background
        imageBackground = overrides?.imageBackground
          ? overrides.imageBackground
          : await window.electron.getSetting("imageBackground");
        logger.info("imageBackground setting:", imageBackground);
      }

      if (imageBackground) {
        const imageFilePath =
          await window.electron.getBackgroundImagePath(imageBackground);
        if (imageFilePath) {
          logger.info("Converted image file path:", imageFilePath);

          // Add cache busting parameter
          const cacheBuster = Date.now();
          setImageSrc(`${imageFilePath}?nocache=${cacheBuster}`);
          setImageError(false);
        } else {
          setImageError(true);
          setImageSrc(null);
        }
      } else {
        logger.warn("No image background found, falling back to solid color.");
        setImageError(true);
        setImageSrc(null);
      }
    } catch (error) {
      logger.error("Error fetching image background:", error);
      setImageError(true);
      setImageSrc(null);
    }

    setIsLoading(false);
  };

  const fetchBackgroundSettings = async (overrides?: Partial<SettingsData>) => {
    try {
      let videoBackground: string | null = null;
      // First check for video background
      if (overrides?.videoBackground === "") {
        setVideoError(true);
        setVideoSrc(null);
      } else {
        videoBackground = overrides?.videoBackground
          ? overrides.videoBackground
          : await window.electron.getSetting("videoBackground");
      }

      logger.info("videoBackground setting:", videoBackground);
      videoLogger.info("videoBackground setting:", videoBackground);

      if (videoBackground) {
        const fileType = await window.electron.getFileType(videoBackground);
        logger.info("Video attempt File type:", fileType);
        if (fileType.startsWith("video")) {
          setIsLoading(true);
          const videoFilePath =
            await window.electron.convertToVideoFileUrl(videoBackground);
          logger.info("Converted video file path:", videoFilePath);
          videoLogger.info("Converted video file path:", videoFilePath);

          // Add cache busting parameter to prevent browser caching issues
          const cacheBuster = Date.now();
          setVideoSrc(`${videoFilePath}?nocache=${cacheBuster}`);
          setVideoError(false);
          logger.info("Video source set - attempting to load.");

          return; // Exit early if we have a valid video file path
        } else {
          logger.info(
            `videoBackground ${videoBackground} is not a video file, checking for image fallback.`
          );
          videoLogger.info(
            `videoBackground ${videoBackground} is not a video file, checking for image fallback.`
          );
        }
      } else {
        logger.warn("No video background found, checking for image fallback.");
      }

      // If we get here, video failed or doesn't exist, fall back to image
      await fallbackToImage(overrides);
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

  useEffect(() => {
    fetchBackgroundSettings();

    const handleReload = () => {
      logger.info("Received reload event, reloading background settings...");
      fetchBackgroundSettings(); // Re-fetch the background settings
    };

    window.electron.on("reload-background", handleReload);

    return () => {
      window.electron.off("reload-background", handleReload);
    };
  }, []);

  useEffect(() => {
    const handlePreview = (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>; // Extract the second argument as updates
      logger.info("Received background preview updates:", updates);

      fetchBackgroundSettings(updates); // Fetch with overrides
    };

    window.electron.on("update-background-preview", handlePreview);

    return () => {
      window.electron.off("update-background-preview", handlePreview);
    };
  }, []);

  // Reset retry count when video source changes
  useEffect(() => {
    if (videoSrc) {
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

  const handleVideoError = async (context = "load") => {
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

    // Log video metadata for debugging
    if (videoSrc) {
      try {
        // Remove "video-file://" protocol if present
        const sanitizedPath = videoSrc
          .replace(/^video-file:\/\//, "")
          .split("?")[0]; // Remove cache buster
        const metadata = await window.electron.getVideoMetadata(sanitizedPath);
        logger.info("Video metadata:", metadata);
        videoLogger.info("Video metadata:", metadata);
        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video"
        );
        if (videoStream) {
          if (videoStream.codec_tag_string === "hvc1") {
            showSmallWindow(
              "Encoding Error",
              `Video: ${sanitizedPath} \nuses an unsupported hvc1 encoding and will not work`,
              ["OK"]
            );
          }
        } else {
          logger.warn("No video stream found in metadata.");
        }
      } catch (error) {
        logger.error("Error retrieving video metadata:", error);
        videoLogger.error("Error retrieving video metadata:", error);
      }
    }

    logger.warn(`No video source. Trying image fallback.`);
    videoLogger.warn(`No video source. Trying image fallback.`);
    setVideoError(true);
    fallbackToImage();
  };

  // Handle image error
  const handleImageError = () => {
    logger.error("Image failed to load, using fallback color");
    setImageError(true);
    setIsLoading(false);
  };

  const videoStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity, // Hide video until it's ready
  };

  const imageStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity, // Hide image until it's ready
  };

  const fallbackStyle: React.CSSProperties = {
    backgroundColor: fallbackColor,
  };

  // Case 1: Video is available and working
  if (videoSrc && !videoError) {
    return (
      <div className="video-background">
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
      </div>
    );
  }

  // Case 2: Video failed, try image background
  if (imageSrc && !imageError) {
    return (
      <div className="image-background">
        <img
          id="image-bg"
          ref={imageRef}
          src={imageSrc}
          style={imageStyle}
          onError={handleImageError}
          alt="Background"
        />
      </div>
    );
  }

  // Case 3: Both video and image failed or don't exist, use fallback color
  return <div className="fallback" style={fallbackStyle}></div>;
};

export default Background;
