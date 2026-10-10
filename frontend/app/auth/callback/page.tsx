"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoUser } from "@/lib/session";
import { getCurrentUser, setStoredPendingToken } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useDemoUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const err = searchParams.get("error");
      if (err) {
        setError(err);
        setTimeout(() => router.push(`/login?error=${encodeURIComponent(err)}`), 1500);
        return;
      }

      // Privileged Google login paused for the optional face step (DEC-024):
      // stash the pending token (own key, never auto-attached) and let the
      // login page open the 2FA screen. A pending token never becomes a
      // session by itself.
      const twoFactor = searchParams.get("two_factor");
      const pendingToken = searchParams.get("pending_token");
      if (twoFactor === "face" && pendingToken) {
        setStoredPendingToken(pendingToken);
        router.replace("/login?two_factor=face");
        return;
      }

      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token") || undefined;

      if (!accessToken) {
        setError("No authentication token received");
        setTimeout(() => router.push("/login?error=no_token"), 1500);
        return;
      }

      try {
        // Temporarily store token so getCurrentUser can send it
        setAuthSession(
          {
            id: "",
            email: "",
            name: "Loading...",
            role: "USER",
          },
          accessToken,
          refreshToken
        );

        // Fetch user profile from backend
        const profile = await getCurrentUser();
        const authUser = {
          id: profile.id,
          email: profile.email || null,
          phone: profile.phone || null,
          phoneVerifiedAt: profile.phoneVerifiedAt || null,
          phoneVerifiedMethod: profile.phoneVerifiedMethod || null,
          smsConsent: profile.smsConsent === true,
          smsOptOutAt: profile.smsOptOutAt || null,
          citizen_id: profile.citizen_id || null,
          name:
            profile.full_name ||
            (profile.email ? profile.email.split("@")[0] : profile.citizen_id || "User"),
          role: profile.role,
          avatarUrl: profile.avatar_url,
          authMethod: profile.auth_method,
        };

        setAuthSession(authUser, accessToken, refreshToken);

        const role = profile.role.toUpperCase();
        if (role === "ADMIN" || role === "SUPERADMIN") {
          router.push("/admin");
        } else {
          router.push("/submit");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load profile";
        setError(msg);
        setTimeout(() => router.push(`/login?error=${encodeURIComponent(msg)}`), 1500);
      }
    }

    handleCallback();
  }, [router, searchParams, setAuthSession]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      {error ? (
        <div className="text-red-600 dark:text-red-400">
          <p className="font-semibold">Authentication failed</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-xs text-ink-500 mt-2">Redirecting to login...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Completing sign in...
          </p>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
