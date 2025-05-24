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
  logLevel = "verbose",
}) => {
  const [backgroundPath, setBackgroundPath] = useState<string>("");
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Performance tracking states
  const [suspendCount, setSuspendCount] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    bufferingEvents: 0,
    suspendEvents: 0,
    playbackStartTime: 0,
    lastSuspendTime: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suspendLogThresholdRef = useRef<number>(10);
  const suspendLogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedSuspendsRef = useRef<boolean>(false);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
      if (suspendLogTimerRef.current) {
        clearTimeout(suspendLogTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchFromSettings = async () => {
      const bgPath = await window.electron.getSetting("background");
      setBackgroundPath(bgPath || "");
      logger.info("Background path:", bgPath);
    };
    fetchFromSettings();

    window.electron.on("reload-background", fetchFromSettings);

    return () => {
      window.electron.off("reload-background", fetchFromSettings);
    };
  }, []);

  useEffect(() => {
    const handlePreview = (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>;
      if (
        typeof updates.background === "string" &&
        updates.background !== backgroundPath
      ) {
        logger.info("Updating background to:", updates.background);
        setBackgroundPath(updates.background);
      }
    };
    window.electron.on("update-background-preview", handlePreview);

    return () => {
      window.electron.off("update-background-preview", handlePreview);
    };
  }, []);

  useEffect(() => {
    const detectAndSet = async () => {
      setVideoError(false);
      setImageError(false);
      setIsLoading(true);
      setVideoSrc(null);
      setImageSrc(null);

      if (!backgroundPath) return;

      const fileType = await window.electron.getFileType(backgroundPath);
      logger.info("File type:", fileType);

      if (fileType.startsWith("video")) {
        setIsVideo(true);
        const videoFilePath =
          await window.electron.convertToVideoFileUrl(backgroundPath);
        const cacheBuster = Date.now();
        setVideoSrc(`${videoFilePath}?nocache=${cacheBuster}`);
        logger.info("Video source set");
      } else if (fileType.startsWith("image")) {
        setIsVideo(false);
        const imageFilePath =
          await window.electron.getBackgroundImagePath(backgroundPath);
        const cacheBuster = Date.now();
        setImageSrc(`${imageFilePath}?nocache=${cacheBuster}`);
        logger.info("Image source set");
      } else {
        // File type is invalid or file does not exist
        setIsVideo(false);
        setImageSrc(null);
        setVideoSrc(null);
        setIsLoading(false);
        logger.warn("Invalid background path:", backgroundPath);
        videoLogger.warn("Invalid background path:", backgroundPath);
      }
    };
    detectAndSet();
  }, [backgroundPath]);

  // Reset performance metrics when video source changes
  useEffect(() => {
    if (videoSrc && isVideo) {
      setSuspendCount(0);
      setPerformanceMetrics({
        bufferingEvents: 0,
        suspendEvents: 0,
        playbackStartTime: 0,
        lastSuspendTime: 0,
      });
      hasLoggedSuspendsRef.current = false;
    }
  }, [videoSrc, isVideo]);

  // Set up performance monitoring for video
  useEffect(() => {
    if (videoSrc && isVideo && !isLoading && !videoError) {
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
  }, [videoSrc, isVideo, isLoading, videoError, performanceMetrics]);

  // Enhanced video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc || !isVideo) return;

    const handleCanPlay = () => {
      setIsLoading(false);
      setPerformanceMetrics((prev) => ({
        ...prev,
        playbackStartTime: Date.now(),
      }));
      hasLoggedSuspendsRef.current = false;
    };

    const handleSuspend = () => {
      const now = Date.now();
      const currentSuspendCount = suspendCount + 1;

      setPerformanceMetrics((prev) => ({
        ...prev,
        suspendEvents: prev.suspendEvents + 1,
        lastSuspendTime: now,
      }));

      setSuspendCount(currentSuspendCount);

      if (suspendLogTimerRef.current) {
        clearTimeout(suspendLogTimerRef.current);
      }

      // Only log if we haven't already logged for this session and hit threshold
      if (
        !hasLoggedSuspendsRef.current &&
        currentSuspendCount % suspendLogThresholdRef.current === 0
      ) {
        hasLoggedSuspendsRef.current = true;

        suspendLogTimerRef.current = setTimeout(() => {
          videoLogger.warn("Video experiencing possible playback issues", {
            suspendCount: currentSuspendCount,
            bufferLength: getBufferLength(video),
          });
        }, 100);
      }
    };

    const handlePlay = () => {
      // Only log on first play or after errors
      if (performanceMetrics.playbackStartTime === 0) {
        videoLogger.info("Video started playing");
      }
    };

    const handleEnded = () => {
      try {
        video.currentTime = 0;
        requestAnimationFrame(() => {
          video.play().catch((err) => {
            videoLogger.warn("Loop replay failed:", err);
            handleVideoError("loop");
          });
        });
      } catch (err) {
        videoLogger.warn("Loop handling error:", err);
        handleVideoError("loop");
      }
    };

    const handleWaiting = () => {
      setPerformanceMetrics((prev) => ({
        ...prev,
        bufferingEvents: prev.bufferingEvents + 1,
      }));

      // Only log if verbose or if we're having repeated buffering issues
      if (logLevel === "verbose" || performanceMetrics.bufferingEvents > 5) {
        videoLogger.info("Video buffering", {
          bufferLength: getBufferLength(video),
        });
      }
    };

    // Add event listeners
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("suspend", handleSuspend);
    video.addEventListener("waiting", handleWaiting);

    // Set video to fully preload data
    video.preload = "auto";

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("suspend", handleSuspend);
      video.removeEventListener("waiting", handleWaiting);
    };
  }, [videoSrc, isVideo, logLevel, suspendCount, performanceMetrics]);

  // Helper function to calculate buffer length
  const getBufferLength = (video: HTMLVideoElement): number => {
    if (video.buffered.length === 0) return 0;
    return video.buffered.end(video.buffered.length - 1) - video.currentTime;
  };

  // Enhanced video error handling with metadata analysis
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

    // Analyze video metadata for debugging
    if (videoSrc) {
      try {
        const sanitizedPath = videoSrc
          .replace(/^video-file:\/\//, "")
          .split("?")[0];
        const metadata = await window.electron.getVideoMetadata(sanitizedPath);
        logger.info("Video metadata:", metadata);
        videoLogger.info("Video metadata:", metadata);

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video"
        );

        if (videoStream) {
          if (
            videoStream.codec_tag_string === "hvc1" ||
            videoStream.codec_tag_string === "hev1"
          ) {
            showSmallWindow(
              "Encoding Error",
              `Video: ${sanitizedPath} \nuses a likely unsupported ${videoStream.codec_tag_string} encoding.`,
              ["OK"]
            );
            videoLogger.error(
              `Video: ${sanitizedPath} \nuses a likely unsupported ${videoStream.codec_tag_string} encoding`
            );
          } else {
            showSmallWindow(
              "Video Error",
              `Video: ${sanitizedPath} Codec: ${videoStream.codec_name}. Container Tag: ${videoStream.codec_tag_string}.` +
                " This codec combination may not be supported by your system or the Electron video player.",
              ["OK"]
            );
            videoLogger.error(
              "Error with videoStream " +
                `Codec: ${videoStream.codec_name} . Container Tag: ${videoStream.codec_tag_string}`
            );
          }
        } else {
          logger.warn("No video stream found in metadata.");
          videoLogger.warn("No video stream found in metadata.");
        }
      } catch (error) {
        logger.error("Error retrieving video metadata:", error);
        videoLogger.error("Error retrieving video metadata:", error);
      }
    }

    setVideoError(true);
    setIsLoading(false);
    logger.warn(
      `Video error occurred during ${context}, falling back to image or color.`
    );
    videoLogger.warn(
      `Video error occurred during ${context}, falling back to image or color.`
    );
  };

  // Handle image error
  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
    logger.error("Image failed to load, using fallback color");
  };

  const videoStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity,
  };

  const imageStyle: React.CSSProperties = {
    opacity: isLoading ? 0 : opacity,
  };

  const fallbackStyle: React.CSSProperties = {
    backgroundColor: fallbackColor,
  };

  if (isVideo && videoSrc && !videoError) {
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
          crossOrigin="anonymous"
          onLoadStart={() => {
            if (logLevel === "verbose") {
              videoLogger.info("Video load started");
            }
          }}
          onStalled={() => videoLogger.warn("Video stalled")}
          onCanPlayThrough={() => setIsLoading(false)}
        ></video>
      </div>
    );
  }

  if (!isVideo && imageSrc && !imageError) {
    return (
      <div className="image-background">
        <img
          id="image-bg"
          ref={imageRef}
          src={imageSrc}
          style={imageStyle}
          onLoad={() => setIsLoading(false)}
          onError={handleImageError}
          alt="Background"
        />
      </div>
    );
  }

  return <div className="fallback" style={fallbackStyle}></div>;
};

export default Background;
