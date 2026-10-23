import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-danger">403</p>
      <h1 className="mt-2 text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-3 text-text-muted">
        Ask an administrator if your role should include this area.
      </p>
      <Link href="/admin" className="mt-8 text-primary underline underline-offset-4">
        Back to the dashboard
      </Link>
    </div>
  );
}
