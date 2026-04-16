"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await fetch("/api/admin/logout", {
          method: "POST"
        });
        router.push("/admin/login");
        router.refresh();
      }}
    >
      退出登录
    </Button>
  );
}
