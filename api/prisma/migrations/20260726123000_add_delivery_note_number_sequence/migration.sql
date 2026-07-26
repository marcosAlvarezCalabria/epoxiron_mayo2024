CREATE TABLE "DeliveryNoteNumberSequence" (
    "year" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL,

    CONSTRAINT "DeliveryNoteNumberSequence_pkey" PRIMARY KEY ("year")
);

INSERT INTO "DeliveryNoteNumberSequence" ("year", "lastSequence")
SELECT
    CAST(SUBSTRING("number" FROM 5 FOR 4) AS INTEGER),
    MAX(CAST(SUBSTRING("number" FROM 10) AS INTEGER))
FROM "DeliveryNote"
WHERE "number" ~ '^ALB-[0-9]{4}-[0-9]+$'
GROUP BY CAST(SUBSTRING("number" FROM 5 FOR 4) AS INTEGER);
