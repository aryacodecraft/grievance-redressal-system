"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

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
  const [coords, setCoords] = useState<Coords | null>(null);

  function capture() {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(next);
        onChange(next);
        setState("done");
      },
      () => {
        setCoords(null);
        onChange(null);
        setState("denied");
      }
    );
  }

  return (
    <Field
      label="Incident location"
      required
      hint="Pin where the issue happened, not necessarily where you are now. Your coordinates help the right team find it faster."
    >
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant={state === "done" ? "outline" : "secondary"}
          size="md"
          onClick={capture}
          disabled={state === "busy"}
          className="h-10 w-full justify-start text-xs font-medium"
        >
          {state === "busy" && "Acquiring GPS coordinates…"}
          {state === "idle" && "Pin My Current Location"}
          {state === "done" && "✓ Location Verified & Pinned"}
          {state === "denied" && "Retry Location"}
        </Button>
        {state === "done" && (
          <span className="text-[11px] font-medium text-emerald-600">
            Location pinned: {coords?.latitude.toFixed(5)}, {coords?.longitude.toFixed(5)}
          </span>
        )}
        {state === "denied" && (
          <span className="text-[11px] text-rose-500">
            Permission denied — allow location access in your browser.
          </span>
        )}
      </div>
    </Field>
  );
}
