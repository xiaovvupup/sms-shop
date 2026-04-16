import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RedeemForm } from "./redeem-form";

export default function HomePage() {
  return (
    <main className="container-shell space-y-5">
      <Card className="fade-in-up overflow-hidden">
        <CardHeader className="space-y-5">
          <Badge variant="secondary" className="w-fit">
            闲鱼成交后使用
          </Badge>
          <CardTitle className="text-4xl leading-tight md:text-6xl">
            输入激活码，开启一次验证码接收机会。
          </CardTitle>
          <CardDescription className="max-w-5xl text-[15px] leading-7">
            本站不提供站内购买。你在闲鱼收到激活码后，可在这里完成核销、申请手机号并实时接收验证码。激活码仅在第一次成功领取手机号后失效。
          </CardDescription>
          <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <div className="surface-muted rounded-full px-4 py-2">固定国家线路：英国🇬🇧</div>
            <div className="surface-muted rounded-full px-4 py-2">当前服务：Claude 手机验证码激活</div>
            <div className="surface-muted rounded-full px-4 py-2">默认超时：300 秒</div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card className="fade-in-up">
          <CardHeader>
            <CardTitle>核销与接码</CardTitle>
            <CardDescription>按下方步骤完成本次履约。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              步骤 1
            </div>
            <h3 className="mb-3 text-3xl font-bold md:text-4xl">输入激活码</h3>
            <p className="mb-7 text-[15px] leading-7 text-muted-foreground">
              校验通过后，系统会自动向 向您发送一个号码，并在接收短信后展示验证码，核销成功但未收到验证码，不会让激活码失效。
            </p>
            <RedeemForm />
          </CardContent>
        </Card>

        <Card className="fade-in-up">
          <CardHeader>
            <CardTitle>服务说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="surface-muted rounded-2xl p-4">
              <p className="mb-2 font-semibold text-foreground">你需要准备</p>
              <p>已在闲鱼收到激活码，并准备在 Claude 页面填写手机号。</p>
            </div>
            <div className="surface-muted rounded-2xl p-4">
              <p className="mb-2 font-semibold text-foreground">激活码规则</p>
              <p>只有在第一次成功收到验证码后，激活码才会失效。失败不会失效。</p>
            </div>
            <div className="surface-muted rounded-2xl p-4">
              <p className="mb-2 font-semibold text-foreground">使用建议</p>
              <p>拿到手机号后尽快提交，避免等待超时，系统默认 15 分钟。</p>
            </div>
            <div className="surface-muted rounded-2xl p-4">
              <p className="mb-2 font-semibold text-foreground">售后说明</p>
              <p>如页面异常，请携带闲鱼订单号和激活码联系卖家处理。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
