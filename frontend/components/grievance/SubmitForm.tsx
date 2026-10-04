"use client";

import { useEffect, useRef, useState } from "react";
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

const schema = z.object({
  title: z.string().min(5, "Give a short, specific title (min 5 characters)."),
  description: z
    .string()
    .min(20, "Describe the issue in at least 20 characters."),
  categoryHint: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SubmitForm() {
  const { user } = useDemoUser();
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
      setError("Location is mandatory — click “Use my location”.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitGrievance({
        title: values.title,
        description: values.description,
        userId: user?.id ?? "demo-user",
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
        e instanceof Error
          ? e.message
          : "Submission failed. Is the backend running?"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-ink-200/80 shadow-xs">
        <CardHeader
          title="Complaint Details"
          subtitle="Fields marked * are mandatory. The AI classifier automatically infers or validates the department."
        />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(onSubmit)(e);
            }}
            className="space-y-5"
          >
            <Field label="Subject / Short Title" required error={errors.title?.message}>
              <Input
                placeholder="e.g. Broken water pipeline causing waterlogging near Sector 12"
                {...register("title")}
              />
            </Field>
            <Field
              label="Detailed Description"
              required
              error={errors.description?.message}
            >
              <Textarea
                rows={4}
                placeholder="Describe what occurred, specific street or landmark, duration of the issue, and impact on residents..."
                {...register("description")}
              />
            </Field>
            <Field
              label="Intended Department (Optional)"
              hint="Suggested hint. The AI model will verify and determine canonical routing."
            >
              <Select {...register("categoryHint")} defaultValue="">
                <option value="">Let system auto-classify</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
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
                {submitting ? "Submitting & Classifying…" : "Submit Grievance"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {result && (
        <div ref={resultRef} className="scroll-mt-20">
        <Card className="border-emerald-200/80 bg-white shadow-sm">
          <CardHeader
            title="Grievance Successfully Registered"
            subtitle="Save this reference ID to track your complaint."
          />
          <CardBody className="space-y-4">
            <div className="rounded-md bg-ink-900 px-4 py-3 dark:bg-white">
              <p className="text-xs uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Reference Ticket ID
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
