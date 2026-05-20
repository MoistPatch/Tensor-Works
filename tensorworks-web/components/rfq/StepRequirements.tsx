"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { RFQFull } from "@/lib/validations/rfq";
import {
  budgetBracketLabels,
  timelineLabels,
  procurementConstraintLabels,
} from "@/lib/validations/rfq";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface StepRequirementsProps {
  form: UseFormReturn<RFQFull>;
  onNext: () => void;
  onBack: () => void;
}

export function StepRequirements({ form, onNext, onBack }: StepRequirementsProps) {
  const constraints = form.watch("procurementConstraints") ?? [];

  function toggleConstraint(value: string) {
    const current = form.getValues("procurementConstraints") ?? [];
    if (current.includes(value as never)) {
      form.setValue(
        "procurementConstraints",
        current.filter((c) => c !== value) as never
      );
    } else {
      form.setValue("procurementConstraints", [...current, value] as never);
    }
  }

  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="useCase"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What are you trying to do? *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe your workload: model sizes, training vs inference, data volumes, performance requirements, and any constraints we should know about."
                rows={5}
                {...field}
              />
            </FormControl>
            <FormDescription>
              The more context you provide, the more accurate our proposal will be.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="specifications"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Technical specifications</FormLabel>
            <FormControl>
              <Textarea
                placeholder="GPU count, memory requirements, storage I/O, network fabric, rack constraints, power availability — any specs you have."
                rows={4}
                {...field}
              />
            </FormControl>
            <FormDescription>Optional — if you have existing specs or a preferred configuration.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField
          control={form.control}
          name="budgetBracket"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Budget range *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a range" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(budgetBracketLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timeline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Procurement timeline *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a timeline" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(timelineLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div>
        <Label className="text-sm font-medium text-[var(--tw-dark)] mb-3 block">
          Procurement constraints
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(procurementConstraintLabels).map(([value, label]) => (
            <div key={value} className="flex items-center gap-2.5">
              <Checkbox
                id={`constraint-${value}`}
                checked={constraints.includes(value as never)}
                onCheckedChange={() => toggleConstraint(value)}
              />
              <Label
                htmlFor={`constraint-${value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button type="button" onClick={onNext} size="lg">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
