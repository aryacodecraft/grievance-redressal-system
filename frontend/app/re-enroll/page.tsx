"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, ScanFace, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { FaceCapture } from "@/components/FaceCapture";
import { useDemoUser } from "@/lib/session";
import { issueFaceChallenge, reEnrollFace } from "@/lib/api";
import type { FaceChallenge } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function ReEnrollPage() {
  const router = useRouter();
  const { applyAuthResponse } = useDemoUser();
  const { t } = useI18n();

  const [token, setToken] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<FaceChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function startCapture() {
    if (!token.trim() || !identifier.trim()) {
      setError(t("errEnterCreds"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const ch = await issueFaceChallenge();
      setChallenge(ch);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("faceUnavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function onFramesCaptured(frames: string[]) {
    if (!challenge) return;
    setError(null);
    setBusy(true);
    try {
      const res = await reEnrollFace({
        token: token.trim(),
        identifier: identifier.trim(),
        challenge_id: challenge.challenge_id,
        frames,
      });
      applyAuthResponse(res);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("faceUnavailable"));
      setChallenge(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50/40 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft size={14} />
          {t("backToSignIn")}
        </Link>

        <div className="mt-4 mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 ring-1 ring-primary-200">
            <KeyRound size={12} strokeWidth={2} />
            Recovery
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-950">
            {t("faceReenrollTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{t("faceReenrollSub")}</p>
        </div>

        {error && (
          <div className="mb-5">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {success ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-semibold text-ink-950">{t("reEnrollSuccess")}</p>
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push("/profile")}
            >
              {t("goToCitizenPortal")}
            </Button>
          </div>
        ) : challenge ? (
          <FaceCapture
            key={challenge.challenge_id}
            action={challenge.action}
            onCapture={onFramesCaptured}
            disabled={busy}
            verifying={busy}
            onCancel={() => {
              setChallenge(null);
              setError(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            <Field label={t("reenrollTokenLabel")} required>
              <textarea
                name="token"
                rows={3}
                placeholder={t("reenrollTokenPlaceholder")}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-ink-200 p-2 font-mono text-xs text-ink-900 focus:border-primary-500 focus:outline-none"
              />
            </Field>

            <Field label={t("faceIdentifierLabel")} required>
              <Input
                type="text"
                name="identifier"
                placeholder={t("faceIdentifierPlaceholder")}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => void startCapture()}
              disabled={busy}
            >
              <ScanFace size={16} strokeWidth={2} />
              {busy ? t("loading") : t("reEnrollBtn")}
            </Button>

            <p className="text-xs text-ink-500">{t("faceOfficeResetNotice")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
