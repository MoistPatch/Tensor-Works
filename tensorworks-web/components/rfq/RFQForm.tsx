"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Form } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormProgress } from "./FormProgress";
import { StepCompany } from "./StepCompany";
import { StepRequirements } from "./StepRequirements";
import { StepSubmit } from "./StepSubmit";
import {
  rfqFullSchema,
  rfqStep1Schema,
  rfqStep2Schema,
  type RFQFull,
} from "@/lib/validations/rfq";
import { AlertCircle } from "lucide-react";

const STEPS = ["Your details", "Requirements", "Submit"];

export function RFQForm() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<RFQFull>({
    resolver: zodResolver(rfqFullSchema) as any,
    defaultValues: {
      companyName: "",
      abn: "",
      contactName: "",
      role: "",
      email: "",
      phone: "",
      organisationType: undefined,
      useCase: "",
      budgetBracket: undefined,
      timeline: undefined,
      specifications: "",
      procurementConstraints: [],
      referralSource: "",
      turnstileToken: "",
    },
    mode: "onTouched",
  });

  async function validateStep(stepNum: number): Promise<boolean> {
    const schema = stepNum === 1 ? rfqStep1Schema : rfqStep2Schema;
    const values = form.getValues();
    const result = schema.safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".") as keyof RFQFull;
        form.setError(path, { message: issue.message });
      });
      return false;
    }
    return true;
  }

  async function handleNext() {
    const valid = await validateStep(step);
    if (valid) setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
    setSubmitError(null);
  }

  async function onSubmit(data: RFQFull) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(
          result.error ?? "An error occurred. Please try again or contact us directly."
        );
        return;
      }

      router.push("/thank-you");
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Form {...(form as any)}>
      <form onSubmit={(form as any).handleSubmit(onSubmit)} noValidate>
        <FormProgress currentStep={step} totalSteps={3} steps={STEPS} />

        {submitError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {step === 1 && <StepCompany form={form as any} onNext={handleNext} />}
        {step === 2 && (
          <StepRequirements form={form as any} onNext={handleNext} onBack={handleBack} />
        )}
        {step === 3 && (
          <StepSubmit form={form as any} onBack={handleBack} isSubmitting={isSubmitting} />
        )}
      </form>
    </Form>
  );
}
