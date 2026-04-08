import styled, { css } from "styled-components";

export const TruncatingText = styled.span<{ $lineLimit?: number }>`${({ $lineLimit = 2 }) => css`
  flex-grow: 1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
  -webkit-line-clamp: ${$lineLimit};
  line-clamp: ${$lineLimit};
  hyphens: auto;
  word-break: break-word;
  overflow: hidden;
`}`;
