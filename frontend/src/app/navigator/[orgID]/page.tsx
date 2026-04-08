import { redirect } from "next/navigation";

export default async function OrganizationRootPage({ params }: { params: Promise<{ orgID: string }> }) {
  const { orgID } = await params;
  redirect(`/app/${orgID}/artifacts`);
}
