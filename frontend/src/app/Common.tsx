"use client";

import { RecoilRoot } from "recoil";

import { AppExperienceRouter } from "@/app/AppExperienceRouter";

/** Common component used across all routes. */
export const Common = ({ children }: { children: React.ReactNode }) => {
  return (
    <RecoilRoot>
      <AppExperienceRouter>{children}</AppExperienceRouter>
    </RecoilRoot>
  );
};
