"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  deleteCloudinaryAsset,
  validateImage,
} from "@/lib/api";

export interface UploadedImage {
  url: string;
  publicId: string;
  score?: number;
}

export function ImageUpload({
  onChange,
}: {
  onChange: (img: UploadedImage | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const configured = Boolean(
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!configured) {
      setNote("Image upload is not configured in this demo — continuing without a photo.");
      return;
    }
    setBusy(true);
    setNote("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const up = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: fd }
      );
      const upJson = await up.json();
      if (!up.ok || !upJson.secure_url) {
        throw new Error(upJson?.error?.message ?? "Upload failed");
      }
      setNote("Validating image…");
      const verdict = await validateImage(upJson.secure_url as string);
      if (!verdict.ok) {
        await deleteCloudinaryAsset(upJson.public_id as string).catch(
          () => undefined
        );
        onChange(null);
        setNote(
          `Image rejected: ${verdict.explanation ?? "not relevant to a public grievance"}. Try another photo.`
        );
        return;
      }
      onChange({
        url: upJson.secure_url as string,
        publicId: upJson.public_id as string,
        score: verdict.llm_score,
      });
      setNote(
        `Image accepted${verdict.llm_score !== undefined ? ` (validation score ${verdict.llm_score})` : ""}.`
      );
    } catch (e) {
      onChange(null);
      setNote(`Upload failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="Photo evidence" hint="Optional. JPG or PNG, max 10 MB.">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="h-auto py-1.5"
        />
      </div>
      {busy && (
        <span className="mt-1 block text-xs text-ink-500">Working…</span>
      )}
      {note && !busy && (
        <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">
          {note}
        </span>
      )}
    </Field>
  );
}
