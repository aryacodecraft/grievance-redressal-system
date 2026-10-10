"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, ScanFace, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { FaceCapture } from "@/components/FaceCapture";
import { useDemoUser } from "@/lib/session";
import { getPublicConfig, startFaceSignup, completeFaceSignup } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function FaceSignupPage() {
  const router = useRouter();
  const { applyAuthResponse } = useDemoUser();
  const { t } = useI18n();

  const [faceEnabled, setFaceEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<"form" | "capture" | "success">("form");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Challenge from /start
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeAction, setChallengeAction] = useState<string | null>(null);

  // Success result
  const [citizenId, setCitizenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getPublicConfig().then((cfg) => {
      setFaceEnabled(cfg.faceAuthEnabled);
    });
  }, []);

  if (faceEnabled === false) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50/40 px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-ink-600">{t("faceUnavailable")}</p>
          <div className="mt-4">
            <Link href="/login" className="text-xs font-semibold text-primary-700 hover:underline">
              {t("backToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleStartSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError(t("faceConsentRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await startFaceSignup({
        full_name: fullName.trim(),
        phone: phone,
        consent: true,
        sms_consent: smsConsent,
      });
      setSignupToken(res.signup_token);
      setChallengeId(res.challenge_id);
      setChallengeAction(res.action);
      setStep("capture");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("faceUnavailable");
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCaptureFrames(frames: string[]) {
    if (!signupToken || !challengeId) {
      setError(t("faceUnavailable"));
      setStep("form");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await completeFaceSignup({
        signup_token: signupToken,
        challenge_id: challengeId,
        frames,
      });
      applyAuthResponse(res);
      setCitizenId(res.citizen_id);
      setStep("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("faceUnavailable");
      setError(msg);
      // Give user the ability to retry with fresh /start
      setSignupToken(null);
      setChallengeId(null);
      setChallengeAction(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setError(null);
    setSignupToken(null);
    setChallengeId(null);
    setChallengeAction(null);
    setStep("form");
  }

  async function copyToClipboard() {
    if (!citizenId) return;
    try {
      await navigator.clipboard.writeText(citizenId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback */
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50/40 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 ring-1 ring-primary-200">
            <ShieldCheck size={12} strokeWidth={2} />
            {t("securePortal")}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-950">
            {step === "success" ? t("signupSuccessTitle") : t("faceSignupTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {step === "success" ? t("signupSuccessSub") : t("faceSignupSub")}
          </p>
        </div>

        {error && (
          <div className="mb-5 space-y-3">
            <Alert tone="error">{error}</Alert>
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              {t("tryAgain")}
            </Button>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleStartSignup} className="space-y-4">
            <Field label={t("fullNameLabel")} required>
              <Input
                type="text"
                name="full_name"
                placeholder="Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </Field>

            <Field label={t("mobileLabel")} required hint="+91 · 10-digit Indian mobile number">
              <div className="flex overflow-hidden rounded-lg border border-ink-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                <span className="flex items-center border-r border-ink-200 bg-ink-50 px-3 text-sm text-ink-600" aria-hidden="true">+91</span>
                <Input
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  disabled={isSubmitting}
                  required
                  className="rounded-none border-0 focus:ring-0"
                />
              </div>
            </Field>

            <div className="pt-1">
              <label className="flex items-start gap-2.5 text-xs text-ink-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
                />
                <span>{t("faceConsentText")}</span>
              </label>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-ink-600 cursor-pointer">
              <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} disabled={isSubmitting} className="mt-0.5 h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500" />
              <span>{t("smsConsentLabel")}</span>
            </label>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting || !fullName.trim() || !/^[6-9]\d{9}$/.test(phone) || !consent}
            >
              <ScanFace size={16} strokeWidth={2} />
              {isSubmitting ? t("loading") : t("faceStart")}
            </Button>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-xs font-medium text-ink-500 hover:text-ink-800"
              >
                {t("backToSignIn")}
              </Link>
            </div>
          </form>
        )}

        {step === "capture" && challengeAction && !error && (
          <div className="space-y-4">
            <p className="text-xs text-ink-500">{t("faceCaptureStep")}</p>
            <FaceCapture
              action={challengeAction}
              onCapture={handleCaptureFrames}
              disabled={isSubmitting}
              verifying={isSubmitting}
              onCancel={handleReset}
            />
          </div>
        )}

        {step === "success" && citizenId && (
          <div className="space-y-6">
            <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                {t("yourCitizenId")}
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold tracking-wider text-ink-950">
                {citizenId}
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyToClipboard()}
                  className="gap-2 bg-white"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? t("copied") : t("copyCitizenId")}
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-ink-600">
              {t("citizenIdSaveHint")}
            </p>

            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => router.push("/")}
            >
              {t("goToCitizenPortal")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
