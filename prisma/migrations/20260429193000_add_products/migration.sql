CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(160),
    "kind" "ActivationCodeKind" NOT NULL,
    "amountFen" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_isActive_sortOrder_createdAt_idx" ON "Product"("isActive", "sortOrder", "createdAt");
CREATE INDEX "Product_kind_isActive_sortOrder_createdAt_idx" ON "Product"("kind", "isActive", "sortOrder", "createdAt");
