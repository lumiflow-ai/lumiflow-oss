"use client"; // Putting this at the top level so it'll propagate all the way down for simplicity

import { useRouter } from "next/navigation";
import { useCallback, useContext, useState } from "react";
import styled, { css } from "styled-components";

import { fetchSignup } from "@/generated/serverEndpoints";

import { useBinding, useStateObject } from "@/library/StateObject";

import { generateOrganizationSlug } from "@/model/organizations";

import { OrganizationContext } from "@/components/contexts/OrganizationContext";
import {
  Button,
  ControlContainer,
  Label,
  LabeledControl,
  NavigationContent,
  NavigationStack,
  TextField,
} from "@/components/ui";

// MARK: - Styles

const CenteredContents = styled(ControlContainer)`${() => css`
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: center;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: min-content;
  max-width: 400px;
  width: calc(100vw - 40px);
  gap: 10px;
  margin: 20px;

  h1 {
    color: black;
    font-size: 18px;
    text-align: center;
    margin: 10px;
    font-weight: 400;
  }

  ${LabeledControl} {
    width: 100%;
  }

  ${Button} {
    margin-top: 20px;
    width: 100%;
  }
`}`;

// MARK: - Components

export default function Page() {
  const router = useRouter();
  const { organizations, refresh } = useContext(OrganizationContext);

  const userFullNameFocusState = useStateObject(true);

  const [isWorking, setIsWorking] = useState(false);

  const userFullNameState = useStateObject("");
  const [userFullName] = useBinding(userFullNameState);

  const companyNameState = useStateObject("");
  const [companyName] = useBinding(companyNameState);

  const finishSignup = useCallback(async () => {
    setIsWorking(true);

    try {
      const response = await fetchSignup({
        user: {
          fullName: userFullNameState.wrappedValue,
        },
        org: {
          name: companyNameState.wrappedValue,
        },
      });

      await refresh();

      const slug = generateOrganizationSlug({ org: response.organization, organizations });

      router.replace(`/app/${slug}/evaluations`);
    } catch {
      setIsWorking(false);
    }
  }, [userFullNameState, companyNameState, refresh, organizations, router]);

  return (
    <NavigationStack>
      <NavigationContent scrollsVertically>
        <CenteredContents size="large" prominence="primary" isEnabled={!isWorking}>
          <h1>Tell us a little about you</h1>
          <LabeledControl>
            <Label>Full Name</Label>
            <TextField
              valueState={userFullNameState}
              focusState={userFullNameFocusState}
              placeholder="Your Full Name"
              autoCapitalize="words"
            />
          </LabeledControl>
          <LabeledControl>
            <Label>Company</Label>
            <TextField valueState={companyNameState} placeholder="Where You Work" autoCapitalize="words" />
          </LabeledControl>
          <Button action={finishSignup} isEnabled={!!userFullName && !!companyName && !isWorking} keyEquivalent="Enter">
            Continue
          </Button>
        </CenteredContents>
      </NavigationContent>
    </NavigationStack>
  );
}
