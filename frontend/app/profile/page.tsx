"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ScanFace, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { FaceCapture } from "@/components/FaceCapture";
import { useDemoUser } from "@/lib/session";
import {
  deleteOwnFaceTemplate,
  enrollFace,
  getFaceStatus,
  getPublicConfig,
  issueFaceChallenge,
  setFaceRequireLogin2fa,
} from "@/lib/api";
import type { FaceChallenge } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const PRIVILEGED_ROLES = ["ADMIN", "SUPERADMIN"];

/**
 * Account settings page. The face card renders only in live mode behind
 * GET /config (faceAuthEnabled) — with the backend flag off (the default)
 * this page shows nothing face-related at all (DEC-024).
 *
 * requireLogin2fa cannot be read back (GET /auth/face/status answers with
 * {enrolled} only), so the toggle starts unchecked on a fresh load and is
 * only authoritative after an enroll or a save in this session.
 */
export default function ProfilePage() {
  const { user, isLoading, liveMode } = useDemoUser();
  const { t } = useI18n();
  const router = useRouter();

  const [faceEnabled, setFaceEnabled] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [require2fa, setRequire2fa] = useState(false);
  const [challenge, setChallenge] = useState<FaceChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const role = user?.role?.toUpperCase() ?? "";
  const isPrivileged = PRIVILEGED_ROLES.includes(role);

  useEffect(() => {
    if (!isLoading && liveMode && !user) {
      router.replace("/login?next=/profile");
    }
  }, [isLoading, liveMode, user, router]);

  useEffect(() => {
    if (!liveMode || !user) return;
    let mounted = true;
    void (async () => {
      const cfg = await getPublicConfig();
      if (!mounted || !cfg.faceAuthEnabled) return;
      setFaceEnabled(true);
      try {
        const status = await getFaceStatus();
        if (mounted) setEnrolled(status.enrolled);
      } catch (e) {
        if (mounted && e instanceof Error) setError(e.message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [liveMode, user]);

  const msg = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  const resetFeedback = () => {
    setError(null);
    setNotice(null);
  };

  async function beginEnroll() {
    resetFeedback();
    if (!enrolled && !consent) {
      setError(t("faceConsentRequired"));
      return;
    }
    setBusy(true);
    try {
      setChallenge(await issueFaceChallenge());
    } catch (e) {
      setError(msg(e, t("faceUnavailable")));
    } finally {
      setBusy(false);
    }
  }

  async function onCaptured(frames: string[]) {
    if (!challenge) return;
    const wasEnrolled = enrolled;
    resetFeedback();
    setBusy(true);
    try {
      await enrollFace({
        challenge_id: challenge.challenge_id,
        frames,
        consent: true,
        require_login_2fa: isPrivileged && require2fa,
      });
      setEnrolled(true);
      setChallenge(null);
      setNotice(
        wasEnrolled ? t("faceReenrolledNotice") : t("faceEnrolledNotice")
      );
      try {
        const status = await getFaceStatus();
        setEnrolled(status.enrolled);
      } catch {
        // non-fatal status refresh fallback
      }
    } catch (e) {
      setError(msg(e, t("faceUnavailable")));
      setChallenge(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFace() {
    if (!window.confirm(t("faceDeleteConfirm"))) return;
    resetFeedback();
    setBusy(true);
    try {
      await deleteOwnFaceTemplate();
      setEnrolled(false);
      setRequire2fa(false);
      setNotice(t("faceDeletedNotice"));
    } catch (e) {
      setError(msg(e, t("faceUnavailable")));
    } finally {
      setBusy(false);
    }
  }

  async function saveRequire2fa() {
    resetFeedback();
    setBusy(true);
    try {
      await setFaceRequireLogin2fa(require2fa);
      setNotice(t("faceSavedNotice"));
    } catch (e) {
      setError(msg(e, t("faceUnavailable")));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || (liveMode && !user)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Spinner label={t("checkingSession")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950">
          {t("profileTitle")}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{t("profileSub")}</p>
      </div>

      <Card>
        <CardHeader title={t("profileTitle")} subtitle={user?.email} />
        <CardBody className="space-y-1 text-sm text-ink-600">
          <p>
            <span className="font-semibold text-ink-900">{user?.name}</span>
          </p>
          <p className="text-xs uppercase tracking-wider text-ink-500">
            {role || "USER"}
          </p>
        </CardBody>
      </Card>

      {!liveMode && (
        <Alert>
          {t("faceDemoNote")}
        </Alert>
      )}

      {liveMode && faceEnabled && user && (
        <Card>
          <CardHeader
            title={t("faceEnrollTitle")}
            subtitle={t("faceEnrollDesc")}
          />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone={enrolled ? "emerald" : "rose"}>
                {enrolled ? t("faceEnrolledBadge") : t("faceNotEnrolledBadge")}
              </Badge>
            </div>

            {notice && <Alert>{notice}</Alert>}
            {error && (
              <div className="space-y-2">
                <Alert tone="error">{error}</Alert>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void beginEnroll()}
                  disabled={busy}
                >
                  <RefreshCw size={14} strokeWidth={2} />
                  {t("faceRetry")}
                </Button>
              </div>
            )}

            {enrolled && <Alert tone="info">{t("faceReenrollHint")}</Alert>}

            {challenge ? (
              <FaceCapture
                key={challenge.challenge_id}
                action={challenge.action}
                onCapture={onCaptured}
                disabled={busy}
                verifying={busy}
                onCancel={() => {
                  setChallenge(null);
                  resetFeedback();
                }}
              />
            ) : (
              <div className="space-y-4">
                {!enrolled && (
                  <label className="flex cursor-pointer select-none items-start gap-2 text-xs font-medium text-ink-700">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 accent-primary-700"
                    />
                    {t("faceConsentLabel")}
                  </label>
                )}

                {isPrivileged && (
                  <div className="rounded-md border border-ink-200 bg-ink-50/60 p-3">
                    <label className="flex cursor-pointer select-none items-start gap-2 text-xs font-medium text-ink-700">
                      <input
                        type="checkbox"
                        checked={require2fa}
                        onChange={(e) => setRequire2fa(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 accent-primary-700"
                      />
                      {t("faceRequire2faLabel")}
                    </label>
                    <p className="mt-1 pl-5.5 text-[11px] text-ink-500">
                      {t("faceRequire2faHint")}
                    </p>
                    {enrolled && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => void saveRequire2fa()}
                        disabled={busy}
                      >
                        {t("faceRequire2faSave")}
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void beginEnroll()}
                    disabled={busy}
                  >
                    <ScanFace size={16} strokeWidth={2} />
                    {enrolled ? t("faceReenrollBtn") : t("faceEnrollBtn")}
                  </Button>
                  {enrolled && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void deleteFace()}
                      disabled={busy}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                      {t("faceDeleteBtn")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
