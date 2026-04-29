"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatActivationCodeInput } from "@/lib/core/utils";

type CodeKind = "us" | "uk";

type ProductItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: CodeKind;
  kindDisplayName: string;
  amountFen: number;
  amountYuan: string;
  sortOrder: number;
  isActive: boolean;
  stock: number;
  createdAt: string;
  updatedAt: string;
};

type ProductDraft = {
  name: string;
  description: string;
  kind: CodeKind;
  priceYuan: string;
  sortOrder: number;
  isActive: boolean;
};

type CodeItem = {
  id: string;
  code: string;
  kind: CodeKind;
  status: string;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
  issuedPaymentOrderId: string | null;
};

type CodeDetail = {
  id: string;
  code: string;
  kind: CodeKind;
  status: string;
  usageCount: number;
  expiresAt: string | null;
  reservedAt: string | null;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
  issuedPaymentOrderId: string | null;
};

type SmsBalancePayload = {
  balance: number;
  threshold: number;
  low: boolean;
  mailSent: boolean;
};

type PaymentOrderDetail = {
  orderId: string;
  orderNo: string;
  kind: CodeKind;
  kindDisplayName: string;
  amountYuan: string;
  status: "pending" | "delivered" | "expired" | "cancelled";
  expiresAt: string;
  deliveredAt: string | null;
  activationCode: string | null;
};

const KIND_OPTIONS: Array<{ value: CodeKind; label: string }> = [
  { value: "us", label: "美国 🇺🇸" },
  { value: "uk", label: "英国 🇬🇧" }
];

const STATUS_META: Record<PaymentOrderDetail["status"], { label: string; variant: "warning" | "success" | "danger" }> = {
  pending: { label: "待到账", variant: "warning" },
  delivered: { label: "已发码", variant: "success" },
  expired: { label: "已过期", variant: "danger" },
  cancelled: { label: "已取消", variant: "danger" }
};

function renderKindLabel(kind: CodeKind) {
  return kind === "us" ? "美国 🇺🇸" : "英国 🇬🇧";
}

export default function AdminCodesPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<ProductDraft>({
    name: "",
    description: "",
    kind: "us",
    priceYuan: "",
    sortOrder: 0,
    isActive: true
  });
  const [items, setItems] = useState<CodeItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState<"all" | CodeKind>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [count, setCount] = useState(20);
  const [generateKind, setGenerateKind] = useState<CodeKind>("us");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [singleCode, setSingleCode] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);
  const [invalidatingCode, setInvalidatingCode] = useState(false);
  const [restoringCode, setRestoringCode] = useState(false);
  const [codeDetail, setCodeDetail] = useState<CodeDetail | null>(null);
  const [codeActionMessage, setCodeActionMessage] = useState<string | null>(null);
  const [codeActionError, setCodeActionError] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<SmsBalancePayload | null>(null);
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [paymentKeyword, setPaymentKeyword] = useState("");
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentDetail, setPaymentDetail] = useState<PaymentOrderDetail | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toProductDraft(item: ProductItem): ProductDraft {
    return {
      name: item.name,
      description: item.description ?? "",
      kind: item.kind,
      priceYuan: item.amountYuan,
      sortOrder: item.sortOrder,
      isActive: item.isActive
    };
  }

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const response = await fetch("/api/admin/products", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setProductError(payload.message ?? "商品列表加载失败");
        return;
      }
      const data = payload.data as ProductItem[];
      setProducts(data);
      setProductDrafts(Object.fromEntries(data.map((item) => [item.id, toProductDraft(item)])));
    } catch {
      setProductError("网络异常，商品列表加载失败");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const search = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status
      });
      if (query.trim()) search.set("query", query.trim());
      if (kind !== "all") search.set("kind", kind);
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
  }, [page, status, kind]);

  useEffect(() => {
    loadProducts();
  }, []);

  function updateDraft(productId: string, patch: Partial<ProductDraft>) {
    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        ...patch
      }
    }));
  }

  async function createProduct() {
    if (!newProduct.name.trim() || !newProduct.priceYuan.trim()) {
      setProductError("请填写商品名称和售价");
      return;
    }
    setCreatingProduct(true);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          description: newProduct.description.trim(),
          kind: newProduct.kind,
          priceYuan: newProduct.priceYuan,
          sortOrder: newProduct.sortOrder,
          isActive: newProduct.isActive
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setProductError(payload.message ?? "商品创建失败");
        return;
      }
      setNewProduct({
        name: "",
        description: "",
        kind: "us",
        priceYuan: "",
        sortOrder: 0,
        isActive: true
      });
      setProductMessage("商品已创建");
      await loadProducts();
    } catch {
      setProductError("网络异常，请重试");
    } finally {
      setCreatingProduct(false);
    }
  }

  async function saveProduct(productId: string) {
    const draft = productDrafts[productId];
    if (!draft || !draft.name.trim() || !draft.priceYuan.trim()) {
      setProductError("请先补全商品名称和售价");
      return;
    }
    setSavingProductId(productId);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim(),
          kind: draft.kind,
          priceYuan: draft.priceYuan,
          sortOrder: draft.sortOrder,
          isActive: draft.isActive
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setProductError(payload.message ?? "商品更新失败");
        return;
      }
      setProductMessage("商品已更新");
      await loadProducts();
    } catch {
      setProductError("网络异常，请重试");
    } finally {
      setSavingProductId(null);
    }
  }

  async function deleteProduct(productId: string) {
    if (!confirm("确认删除这个商品吗？删除后用户端将不再显示。")) {
      return;
    }
    setDeletingProductId(productId);
    setProductError(null);
    setProductMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setProductError(payload.message ?? "商品删除失败");
        return;
      }
      setProductMessage("商品已删除");
      await loadProducts();
    } catch {
      setProductError("网络异常，请重试");
    } finally {
      setDeletingProductId(null);
    }
  }

  async function generateCodes() {
    setCreating(true);
    try {
      const response = await fetch("/api/admin/codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, kind: generateKind })
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        await loadData();
      }
    } finally {
      setCreating(false);
    }
  }

  async function checkSingleCode() {
    if (!singleCode.trim()) {
      setCodeActionError("请输入激活码");
      return;
    }
    setCheckingCode(true);
    setCodeActionError(null);
    setCodeActionMessage(null);
    try {
      const response = await fetch("/api/admin/codes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationCode: singleCode })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setCodeDetail(null);
        setCodeActionError(payload.message ?? "查询失败");
        return;
      }
      setCodeDetail(payload.data as CodeDetail);
      setCodeActionMessage("查询成功");
    } catch {
      setCodeDetail(null);
      setCodeActionError("网络异常，请重试");
    } finally {
      setCheckingCode(false);
    }
  }

  async function invalidateSingleCode() {
    if (!singleCode.trim()) {
      setCodeActionError("请输入激活码");
      return;
    }
    if (!confirm("确认将该激活码设为失效（disabled）吗？")) {
      return;
    }
    setInvalidatingCode(true);
    setCodeActionError(null);
    setCodeActionMessage(null);
    try {
      const response = await fetch("/api/admin/codes/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationCode: singleCode })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setCodeActionError(payload.message ?? "失效操作失败");
        return;
      }
      setCodeDetail(payload.data.detail as CodeDetail);
      setCodeActionMessage(payload.message ?? (payload.data.changed ? "激活码已设为失效" : "激活码状态无需变更"));
      await loadData();
    } catch {
      setCodeActionError("网络异常，请重试");
    } finally {
      setInvalidatingCode(false);
    }
  }

  async function restoreSingleCode() {
    if (!singleCode.trim()) {
      setCodeActionError("请输入激活码");
      return;
    }
    if (!confirm("确认将该激活码恢复为可用状态（unused）吗？")) {
      return;
    }
    setRestoringCode(true);
    setCodeActionError(null);
    setCodeActionMessage(null);
    try {
      const response = await fetch("/api/admin/codes/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationCode: singleCode })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setCodeActionError(payload.message ?? "恢复操作失败");
        return;
      }
      setCodeDetail(payload.data.detail as CodeDetail);
      setCodeActionMessage(payload.message ?? (payload.data.changed ? "激活码已恢复可用" : "激活码已是可用状态"));
      await loadData();
    } catch {
      setCodeActionError("网络异常，请重试");
    } finally {
      setRestoringCode(false);
    }
  }

  async function checkSmsBalance() {
    setCheckingBalance(true);
    setBalanceError(null);
    setBalanceMessage(null);
    try {
      const response = await fetch("/api/admin/sms/balance", {
        method: "GET",
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setBalanceError(payload.message ?? "余额查询失败");
        return;
      }
      const data = payload.data as SmsBalancePayload;
      setBalanceInfo(data);
      if (data.low) {
        setBalanceMessage(data.mailSent ? "余额低于阈值，已发送邮件提醒" : "余额低于阈值，请尽快充值");
      } else {
        setBalanceMessage("余额充足");
      }
    } catch {
      setBalanceError("网络异常，请重试");
    } finally {
      setCheckingBalance(false);
    }
  }

  async function checkPaymentOrder() {
    if (!paymentKeyword.trim()) {
      setPaymentError("请输入订单号");
      return;
    }
    setCheckingPayment(true);
    setPaymentError(null);
    setPaymentMessage(null);
    try {
      const response = await fetch("/api/admin/payment-orders/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: paymentKeyword.trim() })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setPaymentDetail(null);
        setPaymentError(payload.message ?? "订单查询失败");
        return;
      }
      setPaymentDetail(payload.data as PaymentOrderDetail);
      setPaymentMessage("订单查询成功");
    } catch {
      setPaymentDetail(null);
      setPaymentError("网络异常，请重试");
    } finally {
      setCheckingPayment(false);
    }
  }

  async function confirmPaymentOrder() {
    if (!paymentDetail?.orderId) {
      setPaymentError("请先查询订单");
      return;
    }
    if (!confirm("确认该订单已经到账并立即发放激活码吗？")) {
      return;
    }
    setConfirmingPayment(true);
    setPaymentError(null);
    setPaymentMessage(null);
    try {
      const response = await fetch("/api/admin/payment-orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: paymentDetail.orderId })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setPaymentError(payload.message ?? "确认到账失败");
        return;
      }
      setPaymentDetail(payload.data as PaymentOrderDetail);
      setPaymentMessage("订单已确认到账并发码");
      await loadData();
    } catch {
      setPaymentError("网络异常，请重试");
    } finally {
      setConfirmingPayment(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>激活码管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">商品管理</h3>
            <p className="text-sm text-muted-foreground">可自由新增商品、修改售价或删除商品。用户端会按商品绑定地区自动显示对应库存。</p>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/50 bg-background/60 p-4 xl:grid-cols-[1.2fr_1.4fr_180px_160px_120px_auto]">
            <Input
              placeholder="商品名称"
              value={newProduct.name}
              onChange={(e) => setNewProduct((current) => ({ ...current, name: e.target.value }))}
            />
            <Input
              placeholder="商品说明（可选）"
              value={newProduct.description}
              onChange={(e) => setNewProduct((current) => ({ ...current, description: e.target.value }))}
            />
            <select
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              value={newProduct.kind}
              onChange={(e) => setNewProduct((current) => ({ ...current, kind: e.target.value as CodeKind }))}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="售价（元）"
              value={newProduct.priceYuan}
              onChange={(e) => setNewProduct((current) => ({ ...current, priceYuan: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              placeholder="排序"
              value={newProduct.sortOrder}
              onChange={(e) => setNewProduct((current) => ({ ...current, sortOrder: Number(e.target.value) || 0 }))}
            />
            <Button onClick={createProduct} disabled={creatingProduct}>
              {creatingProduct ? "创建中..." : "新增商品"}
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名称</TableHead>
                  <TableHead>商品说明</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>售价</TableHead>
                  <TableHead>库存</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const draft = productDrafts[product.id] ?? toProductDraft(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Input value={draft.name} onChange={(e) => updateDraft(product.id, { name: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.description}
                          onChange={(e) => updateDraft(product.id, { description: e.target.value })}
                          placeholder="可选"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                          value={draft.kind}
                          onChange={(e) => updateDraft(product.id, { kind: e.target.value as CodeKind })}
                        >
                          {KIND_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={draft.priceYuan}
                          onChange={(e) => updateDraft(product.id, { priceYuan: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.stock > 0 ? "success" : "danger"}>{product.stock}</Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={draft.sortOrder}
                          onChange={(e) => updateDraft(product.id, { sortOrder: Number(e.target.value) || 0 })}
                        />
                      </TableCell>
                      <TableCell>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(e) => updateDraft(product.id, { isActive: e.target.checked })}
                          />
                          {draft.isActive ? "上架中" : "已下架"}
                        </label>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => saveProduct(product.id)}
                            disabled={savingProductId === product.id || deletingProductId === product.id}
                          >
                            {savingProductId === product.id ? "保存中..." : "保存"}
                          </Button>
                          <Button
                            onClick={() => deleteProduct(product.id)}
                            disabled={deletingProductId === product.id || savingProductId === product.id}
                          >
                            {deletingProductId === product.id ? "删除中..." : "删除"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loadingProducts && products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      暂无商品
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {productMessage ? <div className="mt-3 text-sm text-emerald-700">{productMessage}</div> : null}
          {productError ? <div className="mt-3 text-sm text-red-600">{productError}</div> : null}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">HeroSMS 余额监控</h3>
            <p className="text-sm text-muted-foreground">点击查询实时余额；低于阈值会触发告警（支持邮件）。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={checkSmsBalance} disabled={checkingBalance}>
              {checkingBalance ? "查询中..." : "查询 HeroSMS 余额"}
            </Button>
            {balanceInfo ? (
              <div className={`rounded-full px-3 py-1 text-sm ${balanceInfo.low ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                当前余额：${balanceInfo.balance.toFixed(4)}（阈值：${balanceInfo.threshold.toFixed(2)}）
              </div>
            ) : null}
          </div>
          {balanceMessage ? <div className="mt-3 text-sm text-emerald-700">{balanceMessage}</div> : null}
          {balanceError ? <div className="mt-3 text-sm text-red-600">{balanceError}</div> : null}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">付款订单查单 / 手动确认到账</h3>
            <p className="text-sm text-muted-foreground">
              用户付款后若未自动发码，可通过订单号查单并手动确认到账，系统会立即发放已锁定的对应地区激活码。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
            <Input
              placeholder="输入订单号或订单 ID"
              value={paymentKeyword}
              onChange={(e) => setPaymentKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  checkPaymentOrder();
                }
              }}
            />
            <Button variant="outline" onClick={checkPaymentOrder} disabled={checkingPayment || confirmingPayment}>
              {checkingPayment ? "查询中..." : "查询订单"}
            </Button>
            <Button onClick={confirmPaymentOrder} disabled={!paymentDetail || confirmingPayment || checkingPayment}>
              {confirmingPayment ? "处理中..." : "确认到账并发码"}
            </Button>
          </div>
          {paymentDetail ? (
            <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-border/50 bg-background/70 p-3 text-sm md:grid-cols-2">
              <div>订单号：{paymentDetail.orderNo}</div>
              <div>
                状态：<Badge variant={STATUS_META[paymentDetail.status].variant}>{STATUS_META[paymentDetail.status].label}</Badge>
              </div>
              <div>地区：{paymentDetail.kindDisplayName}</div>
              <div>金额：{paymentDetail.amountYuan} 元</div>
              <div>过期时间：{new Date(paymentDetail.expiresAt).toLocaleString()}</div>
              <div>发码时间：{paymentDetail.deliveredAt ? new Date(paymentDetail.deliveredAt).toLocaleString() : "-"}</div>
              <div className="md:col-span-2">
                激活码：{paymentDetail.activationCode ? <span className="font-mono">{paymentDetail.activationCode}</span> : "-"}
              </div>
            </div>
          ) : null}
          {paymentMessage ? <div className="mt-3 text-sm text-emerald-700">{paymentMessage}</div> : null}
          {paymentError ? <div className="mt-3 text-sm text-red-600">{paymentError}</div> : null}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">单码状态检查 / 状态调整</h3>
            <p className="text-sm text-muted-foreground">
              输入激活码后可立即查看状态、国家类型和绑定订单，并可设为失效或恢复为可用状态。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <Input
              placeholder="输入激活码（例如 DK42BCPDPPRL）"
              value={singleCode}
              onChange={(e) => setSingleCode(formatActivationCodeInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  checkSingleCode();
                }
              }}
            />
            <Button variant="outline" onClick={checkSingleCode} disabled={checkingCode || invalidatingCode || restoringCode}>
              {checkingCode ? "查询中..." : "检查状态"}
            </Button>
            <Button variant="outline" onClick={restoreSingleCode} disabled={restoringCode || checkingCode || invalidatingCode}>
              {restoringCode ? "处理中..." : "恢复可用"}
            </Button>
            <Button onClick={invalidateSingleCode} disabled={invalidatingCode || checkingCode || restoringCode}>
              {invalidatingCode ? "处理中..." : "设为失效"}
            </Button>
          </div>
          {codeDetail ? (
            <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-border/50 bg-background/70 p-3 text-sm md:grid-cols-2">
              <div>
                激活码：<span className="font-mono">{codeDetail.code}</span>
              </div>
              <div>
                状态：<Badge variant="outline">{codeDetail.status}</Badge>
              </div>
              <div>地区：{renderKindLabel(codeDetail.kind)}</div>
              <div>使用次数：{codeDetail.usageCount}</div>
              <div>过期时间：{codeDetail.expiresAt ? new Date(codeDetail.expiresAt).toLocaleString() : "-"}</div>
              <div>锁定时间：{codeDetail.reservedAt ? new Date(codeDetail.reservedAt).toLocaleString() : "-"}</div>
              <div>核销时间：{codeDetail.usedAt ? new Date(codeDetail.usedAt).toLocaleString() : "-"}</div>
              <div>支付订单：{codeDetail.issuedPaymentOrderId ?? "-"}</div>
            </div>
          ) : null}
          {codeActionMessage ? <div className="mt-3 text-sm text-emerald-700">{codeActionMessage}</div> : null}
          {codeActionError ? <div className="mt-3 text-sm text-red-600">{codeActionError}</div> : null}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">批量生成激活码</h3>
            <p className="text-sm text-muted-foreground">可分别为美国和英国批量补码，生成后的激活码将直接写入数据库。</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_160px_auto]">
            <select
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              value={generateKind}
              onChange={(e) => setGenerateKind(e.target.value as CodeKind)}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            <Button onClick={generateCodes} disabled={creating}>
              {creating ? "生成中..." : "批量生成"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
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
          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => {
              setPage(1);
              setKind(e.target.value as "all" | CodeKind);
            }}
          >
            <option value="all">全部地区</option>
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setPage(1);
              loadData();
            }}
          >
            {loading ? "刷新中..." : "查询"}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>激活码</TableHead>
              <TableHead>地区</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>使用次数</TableHead>
              <TableHead>支付订单</TableHead>
              <TableHead>过期时间</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.code}</TableCell>
                <TableCell>{renderKindLabel(item.kind)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.status}</Badge>
                </TableCell>
                <TableCell>{item.usageCount}</TableCell>
                <TableCell className="font-mono">{item.issuedPaymentOrderId ?? "-"}</TableCell>
                <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "-"}</TableCell>
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
