import {
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculatePricePreview } from "@/application/use-cases";
import { RalColorPicker } from "@/components/delivery-notes/RalColorPicker";
import type { Customer, DeliveryNoteItemDraft } from "@/domain/entities";
import { estimateDeliveryNoteItemPrice } from "@/lib/pricing";

export interface DeliveryNoteItemFormState {
  hasThickness: boolean;
  hasPrimer: boolean;
  saveAsSpecialPiece: boolean;
  description: string;
  color: string;
  linearMeters: string;
  quantity: string;
  squareMeters: string;
}

interface DeliveryNoteItemFieldErrors {
  color?: string;
  description?: string;
}

interface PricePreviewState {
  totalPrice: number;
  unitPrice: number;
}

interface ItemFormSheetProps {
  availableTemplates: string[];
  customer: Customer | null;
  customerId: string;
  initialItem: DeliveryNoteItemFormState;
  isOpen: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (item: DeliveryNoteItemFormState) => void;
}

const emptyErrors: DeliveryNoteItemFieldErrors = {};

const normalizeDecimalValue = (value: string) => value.trim().replace(",", ".");

const parseOptionalNumber = (value: string) => {
  const normalized = normalizeDecimalValue(value);
  return normalized ? Number.parseFloat(normalized) : null;
};

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  color: item.color.trim(),
  description: item.description.trim(),
  linearMeters: parseOptionalNumber(item.linearMeters),
  primer: item.hasPrimer,
  quantity: Number.parseInt(item.quantity || "1", 10),
  saveAsSpecialPiece: item.saveAsSpecialPiece,
  squareMeters: parseOptionalNumber(item.squareMeters),
  thickness: item.hasThickness ? 1 : null
});

export const ItemFormSheet = ({
  availableTemplates,
  customer,
  customerId,
  initialItem,
  isOpen,
  mode,
  onClose,
  onSave
}: ItemFormSheetProps) => {
  const [item, setItem] = useState<DeliveryNoteItemFormState>(initialItem);
  const [fieldErrors, setFieldErrors] = useState<DeliveryNoteItemFieldErrors>(emptyErrors);
  const [preview, setPreview] = useState<PricePreviewState | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [openTemplatePicker, setOpenTemplatePicker] = useState(false);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setItem(initialItem);
    setFieldErrors(emptyErrors);
    setPreview(null);
    setOpenTemplatePicker(false);
  }, [initialItem, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const quantity = Number.parseInt(item.quantity || "0", 10);
    if (!customerId || !item.description.trim() || !item.color.trim() || quantity <= 0) {
      setPreview(null);
      setIsPreviewLoading(false);
      return;
    }

    const normalizedItem = normalizeItem(item);
    if (customer) {
      setPreview(estimateDeliveryNoteItemPrice(normalizedItem, customer));
    }

    const timeout = window.setTimeout(() => {
      setIsPreviewLoading(true);
      void calculatePricePreview(customerId, normalizedItem)
        .then((result) => {
          setPreview(result.pricing);
        })
        .catch(() => {
          if (customer) {
            setPreview(estimateDeliveryNoteItemPrice(normalizedItem, customer));
            return;
          }

          setPreview(null);
        })
        .finally(() => {
          setIsPreviewLoading(false);
        });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [customer, customerId, isOpen, item]);

  const selectedTemplateLabel = useMemo(
    () => availableTemplates.find((template) => template === item.description) ?? null,
    [availableTemplates, item.description]
  );

  const close = () => {
    onClose();
  };

  const handleSave = () => {
    const nextErrors: DeliveryNoteItemFieldErrors = {};

    if (!item.description.trim()) {
      nextErrors.description = "Escribe una pieza o selecciona una especial.";
    }

    if (!item.color.trim()) {
      nextErrors.color = "Selecciona un color.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSave(item);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[color:rgb(19_19_19_/_0.82)] backdrop-blur-sm">
      <button
        aria-label="Cerrar formulario de item"
        className="absolute inset-0"
        onClick={close}
        type="button"
      />

      <div className="absolute inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
        <div
          className="relative flex h-full w-full flex-col border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] shadow-2xl shadow-black/40 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl"
          onTouchEnd={(event) => {
            if (touchStartYRef.current == null) {
              return;
            }

            const distance = event.changedTouches[0]?.clientY - touchStartYRef.current;
            touchStartYRef.current = null;

            if (distance > 100) {
              close();
            }
          }}
          onTouchStart={(event) => {
            touchStartYRef.current = event.touches[0]?.clientY ?? null;
          }}
        >
          <div className="flex items-center justify-center border-b border-[var(--epx-surface-raised)] px-4 py-3 sm:hidden">
            <span className="h-1 w-10 bg-white/20" />
          </div>

          <div className="flex items-start justify-between gap-3 border-b border-[var(--epx-surface-raised)] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                {mode === "create" ? "Nuevo item" : "Editar item"}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                {mode === "create" ? "Configura la pieza" : "Actualiza la pieza"}
              </h3>
            </div>
            <button
              className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-[var(--epx-text-muted)]"
              onClick={close}
              type="button"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-[var(--epx-surface-raised)] bg-[color:rgb(255_149_0_/_0.1)] px-5 py-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
              Precio calculado
            </p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-3xl font-bold text-white">
                {preview ? `${preview.totalPrice.toFixed(2)} €` : "—"}
              </p>
              {isPreviewLoading ? (
                <span className="text-sm text-[var(--epx-accent)]">Calculando...</span>
              ) : null}
            </div>
            {preview ? (
              <p className="mt-1 text-sm text-[var(--epx-text-muted)]">
                Unitario {preview.unitPrice.toFixed(2)} €
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div>
              <input
                className={`w-full border px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--epx-text-muted)] ${
                  fieldErrors.description
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]"
                }`}
                onChange={(event) => {
                  const value = event.target.value;
                  setItem((current) => ({ ...current, description: value }));
                  setFieldErrors((current) => ({ ...current, description: undefined }));
                }}
                placeholder="Descripcion de la pieza"
                value={item.description}
              />
              {fieldErrors.description ? (
                <p className="mt-2 text-sm text-red-300">{fieldErrors.description}</p>
              ) : null}
            </div>

            {availableTemplates.length ? (
              <div className="space-y-3 border border-[var(--epx-accent)]/25 bg-[color:rgb(255_149_0_/_0.08)] p-3">
                <button
                  className="flex w-full items-center justify-between border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-3 text-left text-sm font-semibold text-white"
                  onClick={() => setOpenTemplatePicker((current) => !current)}
                  type="button"
                >
                  <span>
                    {selectedTemplateLabel ? `Pieza especial: ${selectedTemplateLabel}` : "Piezas especiales"}
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 transition-transform ${openTemplatePicker ? "rotate-180" : ""}`}
                  />
                </button>

                {openTemplatePicker ? (
                  <div className="overflow-hidden border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)]">
                    {availableTemplates.map((template) => (
                      <button
                        className={`flex w-full items-center justify-between border-b border-[var(--epx-surface-raised)] px-4 py-3 text-left text-sm last:border-b-0 ${
                          item.description === template
                            ? "bg-[color:rgb(255_149_0_/_0.16)] text-white"
                            : "text-[var(--epx-text-muted)] hover:bg-white/5"
                        }`}
                        key={template}
                        onClick={() => {
                          setItem((current) => ({ ...current, description: template }));
                          setOpenTemplatePicker(false);
                        }}
                        type="button"
                      >
                        <span>{template}</span>
                        {item.description === template ? (
                          <span className="text-xs font-semibold text-[var(--epx-accent)]">
                            Seleccionada
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <RalColorPicker
                onChange={(color) => {
                  setItem((current) => ({ ...current, color }));
                  setFieldErrors((current) => ({ ...current, color: undefined }));
                }}
                value={item.color}
              />
              {fieldErrors.color ? (
                <p className="mt-2 text-sm text-red-300">{fieldErrors.color}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr]">
              <div className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                  Cantidad
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    className="border border-[var(--epx-surface-raised)] p-2 text-[var(--epx-text-muted)]"
                    onClick={() =>
                      setItem((current) => ({
                        ...current,
                        quantity: Math.max(
                          1,
                          Number.parseInt(current.quantity || "1", 10) - 1
                        ).toString()
                      }))
                    }
                    type="button"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-bold text-white">{item.quantity}</span>
                  <button
                    className="border border-[var(--epx-surface-raised)] p-2 text-[var(--epx-text-muted)]"
                    onClick={() =>
                      setItem((current) => ({
                        ...current,
                        quantity: (Number.parseInt(current.quantity || "1", 10) + 1).toString()
                      }))
                    }
                    type="button"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {([
                { key: "linearMeters", label: "Metros lineales", placeholder: "0" },
                { key: "squareMeters", label: "Metros cuadrados", placeholder: "0" }
              ] as const).map((field) => (
                <label
                  className="border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3"
                  key={field.key}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                    {field.label}
                  </span>
                  <input
                    className="mt-3 w-full bg-transparent text-lg font-semibold text-white outline-none"
                    inputMode="decimal"
                    onChange={(event) =>
                      setItem((current) => ({
                        ...current,
                        [field.key]: event.target.value
                      }))
                    }
                    placeholder={field.placeholder}
                    value={item[field.key]}
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { key: "hasThickness", label: "Grosor" },
                { key: "hasPrimer", label: "Imprimacion" },
                { key: "saveAsSpecialPiece", label: "Guardar como especial" }
              ] as const).map((toggle) => (
                <button
                  className={`flex items-center justify-between border px-4 py-4 text-left text-sm font-semibold ${
                    item[toggle.key]
                      ? "border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.16)] text-white"
                      : "border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] text-[var(--epx-text-muted)]"
                  }`}
                  key={toggle.key}
                  onClick={() =>
                    setItem((current) => ({
                      ...current,
                      [toggle.key]: !current[toggle.key]
                    }))
                  }
                  type="button"
                >
                  <span>{toggle.label}</span>
                  <span
                    className={`relative inline-flex h-6 w-11 items-center ${
                      item[toggle.key] ? "bg-[var(--epx-accent)]" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform bg-white transition-transform ${
                        item[toggle.key] ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-[var(--epx-surface-raised)] bg-[color:rgb(28_27_27_/_0.96)] px-5 py-4 backdrop-blur sm:px-6">
            <button
              className="w-full bg-[var(--epx-accent)] px-4 py-4 text-sm font-semibold text-[#131313]"
              onClick={handleSave}
              type="button"
            >
              Guardar item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
