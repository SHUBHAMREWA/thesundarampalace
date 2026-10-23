import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <h1 className="text-display-2">{t("title")}</h1>
      <p className="text-body-lg mt-4 text-text-muted">{t("body")}</p>
      <Link href="/" className="mt-8 text-primary underline underline-offset-4">
        {t("home")}
      </Link>
    </Container>
  );
}
