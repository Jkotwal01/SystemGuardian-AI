"use client";

import { useState, useEffect } from "react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { api } from "@/lib/api-client";
import type { AppSettings } from "@/lib/types";

export function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settings.get().then((data: AppSettings) => {
      if (data.onboarding_complete !== "true") {
        setShowWizard(true);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <>
      {showWizard && <OnboardingWizard onComplete={() => setShowWizard(false)} />}
      {children}
    </>
  );
}
