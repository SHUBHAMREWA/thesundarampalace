"use client";

import { useSearchParams } from "next/navigation";

import { EnquiryForm, type EnquiryFormProps } from "./enquiry-form";

/**
 * The enquiry form with the venue preselected from ?hall=<slug>.
 * The query is read on the client so the page itself stays static.
 */
export function EnquiryFormWithHall(
  props: Omit<EnquiryFormProps, "defaultHall">,
) {
  const hall = useSearchParams().get("hall") ?? undefined;
  const defaultHall =
    hall && props.halls.some((h) => h.value === hall) ? hall : undefined;
  return <EnquiryForm {...props} defaultHall={defaultHall} />;
}
