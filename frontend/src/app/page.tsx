"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RecoilRoot } from "recoil";

import { useAccount } from "@/generated/serverEndpoints";

import { NavigationContent, NavigationStack } from "@/components/ui";

import { Unauthenticated } from "@/Unauthenticated";

function HomePageContent() {
  const router = useRouter();
  const { response, isLoading, error } = useAccount();

  useEffect(() => {
    if (response?.isEmailVerified) router.replace("/app");
  }, [response, router]);

  if (isLoading || response?.isEmailVerified) {
    return (
      <NavigationStack>
        <NavigationContent scrollsVertically />
      </NavigationStack>
    );
  }

  if (!response || error) return <Unauthenticated />;
  return <Unauthenticated unverifiedUser={response.user} />;
}

export default function HomePage() {
  return (
    <RecoilRoot>
      <HomePageContent />
    </RecoilRoot>
  );
}
