import { type ChangeEvent, useCallback, useId, useRef, useState } from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";
import { type StateObject, useBinding } from "@/library/StateObject";

import { Button, Color } from "@/components/ui";

const Container = styled.div`${() => css`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 15px;
`}`;

const HiddenInput = styled.input`${() => css`
  display: none;
`}`;

const Status = styled.span`${() => css`
  color: ${Color.mutedText};
`}`;

const FileName = styled.span`${() => css`
  color: ${Color.emphasizedText};
  font-weight: 500;
`}`;

const ErrorText = styled.span`${() => css`
  color: rgb(200, 0, 0);
`}`;

export const TextFileLoader = NamedComponent(
  "TextFileLoader",
  ({
    valueState,
    fileState,
    accept = [".txt", ".json", ".csv"],
    buttonLabel = "Load from file",
    description = "Select a file to load.",
  }: {
    valueState: StateObject<string>;
    fileState?: StateObject<File | null>;
    accept?: string[];
    buttonLabel?: string;
    description?: string;
  }) => {
    const [, setValue] = useBinding(valueState);
    const [, setFile] = useBinding(fileState);
    const inputID = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const triggerFileDialog = useCallback(() => {
      setErrorMessage(null);
      inputRef.current?.click();
    }, []);

    const onFileChange = useCallback(
      async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
          const contents = await file.text();
          setValue(contents);
          setFile(file);
          setFileName(file.name);
          setErrorMessage(null);
        } catch (error) {
          console.error("Unable to read file contents", error);
          setValue("");
          setFile(null);
          setFileName(null);
          setErrorMessage("Unable to read file contents.");
        } finally {
          setIsLoading(false);
          event.target.value = "";
        }
      },
      [setValue, setFile],
    );

    return (
      <Container>
        <HiddenInput
          id={inputID}
          ref={inputRef}
          type="file"
          accept={accept.join(",")}
          onChange={onFileChange}
          aria-hidden
          tabIndex={-1}
        />
        <Button size="small" action={triggerFileDialog} isEnabled={!isLoading}>
          {isLoading ? "Loading..." : buttonLabel}
        </Button>
        {errorMessage ? (
          <ErrorText role="alert">{errorMessage}</ErrorText>
        ) : fileName ? (
          <Status>
            Loaded <FileName>{fileName}</FileName>
          </Status>
        ) : (
          <Status>{description}</Status>
        )}
      </Container>
    );
  },
);
