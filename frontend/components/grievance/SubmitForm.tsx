"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AnalysisPanel } from "./GrievanceCard";
import { ImageUpload } from "./ImageUpload";
import { LocationCapture, type Coords } from "./LocationCapture";
import { IntakeModeToggle, VoiceIntake, useVoiceIntake } from "./VoiceIntake";
import type { UploadedImage } from "./ImageUpload";
import { submitGrievance } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import type { SubmitResult } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/ToastProvider";

const makeSchema = (t: ReturnType<typeof useI18n>["t"]) =>
  z.object({
    title: z.string().min(5, t("errTitleShort")),
    description: z.string().min(20, t("errDescShort")),
  });

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export function SubmitForm() {
  const { user } = useDemoUser();
  const { notify } = useToast();
  const { t } = useI18n();
  const schema = useMemo(() => makeSchema(t), [t]);
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Bring the confirmation into view — users missed it below the fold.
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const currentTitle = useWatch({ control, name: "title" });
  const currentDescription = useWatch({ control, name: "description" });
  const [mode, setMode] = useState<"voice" | "manual">("manual");
  const [locationSuggestion, setLocationSuggestion] = useState<{ text: string; token: number } | null>(null);
  const [intakeReady, setIntakeReady] = useState(false);
  // Photo step at the end of the voice conversation: optional but explicit.
  const [photoSkipped, setPhotoSkipped] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLElement>(null);
  const submitLock = useRef(false);
  // The intake session lives here (not in the panel) so switching between
  // voice and manual entry preserves both the draft and the conversation.
  const intake = useVoiceIntake({
    disabled: submitting,
    getValues: () => ({ title: getValues("title") ?? "", description: getValues("description") ?? "" }),
    getDirty: () => ({ title: Boolean(dirtyFields.title), description: Boolean(dirtyFields.description) }),
    hasCoords: () => coords !== null,
    applyField: (field, value) => setValue(field, value, { shouldValidate: true }),
    onLocationSuggestion: (text) => setLocationSuggestion((previous) => ({ text, token: (previous?.token ?? 0) + 1 })),
    onReadyChange: setIntakeReady,
  });

  // The photo step appears when the conversation ends. Browsers cannot open a
  // file picker without a tap, so bring the step into view and let the citizen
  // choose "Add photo" themselves (DEC-039).
  useEffect(() => {
    if (!intakeReady || mode !== "voice") return;
    photoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [intakeReady, mode]);

  // A new conversation starts from zero, so the photo choice resets with it.
  useEffect(() => {
    if (intakeReady) return undefined;
    const handle = window.setTimeout(() => setPhotoSkipped(false), 0);
    return () => window.clearTimeout(handle);
  }, [intakeReady]);

  async function onSubmit(values: FormValues) {
    // Repeated clicks/retries must never create two grievances (DEC-038).
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      setError(null);
      setResult(null);
      if (!coords) {
        setError(t("errLocationRequired"));
        return;
      }
      setSubmitting(true);
      try {
        const res = await submitGrievance({
          title: values.title,
          description: values.description,
          userId: user?.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...(coords.address ? { address: coords.address } : {}),
          ...(image?.url ? { imageUrl: image.url } : {}),
        });
        setResult(res);
        notify("Grievance registered", `Reference ID ${res.grievanceId}. Updates will appear in Notifications and Track Status.`);
        reset();
        setImage(null);
        setPhotoSkipped(false);
        setPhotoBusy(false);
        setCoords(null);
        setLocationSuggestion(null);
        intake.reset();
      } catch (e) {
        const text = e instanceof Error ? e.message : t("errSubmitFailed");
        setError(text);
        notify("Could not submit grievance", text, "error");
      } finally {
        setSubmitting(false);
      }
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-ink-200/80 shadow-xs">
        <CardHeader
          title={t("complaintDetails")}
          subtitle={t("formSubtitle")}
        />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(onSubmit)(e);
            }}
            className="space-y-5"
          >
            <IntakeModeToggle value={mode} onChange={setMode} disabled={submitting} />
            {mode === "voice" ? (
              <>
                <VoiceIntake intake={intake} disabled={submitting} onSwitchManual={() => setMode("manual")} />
                {intakeReady && (
                  <section className="space-y-5 border-t border-ink-100 pt-5">
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">{t("intakeReviewTitle")}</h3>
                      <p className="text-xs leading-5 text-ink-500">{t("intakeReviewHint")}</p>
                    </div>
                    <Field label={t("formTitleLabel")} required error={errors.title?.message}>
                      <span className="block rounded-md border border-ink-100 bg-ink-50 px-3.5 py-2 text-sm text-ink-900">
                        {currentTitle || "—"}
                      </span>
                      <input type="hidden" {...register("title")} />
                      <AiSuggestionBadge visible={intake.ai.title && !dirtyFields.title} />
                    </Field>
                    <Field label={t("formDescLabel")} required error={errors.description?.message}>
                      <span className="block whitespace-pre-wrap rounded-md border border-ink-100 bg-ink-50 px-3.5 py-2 text-sm text-ink-900">
                        {currentDescription || "—"}
                      </span>
                      <input type="hidden" {...register("description")} />
                      <AiSuggestionBadge visible={intake.ai.description && !dirtyFields.description} />
                    </Field>
                    <p className="text-xs leading-5 text-ink-500">{t("intakeClassificationNote")}</p>
                    <div className="pt-2 border-t border-ink-100">
                      <LocationCapture onChange={setCoords} suggestedSearch={locationSuggestion} />
                    </div>
                    <section
                      ref={photoRef}
                      aria-labelledby="intake-photo-title"
                      className={`space-y-3 rounded-md border p-3 transition ${
                        !photoSkipped && !image
                          ? "border-orange-200 bg-orange-50/40 ring-1 ring-orange-200"
                          : "border-ink-100 bg-white"
                      }`}
                    >
                      <div>
                        <h3 id="intake-photo-title" className="text-sm font-semibold text-ink-900">
                          {t("intakePhotoTitle")}
                        </h3>
                        <p className="text-xs leading-5 text-ink-500">{t("intakePhotoHint")}</p>
                      </div>
                      {photoSkipped ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-ink-500">{t("intakePhotoSkipped")}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPhotoSkipped(false)}
                            disabled={submitting}
                          >
                            {t("intakePhotoAdd")}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <ImageUpload onChange={setImage} onBusyChange={setPhotoBusy} />
                          {image ? (
                            <p className="text-xs font-medium text-emerald-700">{t("intakePhotoAdded")}</p>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPhotoSkipped(true)}
                              disabled={submitting || photoBusy}
                            >
                              {t("intakePhotoSkip")}
                            </Button>
                          )}
                        </>
                      )}
                    </section>
                    {error && <Alert tone="error">{error}</Alert>}
                    <div className="pt-3 border-t border-ink-100 flex items-center justify-end">
                      <Button type="submit" size="lg" disabled={submitting || photoBusy} className="w-full sm:w-auto min-w-40">
                        {submitting ? t("btnSubmitting") : t("submit")}
                      </Button>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
                <Field label={t("formTitleLabel")} required error={errors.title?.message}>
                  <Input
                    placeholder={t("formTitlePlaceholder")}
                    {...register("title")}
                  />
                </Field>
                <Field
                  label={t("formDescLabel")}
                  required
                  error={errors.description?.message}
                >
                  <Textarea
                    rows={4}
                    placeholder={t("formDescPlaceholder")}
                    {...register("description")}
                  />
                </Field>
                <div className="pt-2 border-t border-ink-100 grid gap-5 sm:grid-cols-2">
                  <ImageUpload onChange={setImage} />
                  <LocationCapture onChange={setCoords} suggestedSearch={locationSuggestion} />
                </div>
                {error && <Alert tone="error">{error}</Alert>}
                <div className="pt-3 border-t border-ink-100 flex items-center justify-end">
                  <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto min-w-40">
                    {submitting ? t("btnSubmitting") : t("submit")}
                  </Button>
                </div>
              </>
            )}
          </form>
        </CardBody>
      </Card>

      {result && (
        <div ref={resultRef} className="scroll-mt-20">
        <Card className="border-emerald-200/80 bg-white shadow-sm">
          <CardHeader
            title={t("resultTitle")}
            subtitle={t("resultSubtitle")}
          />
          <CardBody className="space-y-4">
            <div className="rounded-md bg-ink-900 px-4 py-3 dark:bg-white">
              <p className="text-xs uppercase tracking-wider text-ink-400 dark:text-ink-500">
                {t("refIdLabel")}
              </p>
              <p className="font-mono text-lg font-bold text-white dark:text-ink-900">
                {result.grievanceId}
              </p>
            </div>
            <Alert tone="info">{result.message}</Alert>
            <AnalysisPanel hfEngine={result.hfEngine} />
          </CardBody>
        </Card>
        </div>
      )}
    </div>
  );
}

/** Marks a draft field that the assistant filled and the citizen has not edited. */
function AiSuggestionBadge({ visible }: { visible: boolean }) {
  const { t } = useI18n();
  if (!visible) return null;
  return (
    <span className="mt-1 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
      {t("intakeSuggestedBadge")}
    </span>
  );
}
