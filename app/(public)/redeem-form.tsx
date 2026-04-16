"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatActivationCodeInput } from "@/lib/core/utils";

export function RedeemForm() {
  const router = useRouter();
  const [activationCode, setActivationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationCode })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "兑换失败");
        return;
      }
      const resumed = payload.data.resumed ? "?resumed=1" : "";
      router.push(`/session/${payload.data.sessionId}${resumed}`);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        placeholder="请输入激活码（XXXX-XXXX-XXXX）"
        value={activationCode}
        onChange={(e) => setActivationCode(formatActivationCodeInput(e.target.value))}
        className="h-14 text-base tracking-[0.18em] uppercase md:text-lg"
        autoComplete="off"
        required
      />
      <div className="flex flex-col gap-3 md:flex-row">
        <Button type="submit" className="h-14 flex-1 text-base md:text-lg" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "校验激活码"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 flex-1 text-base md:text-lg"
          onClick={() => {
            setActivationCode("");
            setError(null);
          }}
        >
          重新输入激活码
        </Button>
      </div>
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
          所有激活码校验均在服务端完成。
        </div>
      )}
    </form>
  );
}
