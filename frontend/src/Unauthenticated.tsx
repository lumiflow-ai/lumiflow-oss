import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useState } from "react";
import styled, { css } from "styled-components";

import type { User } from "@/generated/serverTypes";

import { Button, Color, Font, Size } from "@/components/ui";

import BACKEND_URLS from "@/BackendURLs";

const Message = styled.h2`${() => css`
  position: relative;
  font-weight: 500;
  opacity: 0.4;
  font-family: ${Font.inter};
  font-size: ${Size.fontSize.fontSize14};
  max-width: 300px;
  text-align: center;
  margin: 0px;
`}`;

const Welcome = styled.h1`
  position: relative;
  font-weight: 500;
  font-size: ${Size.fontSize.fontSize32};
  color: ${Color.textDark};
  max-width: 1100px;
  line-height: 1.2;
  font-family: ${Font.inter};
  text-align: center;
  margin: 0;
`;

const WelcomeMessage = styled.p`
  position: relative;
  font-weight: 500;
  font-size: ${Size.fontSize.fontSize14};
  color: ${Color.textDark};
  max-width: 1100px;
  line-height: 1.3;
  font-family: ${Font.ibmPlexSans};
  text-align: center;
  margin: 0 0 20px 0;
`;

const Link = styled.a`${() => css`
  position: relative;
  font-weight: 500;
  opacity: 0.4;
  font-family: ${Font.inter};
  font-size: 13px;
  max-width: 300px;
  text-align: center;
  margin: 0px;
  cursor: pointer;
  color: black;

  &:hover {
    text-decoration: underline;
  }
`}`;

const LoginForm = styled.form`
  width: 100%;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LoginInput = styled.input`
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  border: 1px solid ${Color.line};
  border-radius: 8px;
  padding: 0 12px;
  font-family: ${Font.inter};
  font-size: ${Size.fontSize.fontSize14};
  background: rgba(255, 255, 255, 0.72);
  color: ${Color.textDark};
`;

const LoginError = styled.p`
  margin: 0;
  min-height: 16px;
  font-family: ${Font.inter};
  font-size: 12px;
  color: #9f1d1d;
`;

const LoginSubmit = styled.button`
  width: 100%;
  height: 40px;
  border: 1px solid ${Color.buttonOutlined.border};
  border-radius: 14px;
  font-family: ${Font.inter};
  font-size: ${Size.fontSize.fontSize14};
  background: ${Color.buttonOutlined.background};
  color: ${Color.buttonOutlined.text};
  cursor: pointer;

  &:not([disabled]):hover {
    background: ${Color.buttonOutlined.hover.background};
    color: ${Color.buttonOutlined.hover.text};
  }

  &[disabled] {
    opacity: 0.4;
    cursor: auto;
  }
`;

export const Unauthenticated = ({ unverifiedUser }: { unverifiedUser?: User }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const showPasswordLogin = process.env.NODE_ENV === "development";

  const retryLogin = useCallback(() => {
    const backendLoginURL = new URL(BACKEND_URLS.LOGIN);
    backendLoginURL.searchParams.append("path", pathname);
    router.push(backendLoginURL.toString());
  }, [pathname, router]);

  const redirectToLogin = useCallback(async () => {
    const backendLoginURL = new URL(BACKEND_URLS.LOGOUT);
    backendLoginURL.searchParams.append("path", "/app");
    window.location.href = backendLoginURL.toString();
  }, []);

  const submitLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoginError("");
      setIsLoginSubmitting(true);

      const backendLoginURL = new URL(BACKEND_URLS.LOGIN);
      backendLoginURL.searchParams.append("path", pathname);

      try {
        const response = await fetch(backendLoginURL, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: loginEmail,
            password: loginPassword,
          }),
        });

        if (!response.ok) {
          setLoginError(response.status === 404 ? "Login is not configured." : "Invalid email or password.");
          return;
        }

        window.location.assign(pathname === "/" ? "/app" : pathname);
      } catch {
        setLoginError("Unable to reach the backend.");
      } finally {
        setIsLoginSubmitting(false);
      }
    },
    [loginEmail, loginPassword, pathname],
  );

  return (
    <CenteredContainer>
      <CenteredContent>
        <CenteredImage src="/assets/Logo-icon.svg" alt="Lumiflow AI" width={300} height={300} priority />
        {unverifiedUser ? (
          <>
            <Message>Please verify your email at “{unverifiedUser.email}” before continuing.</Message>
            <Button action={retryLogin} size="large" prominence="primary">
              Continue with Google
            </Button>
            <Link onClick={redirectToLogin}>Sign In with a Different Google Account…</Link>
          </>
        ) : (
          <>
            <Welcome>Welcome to Lumiflow AI</Welcome>
            <WelcomeMessage>
              Access your AI evaluations, insights, and decisions
              <br />
              all in one place.
            </WelcomeMessage>
            {showPasswordLogin ? (
              <LoginForm onSubmit={submitLogin}>
                <LoginInput
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  type="email"
                  autoComplete="username"
                  placeholder="Email"
                  disabled={isLoginSubmitting}
                />
                <LoginInput
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  disabled={isLoginSubmitting}
                />
                <LoginSubmit disabled={isLoginSubmitting} type="submit">
                  Continue
                </LoginSubmit>
                <LoginError>{loginError}</LoginError>
              </LoginForm>
            ) : null}
            <Button
              action={retryLogin}
              size="large"
              prominence="primary"
              style={{
                background: Color.buttonfilled.background,
                color: Color.buttonfilled.text,
                borderRadius: "14px",
                height: "40px",
              }}
            >
              Continue with Google
            </Button>
          </>
        )}
      </CenteredContent>
    </CenteredContainer>
  );
};

const CenteredContainer = styled.div`
  position: fixed;
  inset: 0;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;

  background-image: url("/assets/login-background.svg");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  ${Button} {
    width: 300px;
  }`;

const CenteredContent = styled.div`
  box-sizing: border-box; 

  position: relative;
  height:370px
  width: 100%;
  max-width: 520px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  background-color: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);

  border: 1.5px solid ${Color.line};
  border-radius: 24px;
  padding: clamp(54px, 5vw, 64px)
         clamp(24px, 5vw, 50px);
  animation: cardIn 0.6s ease-out;

  @keyframes cardIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
    
  ${Button} {
    width: 100%;
    max-width: 300px;
    background-color:black
    color:white
  }`;

const CenteredImage = styled(Image)`
  width: 108px;
  height: 48px;
  margin-bottom: 24px;`;
