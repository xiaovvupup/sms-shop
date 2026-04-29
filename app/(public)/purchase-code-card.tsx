"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy, Loader2, QrCode, Smartphone, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Kind = "us" | "uk";
type PaymentMethod = "alipay" | "wxpay";

type ProductPayload = {
  id: string;
  name: string;
  description: string | null;
  kind: Kind;
  kindLabel: string;
  kindDisplayName: string;
  emojiFlag: string;
  phonePrefixHint: string;
  amountFen: number;
  amountYuan: string;
  stock: number;
  soldOut: boolean;
  sortOrder: number;
};

type PurchaseOrderPayload = {
  orderId: string;
  orderNo: string;
  productName: string;
  kind: Kind;
  kindLabel: string;
  kindDisplayName: string;
  amountFen: number;
  amountYuan: string;
  status: "pending" | "delivered" | "expired" | "cancelled";
  expiresAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  paymentChannel: PaymentMethod | string | null;
  paymentMethodLabel: string;
  providerTradeNo: string | null;
  paymentConfigured: boolean;
  qrCodeDataUrl: string;
  qrCodeImageUrl: string | null;
  qrCodeSourceUrl: string;
  dismissStorageKey: string;
  activationCode: string | null;
};

const STATUS_META: Record<PurchaseOrderPayload["status"], { label: string; variant: "warning" | "success" | "danger" }> = {
  pending: { label: "等待付款", variant: "warning" },
  delivered: { label: "付款成功", variant: "success" },
  expired: { label: "订单已过期", variant: "danger" },
  cancelled: { label: "订单已取消", variant: "danger" }
};

const KIND_ACCENT: Record<Kind, string> = {
  us: "from-[#0f3b6f] via-[#1f5d98] to-[#b22234]",
  uk: "from-[#143c7d] via-[#1f5fbf] to-[#c8102e]"
};

function readDismissed(order: PurchaseOrderPayload) {
  if (typeof window === "undefined") {
    return order;
  }

  if (window.localStorage.getItem(order.dismissStorageKey) !== "1") {
    return order;
  }

  return {
    ...order,
    activationCode: null
  };
}

export function PurchaseCodeCard() {
  const [products, setProducts] = useState<ProductPayload[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [order, setOrder] = useState<PurchaseOrderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          if (!cancelled) {
            setProducts([]);
            setProductsError(payload.message ?? "商品加载失败");
          }
          return;
        }
        if (!cancelled) {
          setProducts(payload.data as ProductPayload[]);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setProductsError("网络异常，商品信息加载失败");
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!order || order.status !== "pending") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/payment-orders/${order.orderId}`, { cache: "no-store" });
        const payload = await response.json();
        if (response.ok && payload.success) {
          setOrder(readDismissed(payload.data as PurchaseOrderPayload));
        }
      } catch {
        // ignore transient polling failures and keep the last good state
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [order]);

  async function createOrder(product: ProductPayload, paymentMethod: PaymentMethod) {
    const key = `${product.id}:${paymentMethod}`;
    setLoadingKey(key);
    setError(null);
    setCopied(null);
    try {
      const response = await fetch("/api/payment-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ productId: product.id, paymentMethod })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "下单失败");
        return;
      }
      setOrder(readDismissed(payload.data as PurchaseOrderPayload));
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setLoadingKey(null);
    }
  }

  async function copyText(value: string, successText: string) {
    await navigator.clipboard.writeText(value);
    setCopied(successText);
  }

  function handleClose() {
    if (order?.status === "delivered" && order.activationCode) {
      const confirmed = window.confirm("激活码只显示一次。请务必先保存激活码，关闭后当前浏览器将不再显示，确认关闭吗？");
      if (!confirmed) {
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(order.dismissStorageKey, "1");
      }
    }

    setOrder(null);
    setCopied(null);
  }

  return (
    <>
      <Card className="fade-in-up border-white/70">
        <CardHeader className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            站内支付后自动发码
          </Badge>
          <CardTitle className="text-2xl md:text-3xl">支付获取激活码</CardTitle>
          <CardDescription className="text-[15px] leading-7">
            商品与售价可由后台实时管理，支付成功后系统会自动发放对应地区激活码；当前页面会同步展示每个商品可用库存。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {productsLoading ? (
            <div className="col-span-full rounded-[28px] border border-white/70 bg-white/70 p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
              正在加载商品与库存...
            </div>
          ) : null}
          {!productsLoading && products.length === 0 ? (
            <div className="col-span-full rounded-[28px] border border-dashed border-border/70 bg-white/60 p-8 text-center text-sm text-muted-foreground">
              当前暂无可售商品，请先到后台新增并启用商品。
            </div>
          ) : null}
          {products.map((product) => (
            <div
              key={product.id}
              className="surface-card elevate-on-hover rounded-[28px] border border-white/70 p-5 text-left"
            >
              <div
                className={`mb-4 rounded-[24px] bg-gradient-to-br ${KIND_ACCENT[product.kind]} px-4 py-5 text-white shadow-[0_18px_38px_-22px_rgba(0,0,0,0.52)]`}
              >
                <div className="text-sm uppercase tracking-[0.2em] text-white/80">Activation Code</div>
                <div className="mt-3 text-3xl font-bold">{product.amountYuan} 元</div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xl font-semibold">{product.name}</div>
                  <Badge variant="outline">{product.kindDisplayName}</Badge>
                  <Badge variant={product.soldOut ? "danger" : "success"}>{product.soldOut ? "库存不足" : `库存 ${product.stock}`}</Badge>
                </div>
                <div className="text-sm leading-6 text-muted-foreground">
                  {product.description?.trim()
                    ? product.description
                    : `${product.phonePrefixHint} 开头号码，售价 ${product.amountYuan} 元`}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  className="h-11 w-full"
                  onClick={() => createOrder(product, "alipay")}
                  disabled={loadingKey !== null || product.soldOut}
                >
                  {loadingKey === `${product.id}:alipay` ? <Loader2 className="size-4 animate-spin" /> : <WalletCards className="size-4" />}
                  {product.soldOut ? "库存不足" : "支付宝支付"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    setError("微信支付暂未接入，建议使用支付宝支付");
                    setCopied(null);
                  }}
                  disabled={loadingKey !== null}
                >
                  <Smartphone className="size-4" />
                  微信支付
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
        {productsError ? <div className="px-6 pb-2 text-sm text-red-600">{productsError}</div> : null}
        {error ? <div className="px-6 pb-6 text-sm text-red-600">{error}</div> : null}
      </Card>

      {order ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/38 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-5xl rounded-[32px] border border-white/70 p-5 md:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_META[order.status].variant}>{STATUS_META[order.status].label}</Badge>
                  <Badge variant="outline">{order.kindDisplayName}</Badge>
                  <Badge variant="outline">{order.paymentMethodLabel}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-bold md:text-3xl">{order.productName} · 订单 {order.orderNo}</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(order.orderNo, "订单号已复制")}
                    className="shrink-0"
                  >
                    <Copy className="size-4" />
                    复制订单号
                  </Button>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  扫码支付 {order.amountYuan} 元。当前二维码为 ZPay 支付宝二维码，到账后系统会自动把对应地区激活码展示在这里。
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border/80 bg-white/80 p-2 text-muted-foreground transition hover:text-foreground"
                onClick={handleClose}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
              <div className="surface-muted rounded-[28px] p-5">
                <div className="rounded-[24px] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.qrCodeDataUrl ?? order.qrCodeImageUrl ?? ""}
                    alt={`${order.paymentMethodLabel}支付二维码`}
                    className="mx-auto size-[240px] rounded-2xl object-contain"
                  />
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <div>订单号：{order.orderNo}</div>
                  <div>支付金额：{order.amountYuan} 元</div>
                  <div>支付方式：{order.paymentMethodLabel}</div>
                  <div>过期时间：{new Date(order.expiresAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="surface-muted rounded-[28px] p-5">
                  <p className="text-sm font-semibold text-foreground">支付说明</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    付款成功后页面会自动轮询到账状态，无需刷新。如果长时间未自动发码，可把订单号发给管理员手动确认到账。
                  </p>
                  {!order.paymentConfigured ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      当前还没有配置真实 ZPay 网关，页面只能展示占位二维码。接入 ZPay 后，这里会显示真实支付宝二维码。
                    </div>
                  ) : null}
                  {order.qrCodeSourceUrl ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyText(order.qrCodeSourceUrl, `${order.paymentMethodLabel}链接已复制`)}
                      >
                        <QrCode className="size-4" />
                        复制支付链接
                      </Button>
                    </div>
                  ) : null}
                </div>

                {order.status === "delivered" ? (
                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/90 p-5">
                    <p className="text-sm font-semibold text-emerald-700">到账成功</p>
                    <div className="mt-3 text-3xl font-bold tracking-[0.18em] text-foreground md:text-4xl">
                      {order.activationCode ?? "已关闭展示"}
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      激活码只显示一次，请立刻复制并保存。点击右上角关闭后，当前浏览器将不再显示。
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => order.activationCode && copyText(order.activationCode, "激活码已复制")}
                        disabled={!order.activationCode}
                      >
                        <Copy className="size-4" />
                        复制激活码
                      </Button>
                    </div>
                  </div>
                ) : order.status === "pending" ? (
                  <div className="rounded-[28px] border border-border/70 bg-white/70 p-5">
                    <p className="text-sm font-semibold text-foreground">等待到账</p>
                    <div className="mt-3 flex items-center gap-2 text-3xl font-bold md:text-4xl">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      系统轮询中
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      如果你已经付款但页面还没更新，可以稍等几秒，或者把订单号复制给管理员进行手动确认。
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-red-200 bg-red-50/80 p-5">
                    <p className="text-sm font-semibold text-red-700">{order.status === "expired" ? "订单已过期" : "订单已取消"}</p>
                    <div className="mt-3 text-3xl font-bold text-foreground md:text-4xl">请重新下单</div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      这个订单已无法继续使用。关闭弹窗后重新选择国家即可创建新订单。
                    </p>
                  </div>
                )}

                {copied ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
                    {copied}
                  </div>
                ) : null}
                {order.status === "delivered" && order.activationCode ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="size-4" />
                      关闭提醒
                    </div>
                    <p className="mt-2">右上角关闭只会在当前浏览器隐藏激活码，不会再触发任何数据库写入。</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
