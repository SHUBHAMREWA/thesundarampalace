"use client";

import { useSearchParams } from "next/navigation";

import { EnquiryForm, type EnquiryFormProps } from "./enquiry-form";

/**
 * Step-by-step enquiry form that preselects the venue from ?hall=<slug>.
 * The query is read on the client so the page itself stays static.
 */
export function StepsEnquiryForm(props: Omit<EnquiryFormProps, "variant" | "defaultHall">) {
  const hall = useSearchParams().get("hall") ?? undefined;
  const defaultHall = hall && props.halls.some((h) => h.value === hall) ? hall : undefined;
  return <EnquiryForm variant="steps" {...props} defaultHall={defaultHall} />;
}
