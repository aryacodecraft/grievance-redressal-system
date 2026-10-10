"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { stopMediaStream } from "@/lib/camera";

/**
 * Live camera capture for the face-auth flows (DEC-024).
 *
 * The parent issues a challenge first, then renders this component with the
 * challenge `action`; frames are only sent to the backend inside the
 * challenge's 30 s TTL. Everything is client-side and ephemeral: frames live
 * in memory for one submit, tracks are stopped on every exit path, and no
 * preview image is ever persisted.
 */

const FRAME_COUNT = 6; // backend accepts 5-8
const FRAME_INTERVAL_MS = 250; // 6 frames over ~1.5 s
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const START_TIMEOUT_MS = 12_000;

type Phase = "starting" | "live" | "capturing" | "done";
type CamError = "denied" | "missing" | "timeout" | "unknown";

const ACTION_KEYS: Record<string, MessageKey> = {
  turn_left: "faceActTurnLeft",
  turn_right: "faceActTurnRight",
  blink: "faceActBlink",
  smile: "faceActSmile",
};

const CAMERA_ERROR_KEYS: Record<CamError, MessageKey> = {
  denied: "faceCameraDenied",
  missing: "faceCameraMissing",
  timeout: "faceCameraTimeout",
  unknown: "faceCameraError",
};

export function FaceCapture({
  action,
  onCapture,
  disabled = false,
  verifying = false,
  onCancel,
}: {
  /** Challenge action the captured frames must perform (e.g. "turn_left"). */
  action: string;
  onCapture: (frames: string[]) => void;
  disabled?: boolean;
  verifying?: boolean;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [camError, setCamError] = useState<CamError | null>(null);
  const [stillWorking, setStillWorking] = useState(false);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    setPhase("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("missing");
      return;
    }
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), START_TIMEOUT_MS)
    );
    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        }),
        timeout,
      ]);

      // React strict-mode double mount guard: if unmounted while getUserMedia was resolving
      if (unmountedRef.current) {
        stopMediaStream(stream);
        return;
      }

      // Stop any existing stream before replacing
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve) => {
          const done = () => {
            video.removeEventListener("loadedmetadata", done);
            resolve();
          };
          video.addEventListener("loadedmetadata", done);
        });
      }
      if (unmountedRef.current) {
        stopCamera();
        return;
      }
      setPhase("live");
    } catch (err) {
      stopCamera();
      if (unmountedRef.current) return;
      const name = err instanceof DOMException ? err.name : "";
      if (err instanceof Error && err.message === "timeout") setCamError("timeout");
      else if (name === "NotAllowedError" || name === "SecurityError") setCamError("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setCamError("missing");
      else setCamError("unknown");
    }
  }, [stopCamera]);

  const capture = useCallback(() => {
    if (phase !== "live" || disabled || verifying) return;
    const video = videoRef.current;
    if (!video) return;
    setPhase("capturing");
    const frames: string[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    const ctx = canvas.getContext("2d");
    timerRef.current = setInterval(() => {
      if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      frames.push(dataUrl.slice(dataUrl.indexOf(",") + 1));
      if (frames.length >= FRAME_COUNT) {
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        // Stop all tracks immediately after the last frame is captured (before network call)
        stopCamera();
        setPhase("done");
        onCapture(frames);
      }
    }, FRAME_INTERVAL_MS);
  }, [phase, disabled, verifying, onCapture, stopCamera]);

  // Camera lifecycle: open on mount, always close on unmount, tab hide, or page unload.
  useEffect(() => {
    unmountedRef.current = false;
    void startCamera();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopCamera();
      }
    };
    window.addEventListener("pagehide", stopCamera);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      unmountedRef.current = true;
      stopCamera();
      window.removeEventListener("pagehide", stopCamera);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startCamera, stopCamera]);

  // Stop camera immediately if verifying state becomes active externally
  useEffect(() => {
    if (verifying) {
      stopCamera();
    }
  }, [verifying, stopCamera]);

  if (camError) {
    return (
      <div className="space-y-3">
        <Alert tone="error">{t(CAMERA_ERROR_KEYS[camError])}</Alert>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void startCamera()}
          >
            <RefreshCw size={14} strokeWidth={2} />
            {t("faceRetry")}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                stopCamera();
                onCancel();
              }}
            >
              <X size={14} strokeWidth={2} />
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  const instruction = t("faceChallengePrompt", {
    action: t(ACTION_KEYS[action] ?? "faceActSmile"),
  });

  const isVerifying = verifying || (phase === "done" && disabled);

  useEffect(() => {
    if (!isVerifying) {
      setStillWorking(false);
      return;
    }
    const timer = setTimeout(() => {
      setStillWorking(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isVerifying]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50/70 px-3 py-2">
        <Camera size={15} strokeWidth={2} className="shrink-0 text-primary-700" />
        <p className="text-xs font-semibold text-primary-900">{instruction}</p>
      </div>

      {isVerifying ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-primary-200 bg-primary-50/60 py-10 text-center"
          role="status"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold text-primary-900">
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700"
            />
            <span>{stillWorking ? "Still working…" : t("faceVerifying")}</span>
          </div>
          <p className="text-[11px] text-ink-500">{t("faceVerifyingHint")}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label={t("faceCameraPreview")}
          className="aspect-[4/3] w-full rounded-md border border-ink-200 bg-ink-950 object-cover -scale-x-100"
        />
      )}

      {phase === "live" && !isVerifying && (
        <div className="flex gap-2">
          <Button
            type="button"
            className="flex-1"
            onClick={capture}
            disabled={disabled || verifying}
          >
            <Camera size={16} strokeWidth={2} />
            {t("faceCapture")}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stopCamera();
                onCancel();
              }}
              disabled={disabled || verifying}
            >
              <X size={16} strokeWidth={2} />
              Cancel
            </Button>
          )}
        </div>
      )}

      {phase === "capturing" && (
        <p className="text-center text-xs font-medium text-ink-500" role="status">
          {t("faceCapturing")}
        </p>
      )}

      {phase === "done" && !isVerifying && (
        <p
          className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-700"
          role="status"
        >
          <CheckCircle2 size={14} strokeWidth={2} />
          {t("faceCaptured")}
        </p>
      )}
    </div>
  );
}
