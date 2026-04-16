import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireAdminPageAuth } from "@/lib/auth/admin-auth";
import { LogoutButton } from "@/app/admin/_components/logout-button";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPageAuth();
  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="container-shell space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4">
        <div>
          <h1 className="text-2xl font-bold">SMS 管理后台</h1>
          <p className="text-sm text-muted-foreground">当前账号：{admin.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/codes">
            <Button variant="outline">激活码管理</Button>
          </Link>
          <Link href="/admin/sessions">
            <Button variant="outline">会话记录</Button>
          </Link>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
