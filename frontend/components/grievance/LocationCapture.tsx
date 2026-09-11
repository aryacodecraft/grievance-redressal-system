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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-700">
        Geo-Location <span className="text-primary-600">*</span>
      </span>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant={state === "done" ? "outline" : "secondary"}
          size="md"
          onClick={capture}
          disabled={state === "busy"}
          className="w-full justify-start text-xs font-medium"
        >
          {state === "busy" && "Acquiring GPS coordinates…"}
          {state === "idle" && "Pin My Current Location"}
          {state === "done" && "✓ Location Verified & Pinned"}
          {state === "denied" && "Retry Location"}
        </Button>
        {state === "done" && (
          <span className="text-[11px] font-medium text-emerald-600">
            Coordinates captured accurately
          </span>
        )}
        {state === "denied" && (
          <span className="text-[11px] text-rose-500">
            Permission denied — allow location access in your browser.
          </span>
        )}
      </div>
    </div>
  );
}
