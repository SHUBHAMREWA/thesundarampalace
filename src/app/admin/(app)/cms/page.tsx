import { redirect } from "next/navigation";

export default function CmsIndex() {
  redirect("/admin/cms/pages");
}
