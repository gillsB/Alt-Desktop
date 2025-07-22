import { SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import React, { useEffect, useRef, useState } from "react";
import "../styles/Background.css";
import { createLogger, createVideoLogger } from "../util/uiLogger";
import { isAbsolutePath, showSmallWindow } from "../util/uiUtil";

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
 * @param {string} [fallbackColor="#2c2c2c"] - The fallback background color if both video and image fail.
 * @param {string} [logLevel="normal"] - Controls verbosity of video events logging.
 * @returns {JSX.Element} The Background component.
 */
const Background: React.FC<BackgroundProps> = ({
  opacity = 1,
  fallbackColor = "#2c2c2c",
  logLevel = "verbose",
}) => {
  const [backgroundPath, setBackgroundPath] = useState<string>("");
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);

  // Performance tracking states
  const [suspendCount, setSuspendCount] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    bufferingEvents: 0,
    suspendEvents: 0,
    playbackStartTime: 0,
    lastSuspendTime: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null!);
  const imageRef = useRef<HTMLImageElement>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suspendLogThresholdRef = useRef<number>(10);
  const suspendLogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedSuspendsRef = useRef<boolean>(false);
  const wasPlayingRef = useRef(false);
  const [showVideoControls, setShowVideoControls] = useState(false);
  const videoControlsPositionRef = useRef({ x: 40, y: 40 });
  const previousVolumeRef = useRef<number>(1);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume, videoRef, videoSrc]);

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
      const id = await window.electron.getSetting("background");
      if (id === undefined) {
        logger.error("Background returned undefined from settings.");
        return;
      }
      let filePath = await convertIDToFilePath(id);
      if (filePath) {
        // Always resolve shortcut if the file is a shortcut
        const fileType = await window.electron.getFileType(filePath);
        if (fileType === "application/x-ms-shortcut") {
          const resolved = await window.electron.resolveShortcut(filePath);
          if (resolved) filePath = resolved;
        }
      }
      setBackgroundPath(filePath || "");
      logger.info("Background reloaded with path:", filePath);
      if (!showVideoControls) {
        const vol = await window.electron.getBackgroundVolume(id || "");
        setVolume(vol === 0 ? 0 : 0.5);
      }
    };
    fetchFromSettings();

    window.electron.on("reload-background", fetchFromSettings);

    return () => {
      window.electron.off("reload-background", fetchFromSettings);
    };
  }, []);

  const lastEventRef = useRef<string>("");
  useEffect(() => {
    const handlePauseOnWindowState = async (...args: unknown[]) => {
      const event = args[1] as string;

      // Skip duplicate events in development mode (strict mode).
      if (event === lastEventRef.current) {
        logger.warn(
          "Duplicate window state event ignored (This happens in Dev due to strict mode, if in Prod this is likely an error):",
          event
        );
        return;
      }
      lastEventRef.current = event;
      logger.info("PauseOnWindowState event received:", event);

      const video = videoRef.current;
      if (!video) return;

      if (event === "minimize" || event === "hide") {
        wasPlayingRef.current = !video.paused;
        video.pause();
      } else if (event === "restore" || event === "show") {
        if (wasPlayingRef.current) {
          video.play().catch(() => {});
        }
      }
    };

    window.electron.on("window-visibility", handlePauseOnWindowState);
    return () => {
      window.electron.off("window-visibility", handlePauseOnWindowState);
    };
  }, []);

  useEffect(() => {
    const showControls = (...args: unknown[]) => {
      logger.info("showVideoControls event received:", args[1]);
      setShowVideoControls(!!args[1]);
    };
    window.electron.on("show-video-controls", showControls);
    return () => {
      window.electron.off("show-video-controls", showControls);
    };
  }, []);

  const convertIDToFilePath = async (id: string) => {
    return await window.electron.idToFilePath(id);
  };

  useEffect(() => {
    const handlePreview = async (...args: unknown[]) => {
      const updates = args[1] as Partial<SettingsData>;
      if (
        typeof updates.background === "string" &&
        updates.background !== backgroundPath
      ) {
        logger.info("Updating background to:", updates.background);
        if (updates.background === "fallback") {
          logger.info("Background set to fallback, skipping background logic.");
          setBackgroundPath("");
          return;
        }
        let filePath = updates.background;
        if (filePath && !isAbsolutePath(filePath)) {
          filePath = (await convertIDToFilePath(filePath)) || "";
        }
        if (filePath) {
          // Always resolve shortcut if the file is a shortcut
          const fileType = await window.electron.getFileType(filePath);
          if (fileType === "application/x-ms-shortcut") {
            const resolved = await window.electron.resolveShortcut(filePath);
            if (resolved) filePath = resolved;
          }
        }
        setBackgroundPath(filePath || "");
      }
      if (!showVideoControls) {
        const vol = await window.electron.getBackgroundVolume(
          updates.background || ""
        );
        setVolume(vol === 0 ? 0 : 0.5);
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
        setVideoSrc(`${videoFilePath}?nocache=${Date.now()}`);
        logger.info("Video source set");
      } else if (fileType.startsWith("image")) {
        setIsVideo(false);
        const imageFilePath =
          await window.electron.getBackgroundImagePath(backgroundPath);
        setImageSrc(`${imageFilePath}?nocache=${Date.now()}`);
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
      <>
        <div className="video-background">
          <video
            id="video-bg"
            ref={videoRef}
            autoPlay
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
        {showVideoControls && (
          <VideoControls
            videoRef={videoRef}
            playing={playing}
            setPlaying={setPlaying}
            progress={progress}
            setProgress={setProgress}
            volume={volume}
            setVolume={setVolume}
            positionRef={videoControlsPositionRef}
            previousVolumeRef={previousVolumeRef}
          />
        )}
      </>
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

interface VideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  positionRef: React.RefObject<{ x: number; y: number }>;
  previousVolumeRef: React.RefObject<number>;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  videoRef,
  playing,
  setPlaying,
  progress,
  setProgress,
  volume,
  setVolume,
  positionRef,
  previousVolumeRef,
}) => {
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Hard defined width and height for the controls
  const componentWidth = 385;
  const componentHeight = 55;

  // TODO actually this should reset every time the user sets showVideoControls to true (in case it gets stuck off screen or something).
  useEffect(() => {
    // Only set location to default if it's never been set.
    if (positionRef.current.x === 40 && positionRef.current.y === 40) {
      const x = window.innerWidth / 2 - componentWidth / 2;
      const y = window.innerHeight - componentHeight - 50;
      positionRef.current = { x, y };
    }
  }, []);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [videoRef]);

  // Throttled progress sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (!video.duration) return;
      setProgress((video.currentTime / video.duration) * 100);
    };

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("seeked", updateProgress); // update immediately after seek
    video.addEventListener("loadedmetadata", updateProgress); // also update when metadata is loaded

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("seeked", updateProgress);
      video.removeEventListener("loadedmetadata", updateProgress);
    };
  }, [videoRef]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    //video.volume = newVolume;
    if (newVolume > 0) {
      previousVolumeRef.current = newVolume;
    }
  };

  const handleVolumeToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    if (volume === 0) {
      // Unmute: restore to previous volume
      const newVolume =
        previousVolumeRef.current > 0 ? previousVolumeRef.current : 1;
      setVolume(newVolume);
      video.volume = newVolume;
    } else {
      // Mute: save current volume and set to 0
      previousVolumeRef.current = volume;
      setVolume(0);
      video.volume = 0;
    }
  };

  // Play/pause toggle
  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  // Seek bar change
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const newTime = (parseFloat(e.target.value) / 100) * video.duration;
    video.currentTime = newTime;
    setProgress((newTime / video.duration) * 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    // Check if the pressed key is the left or right arrow key
    if (e.key === "ArrowRight") {
      // Jump 10 seconds forward
      const newTime = video.currentTime + 10;
      video.currentTime = Math.min(newTime, video.duration);
      e.preventDefault();
      setProgress((video.currentTime / video.duration) * 100);
    } else if (e.key === "ArrowLeft") {
      // Jump 10 seconds backward
      const newTime = video.currentTime - 10;
      video.currentTime = Math.max(newTime, 0);
      e.preventDefault();
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
  }, [videoRef]);

  // Drag logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    if (!dragging) return;

    const controlsElement = document.querySelector(
      ".video-controls"
    ) as HTMLElement;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      // Ensure the controls stay within the viewport
      const maxX = window.innerWidth - componentWidth;
      const maxY = window.innerHeight - componentHeight;

      // Prevent dragging off-screen
      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));

      positionRef.current = { x: boundedX, y: boundedY };

      // Update DOM directly for smooth dragging
      if (controlsElement) {
        controlsElement.style.left = `${boundedX}px`;
        controlsElement.style.top = `${boundedY}px`;
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  return (
    <div
      className={`video-controls ${dragging ? "dragging" : ""}`}
      style={{
        left: positionRef.current.x,
        top: positionRef.current.y,
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          handlePlayPause();
        }}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* Volume Control */}
      <div
        className="volume-control"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleVolumeToggle();
          }}
          title={volume === 0 ? "Unmute" : "Mute"}
          className="volume-button"
        >
          {volume === 0 ? (
            <SpeakerXMarkIcon className="h-6 w-6 text-gray-500" />
          ) : (
            <SpeakerWaveIcon className="h-6 w-6 text-gray-500" />
          )}
        </button>
        {showVolumeSlider && (
          <div className="volume-slider-container">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="volume-slider"
            />
          </div>
        )}
      </div>

      {/* Current time display */}
      <span className="time">
        {formatTime(videoRef.current?.currentTime ?? 0)}
      </span>
      <div className="seek-bar">
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onInput={handleSeek}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Video length display */}
      <span className="time">
        {formatTime(videoRef.current?.duration ?? 0)}
      </span>
    </div>
  );
};
