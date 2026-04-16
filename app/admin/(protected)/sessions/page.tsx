"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SessionItem = {
  id: string;
  status: string;
  phoneNumber: string | null;
  providerActivationId: string | null;
  verificationCode: string | null;
  failureReason: string | null;
  createdAt: string;
  activationCode: {
    code: string;
  };
};

export default function AdminSessionsPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function loadData() {
    setLoading(true);
    try {
      const search = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status
      });
      if (query.trim()) search.set("query", query.trim());
      const response = await fetch(`/api/admin/sessions?${search.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.success) {
        setItems(payload.data.items);
        setTotal(payload.data.total);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>会话记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder="搜索会话ID/号码/激活码"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                loadData();
              }
            }}
          />
          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="all">全部状态</option>
            <option value="pending">pending</option>
            <option value="number_acquired">number_acquired</option>
            <option value="waiting_sms">waiting_sms</option>
            <option value="code_received">code_received</option>
            <option value="timeout">timeout</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <Button onClick={() => loadData()} disabled={loading}>
            {loading ? "刷新中..." : "查询"}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会话ID</TableHead>
              <TableHead>激活码</TableHead>
              <TableHead>号码</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>验证码</TableHead>
              <TableHead>失败原因</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.id}</TableCell>
                <TableCell className="font-mono">{item.activationCode.code}</TableCell>
                <TableCell>{item.phoneNumber ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.status}</Badge>
                </TableCell>
                <TableCell>{item.verificationCode ?? "-"}</TableCell>
                <TableCell className="max-w-[220px] truncate">{item.failureReason ?? "-"}</TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页，共 {total} 条
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              上一页
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
