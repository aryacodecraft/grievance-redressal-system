"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { useI18n, type MessageKey } from "@/lib/i18n";

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
const FRAME_INTERVAL_MS = 330; // 6 frames over ~1.7 s
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;
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
}: {
  /** Challenge action the captured frames must perform (e.g. "turn_left"). */
  action: string;
  onCapture: (frames: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [camError, setCamError] = useState<CamError | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
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
      if (unmountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
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
      if (unmountedRef.current) return;
      const name = err instanceof DOMException ? err.name : "";
      if (err instanceof Error && err.message === "timeout") setCamError("timeout");
      else if (name === "NotAllowedError" || name === "SecurityError") setCamError("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setCamError("missing");
      else setCamError("unknown");
    }
  }, [stopCamera]);

  const capture = useCallback(() => {
    if (phase !== "live" || disabled) return;
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
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      frames.push(dataUrl.slice(dataUrl.indexOf(",") + 1));
      if (frames.length >= FRAME_COUNT) {
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPhase("done");
        onCapture(frames);
      }
    }, FRAME_INTERVAL_MS);
  }, [phase, disabled, onCapture]);

  // Camera lifecycle: open on mount, always close on unmount. Starting the
  // stream is an external-system sync, so the initial phase setState here is
  // intentional (same pattern as SuperadminWorkspace's load effect).
  useEffect(() => {
    unmountedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera();
    return () => {
      unmountedRef.current = true;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  if (camError) {
    return (
      <div className="space-y-3">
        <Alert tone="error">{t(CAMERA_ERROR_KEYS[camError])}</Alert>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void startCamera()}
        >
          <RefreshCw size={14} strokeWidth={2} />
          {t("faceRetry")}
        </Button>
      </div>
    );
  }

  const instruction = t("faceChallengePrompt", {
    action: t(ACTION_KEYS[action] ?? "faceActSmile"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50/70 px-3 py-2">
        <Camera size={15} strokeWidth={2} className="shrink-0 text-primary-700" />
        <p className="text-xs font-semibold text-primary-900">{instruction}</p>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label={t("faceCameraPreview")}
        className="aspect-[4/3] w-full rounded-md border border-ink-200 bg-ink-950 object-cover"
      />
      {phase === "live" && (
        <Button
          type="button"
          className="w-full"
          onClick={capture}
          disabled={disabled}
        >
          <Camera size={16} strokeWidth={2} />
          {t("faceCapture")}
        </Button>
      )}
      {phase === "capturing" && (
        <p className="text-center text-xs font-medium text-ink-500" role="status">
          {t("faceCapturing")}
        </p>
      )}
      {phase === "done" && (
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
