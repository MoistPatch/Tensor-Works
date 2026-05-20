import { render } from "@react-email/components";
import type React from "react";

export async function renderEmail(
  element: React.ReactElement
): Promise<{ html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
