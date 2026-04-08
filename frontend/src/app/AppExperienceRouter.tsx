import { useAccount } from "@/generated/serverEndpoints";

import { NavigationContent, NavigationStack } from "@/components/ui";

import { Unauthenticated } from "@/Unauthenticated";

/** Determine if the user is logged in and can continue into the app. */
export function AppExperienceRouter({ children }: { children: React.ReactNode }) {
  const { response, isLoading, error } = useAccount();

  if (isLoading)
    return (
      <NavigationStack>
        <NavigationContent scrollsVertically />
      </NavigationStack>
    );

  if (!response || error) return <Unauthenticated />;
  if (!response.isEmailVerified) return <Unauthenticated unverifiedUser={response.user} />;

  return <>{children}</>;
}
