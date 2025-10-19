import type { ExecutionResult } from "graphql";
import type { TypedDocumentString } from "./graphql";
import { strapiUrl } from "../consts";

export async function execute<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const url = `${strapiUrl}/graphql`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    console.error(await response.json());
    throw new Error("Network response was not ok");
  }

  return response.json() as ExecutionResult<TResult>;
}
