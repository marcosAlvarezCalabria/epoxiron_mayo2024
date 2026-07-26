-- CreateEnum
CREATE TYPE "InvoiceLocalState" AS ENUM ('CREATING', 'CREATED_REMOTE', 'LINKED', 'RECONCILING', 'FAILED');
CREATE TYPE "OdooMoveState" AS ENUM ('DRAFT', 'POSTED', 'CANCEL');
CREATE TYPE "VerifactuState" AS ENUM ('NOT_SENT', 'PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "DeliveryNoteStatus" ADD VALUE 'INVOICED';

-- CreateTable
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "remoteReference" TEXT NOT NULL,
  "series" TEXT,
  "number" TEXT,
  "customerId" TEXT NOT NULL,
  "customerLegalName" TEXT NOT NULL,
  "customerVat" TEXT NOT NULL,
  "customerFiscalStreet" TEXT NOT NULL,
  "customerFiscalStreet2" TEXT,
  "customerFiscalCity" TEXT NOT NULL,
  "customerFiscalZip" TEXT NOT NULL,
  "customerProvince" TEXT,
  "customerCountryCode" TEXT NOT NULL,
  "paymentTermCode" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxRate" DECIMAL(5,2) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "localState" "InvoiceLocalState" NOT NULL DEFAULT 'CREATING',
  "odooMoveState" "OdooMoveState",
  "verifactuState" "VerifactuState" NOT NULL DEFAULT 'NOT_SENT',
  "externalInvoiceId" TEXT,
  "verifactuDocumentId" TEXT,
  "verifactuQrValue" TEXT,
  "pdfAvailable" BOOLEAN NOT NULL DEFAULT false,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  "nextReconciliationAt" TIMESTAMP(3),
  "reconciliationLeaseUntil" TIMESTAMP(3),
  "reconciliationLeaseToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,4) NOT NULL,
  "unitPrice" DECIMAL(12,4) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxRate" DECIMAL(5,2) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceDeliveryNote" (
  "invoiceId" TEXT NOT NULL,
  "deliveryNoteId" TEXT NOT NULL,
  CONSTRAINT "InvoiceDeliveryNote_pkey" PRIMARY KEY ("invoiceId", "deliveryNoteId")
);

CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");
CREATE UNIQUE INDEX "Invoice_remoteReference_key" ON "Invoice"("remoteReference");
CREATE INDEX "Invoice_localState_nextReconciliationAt_idx" ON "Invoice"("localState", "nextReconciliationAt");
CREATE INDEX "Invoice_verifactuState_nextReconciliationAt_idx" ON "Invoice"("verifactuState", "nextReconciliationAt");
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_position_key" ON "InvoiceLine"("invoiceId", "position");
CREATE UNIQUE INDEX "InvoiceDeliveryNote_deliveryNoteId_key" ON "InvoiceDeliveryNote"("deliveryNoteId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDeliveryNote" ADD CONSTRAINT "InvoiceDeliveryNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDeliveryNote" ADD CONSTRAINT "InvoiceDeliveryNote_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
