"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { CaptchaField } from "@/components/ui/Captcha";
import { useDemoUser } from "@/lib/session";
import {
  bindPhone,
  getGoogleAuthUrl,
  requestPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

import type { MessageKey } from "@/lib/i18n";

const GENDERS: { value: string; labelKey: MessageKey }[] = [
  { value: "female", labelKey: "genderFemale" },
  { value: "male", labelKey: "genderMale" },
  { value: "other", labelKey: "genderOther" },
  { value: "prefer_not_to_say", labelKey: "genderPreferNot" },
];

const OCCUPATIONS: { value: string; labelKey: MessageKey }[] = [  { value: "farmer", labelKey: "occupationFarmer" },
  { value: "teacher", labelKey: "occupationTeacher" },
  { value: "student", labelKey: "occupationStudent" },
  { value: "government_employee", labelKey: "occupationGovEmployee" },
  { value: "private_employee", labelKey: "occupationPrivateEmployee" },
  { value: "business_owner", labelKey: "occupationBusinessOwner" },
  { value: "doctor", labelKey: "occupationDoctor" },
  { value: "lawyer", labelKey: "occupationLawyer" },
  { value: "engineer", labelKey: "occupationEngineer" },
  { value: "driver", labelKey: "occupationDriver" },
  { value: "daily_wage", labelKey: "occupationDailyWage" },
  { value: "homemaker", labelKey: "occupationHomemaker" },
  { value: "retired", labelKey: "occupationRetired" },
  { value: "unemployed", labelKey: "occupationUnemployed" },
  { value: "other", labelKey: "occupationOther" },
];

// Signup is 18+ (module scope so render stays pure for the lint rule).
const MAX_DOB = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

export default function RegisterPage() {
  const router = useRouter();
  const { signInDemo, register, liveMode } = useDemoUser();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [occupation, setOccupation] = useState("");
  const [occupationOther, setOccupationOther] = useState("");
  const [gender, setGender] = useState("");
  const [captcha, setCaptcha] = useState<{
    captcha_id: string;
    captcha_solution: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Post-register phone proof: the account exists and the session is live,
  // so the authenticated /phone/* binding flow is used (no extra backend).
  // A verified number is what face login accepts (DEC-025 gate), so this
  // step is what binds the phone "with face login" for later enrollment.
  const [accountReady, setAccountReady] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneDone, setPhoneDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // When "other" is selected, occupationOther must be filled
    const finalOccupation = occupation === "other" ? occupationOther.trim() : occupation;
    if (!name || !email || !password || !address || !dob || !occupation || !gender) {
      setError(t("errFillAll"));
      return;
    }
    if (liveMode && !/^[6-9]\d{9}$/.test(phone)) {
      setError(t("errPhoneInvalid"));
      return;
    }
    if (occupation === "other" && !occupationOther.trim()) {
      setError(t("errFillAll"));
      return;
    }
    if (password.length < 8) {
      setError(t("errPasswordLen"));
      return;
    }
    if (liveMode && (!captcha?.captcha_id || !captcha.captcha_solution)) {
      setError(t("errCaptchaRequired"));
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      if (liveMode) {
        await register(email, password, name, { address, dob, occupation: finalOccupation, gender }, captcha!, phone);
        setAccountReady(true);
      } else {
        signInDemo(email, "citizen", name);
        setSuccessNotice(true);
        setTimeout(() => router.push("/submit"), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errRegisterFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendPhoneCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPhoneOtp(phone);
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errRegisterFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyAndBind(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setError(t("errOtpInvalid"));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyPhoneOtp(phone, otpCode.trim());
      await bindPhone(phone);
      setPhoneDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errRegisterFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = getGoogleAuthUrl();
  }

  function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
    if (pw.length === 0) return 0;
    if (pw.length < 8) return 1;
    const hasLetter = /[a-zA-Z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
    if (hasLetter && hasDigit && hasSpecial) return 3;
    if ((hasLetter && hasDigit) || (hasLetter && hasSpecial) || (hasDigit && hasSpecial)) return 2;
    return 1;
  }

  const pwStrength = passwordStrength(password);
  const pwStrengthLabel =
    pwStrength === 3 ? t("passwordStrengthStrong") :
    pwStrength === 2 ? t("passwordStrengthFair") :
    pwStrength === 1 ? t("passwordStrengthWeak") : "";
  const pwStrengthColor =
    pwStrength === 3 ? "bg-green-500" :
    pwStrength === 2 ? "bg-amber-400" :
    "bg-red-400";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50/40 px-3 py-4 sm:px-6 sm:py-8">
      <div className={`w-full ${accountReady ? "max-w-md" : "max-w-4xl"} rounded-lg border border-ink-200 bg-white p-5 shadow-sm sm:p-8 transition-all duration-200`}>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-ink-100 pb-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="SAMARTH Logo"
                width={40}
                height={40}
                className="h-10 w-10 object-contain shrink-0"
                priority
              />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink-950">
                  {t("createAccount")}
                </h1>
                <p className="mt-0.5 text-xs text-ink-500">
                  {liveMode ? t("regSubLive") : t("regSubDemo")}
                </p>
              </div>
            </div>
            {!accountReady && (
              <div className="hidden sm:block text-xs sm:text-sm text-ink-500">
                {t("alreadyRegistered")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-primary-700 hover:underline"
                >
                  {t("signIn")} →
                </Link>
              </div>
            )}
          </div>

          {accountReady ? (
          <div className="space-y-4">
            {error && (
              <Alert tone="error">{error}</Alert>
            )}
            {!phoneDone ? (
              <>
                <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4">
                  <h2 className="text-sm font-bold text-ink-950">{t("regPhoneTitle")}</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-600">{t("regPhoneText")}</p>
                </div>
                {!codeSent ? (
                  <form onSubmit={sendPhoneCode} className="space-y-4">
                    <Field label={t("mobileLabel")} required hint="+91 · 10-digit Indian mobile number">
                      <div className="flex overflow-hidden rounded-lg border border-ink-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                        <span className="flex items-center border-r border-ink-200 bg-ink-50 px-3 text-sm text-ink-600" aria-hidden="true">+91</span>
                        <Input
                          type="tel"
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
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting || !/^[6-9]\d{9}$/.test(phone)}
                    >
                      {isSubmitting ? t("loading") : t("sendCodeBtn")}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={verifyAndBind} className="space-y-4">
                    <div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        aria-label={t("phoneCodePlaceholder")}
                        placeholder={t("phoneCodePlaceholder")}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        disabled={isSubmitting}
                        required
                        maxLength={6}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting || otpCode.trim().length !== 6}
                    >
                      {isSubmitting ? t("loading") : t("verifyBindBtn")}
                    </Button>
                  </form>
                )}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push("/submit")}
                    disabled={isSubmitting}
                    className="text-xs font-medium text-ink-500 hover:text-ink-800"
                  >
                    {t("skipForNow")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center">
                  <p className="text-sm font-bold text-ink-950">{t("phoneBoundTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-600">{t("faceEnrollPrompt")}</p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => router.push("/submit")}
                >
                  {t("goToCitizenPortal")}
                </Button>
                <Link
                  href="/profile"
                  className="block text-center text-xs font-medium text-primary-700 hover:underline"
                >
                  {t("faceEnrollLink")}
                </Link>
              </>
            )}
          </div>
          ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-start">
              {/* ── Left Column: Personal info ── */}
              <div className="space-y-4">
                <div className="border-b border-ink-100 pb-1.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Personal info
                  </h2>
                </div>

                <Field label={t("nameLabel")} required>
                  <Input
                    placeholder="Asha Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("dobLabel")} required hint={t("ageRequirementHint")}>
                    <Input
                      type="date"
                      value={dob}
                      min="1900-01-01"
                      max={MAX_DOB}
                      onChange={(e) => setDob(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field label={t("genderLabel")} required>
                    <Select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="">{t("selectGender")}</option>
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {t(g.labelKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label={t("occupationLabel")} required>
                  <Select
                    value={occupation}
                    onChange={(e) => {
                      setOccupation(e.target.value);
                      setOccupationOther("");
                    }}
                    disabled={isSubmitting}
                  >
                    <option value="">{t("occupationSelectPlaceholder")}</option>
                    {OCCUPATIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </Select>
                  {occupation === "other" && (
                    <Input
                      className="mt-2"
                      placeholder={t("occupationOtherPlaceholder")}
                      value={occupationOther}
                      onChange={(e) => setOccupationOther(e.target.value)}
                      disabled={isSubmitting}
                      maxLength={100}
                    />
                  )}
                </Field>
              </div>

              {/* ── Right Column: Account & contact ── */}
              <div className="space-y-4">
                <div className="border-b border-ink-100 pb-1.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Account &amp; contact
                  </h2>
                </div>

                <Field label={t("emailLabel")} required>
                  <Input
                    type="email"
                    placeholder="you@example.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </Field>

                <Field label={t("passwordLabel")} required>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      style={{ paddingRight: "2.75rem" }}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-ink-400 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700/50"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <div className="mt-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                              pwStrength >= level ? pwStrengthColor : "bg-ink-100"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="mt-1 block text-[11px] text-ink-500">
                        {pwStrengthLabel} &mdash; at least 8 characters
                      </span>
                    </div>
                  )}
                </Field>

                <Field label={t("addressLabel")} required>
                  <Textarea
                    rows={2}
                    placeholder={t("addressPlaceholder")}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isSubmitting}
                  />
                </Field>

                <Field label={t("mobileLabel")} required hint="+91 · 10-digit Indian mobile number">
                  <div className="flex overflow-hidden rounded-lg border border-ink-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                    <span className="flex items-center border-r border-ink-200 bg-ink-50 px-3 text-sm text-ink-600" aria-hidden="true">+91</span>
                    <Input
                      type="tel"
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

                {liveMode && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-ink-500">{t("captchaHint")}</p>
                    <CaptchaField onChange={setCaptcha} disabled={isSubmitting} />
                  </div>
                )}
              </div>
            </div>

            {/* Error & Success notices */}
            {error && (
              <Alert tone="error">{error}</Alert>
            )}

            {successNotice && (
              <Alert tone="info">{t("accountCreatedNotice")}</Alert>
            )}

            {/* Actions: Submit Button & Google Sign Up side-by-side */}
            <div className="pt-3 border-t border-ink-100">
              <div className={`grid gap-3 ${liveMode ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting || successNotice}
                >
                  {isSubmitting ? t("btnCreating") : t("btnCreateAccount")}
                </Button>

                {liveMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleGoogleLogin}
                    disabled={isSubmitting}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    {t("googleSignUp")}
                  </Button>
                )}
              </div>

              {/* Mobile-only fallback link */}
              <div className="mt-4 sm:hidden text-center text-xs text-ink-500">
                {t("alreadyRegistered")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-primary-700 hover:underline"
                >
                  {t("signIn")} →
                </Link>
              </div>
            </div>
          </form>
          )}
        </div>
    </div>
  );
}

