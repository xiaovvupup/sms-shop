"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CodeItem = {
  id: string;
  code: string;
  status: string;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
};

export default function AdminCodesPage() {
  const [items, setItems] = useState<CodeItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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
      const response = await fetch(`/api/admin/codes?${search.toString()}`, { cache: "no-store" });
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

  async function generateCodes() {
    setCreating(true);
    try {
      const response = await fetch("/api/admin/codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        await loadData();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>激活码管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <Input
            placeholder="搜索激活码/备注"
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
            <option value="unused">unused</option>
            <option value="reserved">reserved</option>
            <option value="used">used</option>
            <option value="expired">expired</option>
            <option value="disabled">disabled</option>
          </select>
          <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <Button onClick={generateCodes} disabled={creating}>
            {creating ? "生成中..." : "批量生成"}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadData()} disabled={loading}>
            {loading ? "刷新中..." : "刷新"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPage(1);
              loadData();
            }}
          >
            查询
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>激活码</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>使用次数</TableHead>
              <TableHead>过期时间</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.code}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.status}</Badge>
                </TableCell>
                <TableCell>{item.usageCount}</TableCell>
                <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "-"}</TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
