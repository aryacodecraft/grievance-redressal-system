"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export interface Coords {
  latitude: number;
  longitude: number;
}

export function LocationCapture({
  onChange,
}: {
  onChange: (coords: Coords | null) => void;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "denied">(
    "idle"
  );

  function capture() {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setState("done");
      },
      () => {
        onChange(null);
        setState("denied");
      }
    );
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink-800 dark:text-ink-200">
        Location <span className="text-primary-600">*</span>
      </span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={capture}
          disabled={state === "busy"}
        >
          {state === "busy" ? "Locating…" : "Use my location"}
        </Button>
        {state === "done" && (
          <span className="text-xs font-medium text-ink-700 dark:text-ink-300">
            Location captured
          </span>
        )}
        {state === "denied" && (
          <span className="text-xs text-ink-500">
            Location unavailable — allow access in your browser to continue.
          </span>
        )}
      </div>
    </div>
  );
}
