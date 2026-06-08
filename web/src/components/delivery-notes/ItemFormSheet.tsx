import {
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculatePricePreview } from "@/application/use-cases";
import { RalColorPicker } from "@/components/delivery-notes/RalColorPicker";
import type { Customer, DeliveryNoteItemDraft, DeliveryNoteTexture } from "@/domain/entities";
import {
  parseMillimetersToMeters,
  parseSquareMillimetersToSquareMeters
} from "@/lib/measurements";
import { estimateDeliveryNoteItemPrice, resolvePricePreview } from "@/lib/pricing";

export interface DeliveryNoteItemFormState {
  hasThickness: boolean;
  hasPrimer: boolean;
  saveAsSpecialPiece: boolean;
  description: string;
  color: string;
  texture: DeliveryNoteTexture;
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

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  color: item.color.trim(),
  description: item.description.trim(),
  linearMeters: parseMillimetersToMeters(item.linearMeters),
  primer: item.hasPrimer,
  quantity: Number.parseInt(item.quantity || "1", 10),
  saveAsSpecialPiece: item.saveAsSpecialPiece,
  squareMeters: parseSquareMillimetersToSquareMeters(item.squareMeters),
  texture: item.texture,
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
  const previewRequestIdRef = useRef(0);

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
    if (!customerId || quantity <= 0) {
      previewRequestIdRef.current += 1;
      setPreview(null);
      setIsPreviewLoading(false);
      return;
    }

    const normalizedItem = normalizeItem(item);
    const fallbackPreview = customer ? estimateDeliveryNoteItemPrice(normalizedItem, customer) : null;
    if (fallbackPreview) {
      setPreview(fallbackPreview);
    }

    if (!item.description.trim() || !item.color.trim()) {
      previewRequestIdRef.current += 1;
      setIsPreviewLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      const requestId = previewRequestIdRef.current + 1;
      previewRequestIdRef.current = requestId;
      setIsPreviewLoading(true);
      void calculatePricePreview(customerId, normalizedItem)
        .then((result) => {
          if (previewRequestIdRef.current !== requestId) {
            return;
          }
          setPreview(resolvePricePreview(result.pricing, fallbackPreview));
        })
        .catch(() => {
          if (previewRequestIdRef.current !== requestId) {
            return;
          }
          setPreview(fallbackPreview);
        })
        .finally(() => {
          if (previewRequestIdRef.current !== requestId) {
            return;
          }
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
      <div className="absolute inset-0" />

      <div className="absolute inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
        <div className="relative flex h-full w-full flex-col border border-neutral-300 bg-white shadow-2xl shadow-black/10 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl">
          <div className="flex items-center justify-center border-b border-neutral-300 px-4 py-3 sm:hidden">
            <span className="h-1 w-10 bg-neutral-300" />
          </div>

          <div className="flex items-start justify-between gap-3 border-b border-neutral-300 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                {mode === "create" ? "Nuevo item" : "Editar item"}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-neutral-900">
                {mode === "create" ? "Configura la pieza" : "Actualiza la pieza"}
              </h3>
            </div>
            <button
              className="border border-neutral-300 bg-white px-3 py-2 text-neutral-600"
              onClick={close}
              type="button"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-neutral-300 bg-[color:rgb(255_149_0_/_0.06)] px-5 py-3 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Precio calculado
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-xl font-bold text-neutral-900 sm:text-2xl">
                {preview ? `${preview.totalPrice.toFixed(2)} €` : "—"}
              </p>
              {isPreviewLoading ? (
                <span className="text-xs text-[var(--epx-accent)]">Calculando...</span>
              ) : null}
            </div>
            {preview ? (
                <p className="mt-0.5 text-xs text-neutral-500">
                Base viva · Unitario {preview.unitPrice.toFixed(2)} €
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div>
              <input
                className={`w-full border bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 ${
                  fieldErrors.description
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-neutral-300"
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
                  className="flex w-full items-center justify-between border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-3 text-left text-sm font-semibold text-neutral-900"
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
                  <div className="overflow-hidden border border-neutral-300 bg-white">
                    {availableTemplates.map((template) => (
                      <button
                          className={`flex w-full items-center justify-between border-b border-neutral-300 px-4 py-3 text-left text-sm last:border-b-0 ${
                            item.description === template
                            ? "bg-[color:rgb(255_149_0_/_0.16)] text-neutral-900"
                            : "text-neutral-600 hover:bg-neutral-50"
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
                onTextureChange={(texture) =>
                  setItem((current) => ({
                    ...current,
                    texture
                  }))
                }
                texture={item.texture}
                value={item.color}
              />
              {fieldErrors.color ? (
                <p className="mt-2 text-sm text-red-300">{fieldErrors.color}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[160px_1fr_1fr]">
              <div className="border border-neutral-300 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Cantidad
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    className="border border-neutral-300 bg-white p-2 text-neutral-600"
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
                  <span className="text-lg font-bold text-neutral-900">{item.quantity}</span>
                  <button
                    className="border border-neutral-300 bg-white p-2 text-neutral-600"
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
                { key: "linearMeters", label: "Milimetros lineales", placeholder: "0" },
                { key: "squareMeters", label: "Milimetros cuadrados", placeholder: "0" }
              ] as const).map((field) => (
                <label
                  className="border border-neutral-300 bg-white px-4 py-3"
                  key={field.key}
                >
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    {field.label}
                  </span>
                  <input
                    className="mt-3 w-full bg-transparent text-lg font-semibold text-neutral-900 outline-none"
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
                      ? "border-[var(--epx-accent)]/35 bg-[color:rgb(255_149_0_/_0.16)] text-neutral-900"
                      : "border-neutral-300 bg-white text-neutral-600"
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
                      item[toggle.key] ? "bg-[var(--epx-accent)]" : "bg-neutral-300"
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

          <div className="sticky bottom-0 border-t border-neutral-300 bg-white px-5 py-4 sm:px-6">
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
