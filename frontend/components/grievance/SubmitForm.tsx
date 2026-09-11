"use client";

import { useState } from "react";
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
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Submit your grievance"
          subtitle="Fields marked * are required. Category is suggested — AI confirms it on submit."
        />
        <CardBody>
          <form onSubmit={void handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Title" required error={errors.title?.message}>
              <Input
                placeholder="e.g. Potholes on MG Road near bus stand"
                {...register("title")}
              />
            </Field>
            <Field
              label="Description"
              required
              error={errors.description?.message}
            >
              <Textarea
                rows={4}
                placeholder="What is the issue, where exactly, since when, and who is affected?"
                {...register("description")}
              />
            </Field>
            <Field
              label="Likely department"
              hint="A hint only — the system re-classifies on submit."
            >
              <Select {...register("categoryHint")} defaultValue="">
                <option value="">Let the system decide</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <ImageUpload onChange={setImage} />
            <LocationCapture onChange={setCoords} />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Submitting & classifying…" : "Submit grievance"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardHeader
            title="Grievance registered"
            subtitle={`Reference ID: ${result.grievanceId}`}
          />
          <CardBody className="space-y-3">
            <Alert>{result.message}</Alert>
            <AnalysisPanel hfEngine={result.hfEngine} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
