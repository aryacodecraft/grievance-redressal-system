"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AnalysisPanel } from "./GrievanceCard";
import { ImageUpload } from "./ImageUpload";
import { LocationCapture, type Coords } from "./LocationCapture";
import type { UploadedImage } from "./ImageUpload";
import { submitGrievance } from "@/lib/api";
import { useDemoUser } from "@/lib/session";
import { CATEGORIES, type SubmitResult } from "@/lib/types";
import { departmentKey, useI18n } from "@/lib/i18n";

const makeSchema = (t: ReturnType<typeof useI18n>["t"]) =>
  z.object({
    title: z.string().min(5, t("errTitleShort")),
    description: z.string().min(20, t("errDescShort")),
    categoryHint: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export function SubmitForm() {
  const { user } = useDemoUser();
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
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
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
        ...(image?.url ? { imageUrl: image.url } : {}),
      });
      setResult(res);
      reset();
      setImage(null);
      setCoords(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("errSubmitFailed")
      );
    } finally {
      setSubmitting(false);
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
            <Field
              label={t("formDeptLabel")}
              hint={t("formDeptHint")}
            >
              <Select {...register("categoryHint")} defaultValue="">
                <option value="">{t("formAutoClassify")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(departmentKey(c))}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="pt-2 border-t border-ink-100 grid gap-5 sm:grid-cols-2">
              <ImageUpload onChange={setImage} />
              <LocationCapture onChange={setCoords} />
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="pt-3 border-t border-ink-100 flex items-center justify-end">
              <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto min-w-40">
                {submitting ? t("btnSubmitting") : t("submit")}
              </Button>
            </div>
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
