"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoUser } from "@/lib/session";
import { getCurrentUser } from "@/lib/api";
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
          email: profile.email,
          name: profile.full_name || profile.email.split("@")[0] || "User",
          role: profile.role,
          avatarUrl: profile.avatar_url,
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
