"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

export function IntlProvider({ messages, children }: { messages: AbstractIntlMessages; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="es"
      messages={messages}
      onError={() => {}}
      getMessageFallback={({ key }) => key}
    >
      {children}
    </NextIntlClientProvider>
  );
}
