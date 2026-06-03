import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

export interface SpecialPieceFormState {
  name: string;
  price: string;
}

export interface CustomerFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  pricePerLinearMeter: string;
  pricePerSquareMeter: string;
  minimumRate: string;
  grosorPrecio: string;
  specialPieces: SpecialPieceFormState[];
}

export interface CustomerFieldErrors {
  email?: string;
  minimumRate?: string;
  name?: string;
  pricePerLinearMeter?: string;
  pricePerSquareMeter?: string;
  specialPieces?: string;
}

interface CustomerFormStepperProps {
  duplicatedSpecialPieceIndexes: Set<number>;
  fieldErrors: CustomerFieldErrors;
  form: CustomerFormState;
  isEditing: boolean;
  isPending: boolean;
  isSpecialPiecesEditorOpen: boolean;
  mutationError: string | null;
  onClose: () => void;
  onFieldErrorsChange: (errors: CustomerFieldErrors) => void;
  onFormChange: (updater: (current: CustomerFormState) => CustomerFormState) => void;
  onSubmit: () => void;
  onToggleSpecialPiecesEditor: (next: boolean) => void;
  specialPiecesEditFilter: string;
  onSpecialPiecesEditFilterChange: (value: string) => void;
}

const steps = [
  { id: 0, label: "Contacto" },
  { id: 1, label: "Tarifas" },
  { id: 2, label: "Piezas" }
] as const;

const specialPieceDuplicateMessage = "No puede haber piezas especiales con el mismo nombre.";

export const CustomerFormStepper = ({
  duplicatedSpecialPieceIndexes,
  fieldErrors,
  form,
  isEditing,
  isPending,
  isSpecialPiecesEditorOpen,
  mutationError,
  onClose,
  onFieldErrorsChange,
  onFormChange,
  onSubmit,
  onToggleSpecialPiecesEditor,
  specialPiecesEditFilter,
  onSpecialPiecesEditFilterChange
}: CustomerFormStepperProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [isEditing]);

  const visibleEditPieces = useMemo(() => {
    const query = specialPiecesEditFilter.trim().toLowerCase();
    return form.specialPieces
      .map((piece, index) => ({ index, piece }))
      .filter(({ piece }) => piece.name.toLowerCase().includes(query));
  }, [form.specialPieces, specialPiecesEditFilter]);

  const validateStep = (stepIndex: number) => {
    const nextErrors: CustomerFieldErrors = {};

    if (stepIndex === 0) {
      if (!form.name.trim()) {
        nextErrors.name = "El nombre del cliente es obligatorio.";
      }
    }

    if (stepIndex === 1) {
      if (!form.pricePerLinearMeter.trim()) {
        nextErrors.pricePerLinearMeter = "La tarifa por metro lineal es obligatoria.";
      }

      if (!form.pricePerSquareMeter.trim()) {
        nextErrors.pricePerSquareMeter = "La tarifa por metro cuadrado es obligatoria.";
      }

      if (!form.minimumRate.trim()) {
        nextErrors.minimumRate = "El precio minimo por pieza es obligatorio.";
      }
    }

    if (stepIndex === 2 && duplicatedSpecialPieceIndexes.size > 0) {
      nextErrors.specialPieces = specialPieceDuplicateMessage;
      onToggleSpecialPiecesEditor(true);
    }

    onFieldErrorsChange({
      ...fieldErrors,
      ...nextErrors
    });

    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) {
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep <= step) {
      setStep(targetStep);
      return;
    }

    for (let index = step; index < targetStep; index += 1) {
      if (!validateStep(index)) {
        return;
      }
    }

    setStep(targetStep);
  };

  const submit = () => {
    const allValid = steps.every((currentStep) => validateStep(currentStep.id));
    if (!allValid) {
      return;
    }

    onSubmit();
  };

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col border border-neutral-300 bg-white shadow-2xl shadow-black/10 sm:min-h-0 sm:max-h-[94vh] sm:max-w-3xl">
      <div className="border-b border-neutral-300 bg-white px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--epx-accent)]">
              {isEditing ? "Editar cliente" : "Alta de cliente"}
            </p>
            <h3 className="mt-1 text-xl font-bold text-neutral-900">
              {isEditing ? "Actualizar ficha" : "Nuevo cliente"}
            </h3>
          </div>
          <button
            className="border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-600"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {steps.map((currentStep) => {
            const isActive = currentStep.id === step;
            const isDone = currentStep.id < step;
            return (
              <button
                className="flex items-center gap-3 text-left"
                key={currentStep.id}
                onClick={() => handleStepClick(currentStep.id)}
                type="button"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center border text-xs font-semibold ${
                    isActive
                      ? "border-[var(--epx-accent)] bg-[var(--epx-accent)] text-[#131313]"
                      : isDone
                        ? "border-[var(--epx-success)] bg-[var(--epx-success)] text-[#131313]"
                        : "border-neutral-300 text-neutral-500"
                   }`}
                 >
                   {currentStep.id + 1}
                 </span>
                <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${isActive ? "text-neutral-900" : "text-neutral-500"}`}>
                  {currentStep.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-neutral-200 pt-3">
          {step > 0 ? (
            <button
              className="inline-flex items-center gap-1 border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700"
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              type="button"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Atras
            </button>
          ) : null}

          {step < steps.length - 1 ? (
            <button
              className="inline-flex items-center gap-1 bg-[var(--epx-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[#131313]"
              onClick={goNext}
              type="button"
            >
              Siguiente
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              className="bg-[var(--epx-accent)] px-3 py-1.5 text-[11px] font-semibold text-[#131313]"
              disabled={isPending}
              onClick={submit}
              type="button"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {step === 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <input
                  className={`w-full border bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 ${
                    fieldErrors.name
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-neutral-300"
                  }`}
                  onChange={(event) => {
                    const value = event.target.value;
                    onFormChange((current) => ({ ...current, name: value }));
                    onFieldErrorsChange({ ...fieldErrors, name: undefined });
                  }}
                  placeholder="Nombre del cliente"
                  value={form.name}
                />
                {fieldErrors.name ? (
                  <p className="mt-2 text-sm text-red-300">{fieldErrors.name}</p>
                ) : null}
              </div>

              <input
                className="border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="Telefono"
                value={form.phone}
              />
              <div>
                <input
                  className={`w-full border bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 ${
                    fieldErrors.email
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-neutral-300"
                  }`}
                  onChange={(event) => {
                    const value = event.target.value;
                    onFormChange((current) => ({ ...current, email: value }));
                    onFieldErrorsChange({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="Email"
                  value={form.email}
                />
                {fieldErrors.email ? (
                  <p className="mt-2 text-sm text-red-300">{fieldErrors.email}</p>
                ) : null}
              </div>

              <input
                className="sm:col-span-2 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="Direccion"
                value={form.address}
              />

              <textarea
                className="sm:col-span-2 min-h-28 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas internas"
                value={form.notes}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { key: "pricePerLinearMeter", label: "Tarifa por metro lineal", suffix: "€/ml" },
                { key: "pricePerSquareMeter", label: "Tarifa por metro cuadrado", suffix: "€/m²" },
                { key: "minimumRate", label: "Precio minimo por pieza", suffix: "€" }
              ] as const).map((field) => (
                <div
                  className={`border px-4 py-4 ${
                    fieldErrors[field.key]
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-neutral-300 bg-white"
                  }`}
                  key={field.key}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    {field.label}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <input
                      className="w-full bg-transparent text-3xl font-bold text-neutral-900 outline-none"
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = event.target.value;
                        onFormChange((current) => ({
                          ...current,
                          [field.key]: value
                        }));
                        onFieldErrorsChange({ ...fieldErrors, [field.key]: undefined });
                      }}
                      value={form[field.key]}
                    />
                    <span className="pb-1 text-sm font-semibold text-[var(--epx-accent)]">
                      {field.suffix}
                    </span>
                  </div>
                  {fieldErrors[field.key] ? (
                    <p className="mt-3 text-sm text-red-300">{fieldErrors[field.key]}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="border border-neutral-300 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Suplemento por grosor
              </p>
              <input
                className="mt-3 w-full bg-transparent text-2xl font-bold text-neutral-900 outline-none"
                inputMode="decimal"
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    grosorPrecio: event.target.value
                  }))
                }
                placeholder="0"
                value={form.grosorPrecio}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--epx-accent)]">
                    Piezas especiales
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-900">
                    Catalogo rapido del cliente
                  </h4>
                </div>
                <button
                  className="inline-flex items-center gap-2 border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.12)] px-3 py-2 text-sm font-semibold text-neutral-900"
                  onClick={() => {
                    onFormChange((current) => ({
                      ...current,
                      specialPieces: [{ name: "", price: "" }, ...current.specialPieces]
                    }));
                    onToggleSpecialPiecesEditor(true);
                    onFieldErrorsChange({ ...fieldErrors, specialPieces: undefined });
                  }}
                  type="button"
                >
                  <PlusIcon className="h-4 w-4" />
                  Anadir pieza
                </button>
              </div>

              <div className="mt-4">
                <button
                  className="flex w-full items-center justify-between border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-semibold text-neutral-900"
                  onClick={() => onToggleSpecialPiecesEditor(!isSpecialPiecesEditorOpen)}
                  type="button"
                >
                  <span>
                    {form.specialPieces.length
                      ? `${form.specialPieces.length} piezas cargadas`
                      : "Abrir editor de piezas"}
                  </span>
                  <ChevronRightIcon
                    className={`h-4 w-4 transition-transform ${
                      isSpecialPiecesEditorOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {isSpecialPiecesEditorOpen ? (
                  <div className="mt-3 space-y-3">
                    {form.specialPieces.length > 8 ? (
                      <input
                        className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                        onChange={(event) => onSpecialPiecesEditFilterChange(event.target.value)}
                        placeholder="Buscar pieza..."
                        value={specialPiecesEditFilter}
                      />
                    ) : null}

                    {visibleEditPieces.map(({ piece, index }) => (
                      <div
                        className="grid gap-3 border border-neutral-300 bg-white p-3 sm:grid-cols-[1fr_160px_auto]"
                        key={`piece-${index}`}
                      >
                        <input
                          className={`border bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 ${
                            duplicatedSpecialPieceIndexes.has(index)
                              ? "border-red-500/60 bg-red-500/10"
                              : "border-neutral-300"
                          }`}
                          onChange={(event) => {
                            const value = event.target.value;
                            onFormChange((current) => ({
                              ...current,
                              specialPieces: current.specialPieces.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, name: value } : entry
                              )
                            }));
                            onFieldErrorsChange({ ...fieldErrors, specialPieces: undefined });
                          }}
                          placeholder="Nombre de pieza"
                          value={piece.name}
                        />
                        <div className="border border-neutral-300 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                            Precio fijo
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                              inputMode="decimal"
                              onChange={(event) => {
                                const value = event.target.value;
                                onFormChange((current) => ({
                                  ...current,
                                  specialPieces: current.specialPieces.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, price: value } : entry
                                  )
                                }));
                                onFieldErrorsChange({ ...fieldErrors, specialPieces: undefined });
                              }}
                              placeholder="0.00"
                              value={piece.price}
                            />
                            <span className="text-sm font-semibold text-[var(--epx-accent)]">€</span>
                          </div>
                        </div>
                        <button
                          className="inline-flex items-center justify-center border border-red-500/20 bg-red-500/10 px-3 py-3 text-red-200"
                          onClick={() =>
                            onFormChange((current) => ({
                              ...current,
                              specialPieces: current.specialPieces.filter(
                                (_, entryIndex) => entryIndex !== index
                              )
                            }))
                          }
                          type="button"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>

                        {duplicatedSpecialPieceIndexes.has(index) ? (
                          <p className="sm:col-span-3 text-sm text-red-300">
                            {specialPieceDuplicateMessage}
                          </p>
                        ) : null}
                      </div>
                    ))}

                    {!form.specialPieces.length ? (
                      <div className="border border-dashed border-[var(--epx-accent)]/30 bg-white px-4 py-5 text-sm text-neutral-500">
                        No hay piezas especiales cargadas todavia.
                      </div>
                    ) : null}

                    {fieldErrors.specialPieces && duplicatedSpecialPieceIndexes.size === 0 ? (
                      <p className="text-sm text-red-300">{fieldErrors.specialPieces}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {mutationError ? (
              <p className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {mutationError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
