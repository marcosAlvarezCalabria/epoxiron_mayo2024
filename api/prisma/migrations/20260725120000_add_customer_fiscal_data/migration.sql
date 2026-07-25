-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "vat" TEXT,
ADD COLUMN "legalName" TEXT,
ADD COLUMN "fiscalStreet" TEXT,
ADD COLUMN "fiscalStreet2" TEXT,
ADD COLUMN "fiscalCity" TEXT,
ADD COLUMN "fiscalZip" TEXT,
ADD COLUMN "fiscalProvince" TEXT,
ADD COLUMN "fiscalCountryCode" TEXT DEFAULT 'ES',
ADD COLUMN "paymentTermCode" TEXT,
ADD COLUMN "externalPartnerId" TEXT;
