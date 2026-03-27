"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sampleFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  favoriteMovie: z
    .string()
    .min(2, "Favorite movie must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
});

type SampleFormValues = z.infer<typeof sampleFormSchema>;

const defaultValues: SampleFormValues = {
  displayName: "",
  favoriteMovie: "",
  email: "",
};

export function SampleRhfZodForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SampleFormValues>({
    resolver: zodResolver(sampleFormSchema),
    defaultValues,
  });

  const onSubmit = async (values: SampleFormValues): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    toast.success("Form validated", {
      description: `${values.displayName} can now continue to onboarding.`,
    });

    reset(defaultValues);
  };

  return (
    <Card size="sm" className="shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4" />
          Sample RHF + Zod Form
        </CardTitle>
        <CardDescription>
          This is a local sample form to verify validation wiring.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              placeholder="movie-night-host"
              {...register("displayName")}
            />
            {errors.displayName ? (
              <p className="text-xs text-destructive">
                {errors.displayName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="favoriteMovie">Favorite movie</Label>
            <Input
              id="favoriteMovie"
              placeholder="Interstellar"
              {...register("favoriteMovie")}
            />
            {errors.favoriteMovie ? (
              <p className="text-xs text-destructive">
                {errors.favoriteMovie.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@university.edu"
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Submit sample form"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
