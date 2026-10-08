"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  deleteCloudinaryAsset,
  validateImage,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const configured = Boolean(
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.type)) {
      setNote(t("imgBadType"));
      onChange(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNote(t("imgTooBig"));
      onChange(null);
      return;
    }
    if (!configured) {
      setNote(t("imgNotConfigured"));
      return;
    }
    setBusy(true);
    setNote(t("imgUploading"));
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
      setNote(t("imgValidating"));
      const verdict = await validateImage(upJson.secure_url as string);
      if (!verdict.ok) {
        await deleteCloudinaryAsset(upJson.public_id as string).catch(
          () => undefined
        );
        onChange(null);
        setNote(
          t("imgRejected", {
            reason: verdict.explanation ?? t("imgRejectedDefault"),
          })
        );
        return;
      }
      onChange({
        url: upJson.secure_url as string,
        publicId: upJson.public_id as string,
        score: verdict.llm_score,
      });
      setNote(
        verdict.llm_score !== undefined
          ? t("imgAcceptedScore", { score: verdict.llm_score })
          : t("imgAccepted")
      );
    } catch (e) {
      onChange(null);
      setNote(
        e instanceof Error
          ? t("imgUploadFailed", { message: e.message })
          : t("imgUploadUnknown")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={t("imgLabel")} hint={t("imgHint")}>
      <div className="flex flex-col gap-1.5">
        <Input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="h-auto py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink-800 hover:file:bg-ink-200 cursor-pointer"
        />
      </div>
      {busy && (
        <span className="mt-1.5 block text-xs font-medium text-primary-600">{t("imgProcessing")}</span>
      )}
      {note && !busy && (
        <span className="mt-1.5 block text-xs text-ink-500">
          {note}
        </span>
      )}
    </Field>
  );
}
