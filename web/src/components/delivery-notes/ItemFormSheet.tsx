import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculatePricePreview } from "@/application/use-cases";
import { RalColorPicker } from "@/components/delivery-notes/RalColorPicker";
import type {
  Customer,
  DeliveryNoteItemDraft,
  DeliveryNotePricingMode,
  DeliveryNoteTexture
} from "@/domain/entities";
import {
  inferEmbeddedColorAndTexture,
  normalizeDeliveryNoteDescriptionInput,
  normalizeSpecialPieceName
} from "@/lib/deliveryNoteItemDescription";
import {
  parseMeters,
  parseMetersSquared
} from "@/lib/measurements";
import { estimateDeliveryNoteItemPrice, resolvePricePreview } from "@/lib/pricing";

export interface DeliveryNoteItemFormState {
  hasThickness: boolean;
  hasPrimer: boolean;
  saveAsSpecialPiece: boolean;
  customUnitPrice: string;
  description: string;
  color: string;
  pricingMode: DeliveryNotePricingMode;
  texture: DeliveryNoteTexture;
  linearMeters: string;
  quantity: string;
  squareMeters: string;
}

interface DeliveryNoteItemFieldErrors {
  color?: string;
  customUnitPrice?: string;
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
const quantityOptions = Array.from({ length: 200 }, (_, index) => index + 1);
const quantityWheelItemHeight = 34;

const parseDecimal = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  return normalized ? Number.parseFloat(normalized) : null;
};

const clampQuantity = (value: string) => {
  const parsed = Number.parseInt(value || "1", 10);
  return Math.min(quantityOptions.length, Math.max(1, parsed)).toString();
};

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  color: item.color.trim(),
  customUnitPrice: parseDecimal(item.customUnitPrice),
  description: normalizeDeliveryNoteDescriptionInput(item.description),
  linearMeters: parseMeters(item.linearMeters),
  pricingMode: item.pricingMode,
  primer: item.hasPrimer,
  quantity: Number.parseInt(item.quantity || "1", 10),
  saveAsSpecialPiece: item.saveAsSpecialPiece,
  squareMeters: parseMetersSquared(item.squareMeters),
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
  const [templateSearch, setTemplateSearch] = useState("");
  const [showAllSpecialPieces, setShowAllSpecialPieces] = useState(false);
  const [isQuantityInputFocused, setIsQuantityInputFocused] = useState(false);
  const previewRequestIdRef = useRef(0);
  const quantityWheelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setItem(initialItem);
    setFieldErrors(emptyErrors);
    setPreview(null);
    setTemplateSearch("");
    setShowAllSpecialPieces(false);
  }, [initialItem, isOpen]);

  useEffect(() => {
    if (!isOpen || isQuantityInputFocused) {
      return;
    }

    const quantity = Number.parseInt(clampQuantity(item.quantity), 10);
    quantityWheelRef.current?.scrollTo({
      top: (quantity - 1) * quantityWheelItemHeight,
      behavior: "auto"
    });
  }, [isOpen, isQuantityInputFocused, item.quantity]);

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
  const filteredSpecialPieces = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();
    const pieces = customer?.specialPieces ?? [];

    if (showAllSpecialPieces) {
      return pieces;
    }

    if (!search) {
      return [];
    }

    return pieces.filter((piece) => piece.name.toLowerCase().includes(search));
  }, [customer?.specialPieces, showAllSpecialPieces, templateSearch]);
  const hasTypedTemplateSearch = templateSearch.trim().length > 0;
  const shouldShowSpecialPieceResults = showAllSpecialPieces || hasTypedTemplateSearch;

  const close = () => {
    onClose();
  };

  const handleSave = () => {
    const nextErrors: DeliveryNoteItemFieldErrors = {};
    const matchedSpecialPiece = customer?.specialPieces.find(
      (piece) => normalizeSpecialPieceName(piece.name) === normalizeSpecialPieceName(item.description)
    );

    if (!item.description.trim()) {
      nextErrors.description = "Escribe una pieza o selecciona una especial.";
    }

    if (!item.color.trim()) {
      nextErrors.color = "Selecciona un color.";
    }

    if (item.pricingMode === "UNIT" && !item.customUnitPrice.trim() && !matchedSpecialPiece) {
      nextErrors.customUnitPrice = "Indica un precio por unidad o usa una pieza especial existente.";
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

          <div className="border-b border-neutral-300 bg-[color:rgb(255_149_0_/_0.06)] px-5 py-1.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
              <span className="font-semibold uppercase tracking-[0.16em]">
                Precio
              </span>
              <span className="text-neutral-300">|</span>
              <span className="text-base font-bold text-neutral-900">
                {preview ? `${preview.totalPrice.toFixed(2)} €` : "—"}
              </span>
              <span className="text-neutral-300">|</span>
              <span>{item.pricingMode === "UNIT" ? "Unidad" : "M/M2"}</span>
              {preview ? (
                <>
                  <span className="text-neutral-300">|</span>
                  <span className="text-neutral-500">Unitario {preview.unitPrice.toFixed(2)} €</span>
                </>
              ) : null}
              {isPreviewLoading ? (
                <>
                  <span className="text-neutral-300">|</span>
                  <span className="font-medium text-[var(--epx-accent)]">Calculando</span>
                </>
              ) : null}
            </div>
            <div className="hidden">
              <p className="text-xl font-bold text-neutral-900 sm:text-2xl">
                {preview ? `${preview.totalPrice.toFixed(2)} €` : "—"}
              </p>
              {isPreviewLoading ? (
                <span className="text-xs text-[var(--epx-accent)]">Calculando...</span>
              ) : null}
            </div>
            {preview ? (
                <p className="hidden">
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
                  setItem((current) => ({ ...current, description: event.target.value }));
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
                <div className="flex items-center justify-between gap-3 border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-3">
                  <span className="text-sm font-semibold text-neutral-900">
                    {selectedTemplateLabel ? `Pieza especial seleccionada: ${selectedTemplateLabel}` : "Buscador de piezas especiales"}
                  </span>
                  <button
                    className="border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700"
                    onClick={() => {
                      setShowAllSpecialPieces((current) => !current);
                      setTemplateSearch("");
                    }}
                    type="button"
                  >
                    {showAllSpecialPieces
                      ? "Ocultar"
                      : `${customer?.specialPieces.length ?? 0} piezas`}
                  </button>
                </div>

                <div className="space-y-3 border border-neutral-300 bg-white p-3">
                    <input
                      className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                      onChange={(event) => {
                        setTemplateSearch(event.target.value);
                        setShowAllSpecialPieces(false);
                      }}
                      placeholder="Buscar pieza especial del cliente"
                      value={templateSearch}
                    />

                    {shouldShowSpecialPieceResults ? (
                      <div className="max-h-64 overflow-y-auto border border-neutral-300">
                        {filteredSpecialPieces.length ? filteredSpecialPieces.map((piece) => (
                        <button
                          className={`flex w-full items-center justify-between border-b border-neutral-300 px-4 py-3 text-left text-sm last:border-b-0 ${
                            item.description === piece.name
                              ? "bg-[color:rgb(255_149_0_/_0.16)] text-neutral-900"
                              : "text-neutral-600 hover:bg-neutral-50"
                          }`}
                          key={piece.id ?? piece.name}
                          onClick={() => {
                            const inferred = inferEmbeddedColorAndTexture(piece.name);
                            setItem((current) => ({
                              ...current,
                              color: inferred.color ?? current.color,
                              customUnitPrice: piece.price.toString(),
                              description: piece.name,
                              pricingMode: "UNIT",
                              texture: inferred.texture ?? current.texture
                            }));
                            setShowAllSpecialPieces(false);
                            setTemplateSearch("");
                          }}
                          type="button"
                        >
                          <span className="min-w-0 flex-1 pr-3">{piece.name}</span>
                          <span className="shrink-0 text-xs text-neutral-500">
                            {piece.price.toFixed(2)} €
                          </span>
                          {item.description === piece.name ? (
                            <span className="ml-3 shrink-0 text-xs font-semibold text-[var(--epx-accent)]">
                              Seleccionada
                            </span>
                          ) : null}
                        </button>
                        )) : (
                          <div className="px-4 py-6 text-sm text-neutral-500">
                            No hay piezas especiales que coincidan con la busqueda.
                          </div>
                        )}
                      </div>
                    ) : null}
                </div>
                <p className="text-xs text-neutral-600">
                  Si eliges una pieza especial, el sistema usa su precio por unidad y no calcula por M o M2.
                </p>
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
                <div className="mt-3">
                  <div className="mx-auto w-16">
                    <div className="relative overflow-hidden rounded-[18px] border border-neutral-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,244,241,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(19,19,19,0.05)]">
                      {isQuantityInputFocused ? (
                        <div
                          className="flex items-center justify-center"
                          style={{ height: `${quantityWheelItemHeight}px` }}
                        >
                          <input
                            autoFocus
                            className="w-full bg-transparent px-1 text-center text-lg font-bold text-neutral-950 outline-none"
                            inputMode="numeric"
                            onBlur={() => {
                              setItem((current) => ({
                                ...current,
                                quantity: clampQuantity(current.quantity)
                              }));
                              setIsQuantityInputFocused(false);
                            }}
                            onChange={(event) => {
                              const digitsOnly = event.target.value.replace(/\D/g, "");
                              setItem((current) => ({
                                ...current,
                                quantity: digitsOnly || ""
                              }));
                            }}
                            value={item.quantity}
                          />
                        </div>
                      ) : (
                        <>
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-2 top-1/2 z-10 rounded-xl border border-[var(--epx-accent)]/20 bg-[color:rgb(255_149_0_/_0.14)] shadow-[0_8px_18px_rgba(255,149,0,0.10)]"
                            style={{
                              height: `${quantityWheelItemHeight}px`,
                              transform: "translateY(-50%)"
                            }}
                          />
                          <div
                            className="overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            onScroll={(event) => {
                              const nextValue =
                                Math.round(event.currentTarget.scrollTop / quantityWheelItemHeight) + 1;
                              const clampedValue = Math.min(
                                quantityOptions.length,
                                Math.max(1, nextValue)
                              );

                              setItem((current) =>
                                current.quantity === clampedValue.toString()
                                  ? current
                                  : { ...current, quantity: clampedValue.toString() }
                              );
                            }}
                            ref={quantityWheelRef}
                            style={{
                              height: `${quantityWheelItemHeight}px`,
                              scrollSnapType: "y mandatory"
                            }}
                          >
                            {quantityOptions.map((quantityOption) => {
                              const isSelected = item.quantity === quantityOption.toString();

                              return (
                                <button
                                  className={`relative z-20 flex w-full items-center justify-center text-center transition-all ${
                                    isSelected
                                      ? "text-lg font-bold text-neutral-950"
                                      : "text-base font-medium text-neutral-400"
                                  }`}
                                  key={quantityOption}
                                  onClick={() => {
                                    setItem((current) => ({
                                      ...current,
                                      quantity: quantityOption.toString()
                                    }));
                                    setIsQuantityInputFocused(true);
                                  }}
                                  style={{
                                    height: `${quantityWheelItemHeight}px`,
                                    scrollSnapAlign: "center"
                                  }}
                                  type="button"
                                >
                                  {quantityOption}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {([
                {
                  key: "pricingMode",
                  label: "Modo de precio"
                },
                { key: "linearMeters", label: "Metros lineales", placeholder: "0" },
                { key: "squareMeters", label: "Metros cuadrados", placeholder: "0" }
              ] as const).map((field) =>
                field.key === "pricingMode" ? (
                  <div className="border border-neutral-300 bg-white px-4 py-3" key={field.key}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                          {field.label}
                        </span>
                      </div>
                      <div className="inline-flex rounded-full border border-neutral-300 bg-neutral-100 p-1">
                        {([
                          { label: "M/M2", value: "DIMENSIONS" },
                          { label: "Unidad", value: "UNIT" }
                        ] as const).map((option) => (
                          <button
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                              item.pricingMode === option.value
                                ? "bg-[var(--epx-accent)] text-[#131313]"
                                : "text-neutral-600"
                            }`}
                            key={option.value}
                            onClick={() =>
                              setItem((current) => ({
                                ...current,
                                pricingMode: option.value
                              }))
                            }
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : item.pricingMode === "UNIT" && field.key !== "linearMeters" ? (
                  <label
                    className="border border-neutral-300 bg-white px-4 py-3"
                    key={field.key}
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Precio por unidad
                    </span>
                    <input
                      className={`mt-3 w-full bg-transparent text-lg font-semibold text-neutral-900 outline-none ${
                        fieldErrors.customUnitPrice ? "text-red-500" : ""
                      }`}
                      inputMode="decimal"
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          customUnitPrice: event.target.value
                        }))
                      }
                      placeholder="0"
                      value={item.customUnitPrice}
                    />
                    {fieldErrors.customUnitPrice ? (
                      <p className="mt-2 text-sm text-red-300">{fieldErrors.customUnitPrice}</p>
                    ) : null}
                  </label>
                ) : item.pricingMode === "UNIT" ? null : (
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
                )
              )}
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
