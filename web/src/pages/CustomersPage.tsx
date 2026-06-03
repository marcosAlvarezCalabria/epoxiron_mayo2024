import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  createCustomer,
  deleteCustomer,
  getDeliveryNotes,
  getCustomers,
  updateCustomer
} from "@/application/use-cases";
import { ApiErrorState } from "@/components/ApiErrorState";
import {
  CustomerFormStepper,
  type CustomerFieldErrors,
  type CustomerFormState,
  type SpecialPieceFormState
} from "@/components/customers/CustomerFormStepper";
import type { Customer, CustomerInput, DeliveryNote } from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";

const emptyCustomerForm = (): CustomerFormState => ({
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  pricePerLinearMeter: "0",
  pricePerSquareMeter: "0",
  minimumRate: "0",
  grosorPrecio: "",
  specialPieces: []
});

const customerToFormState = (customer: Customer): CustomerFormState => ({
  name: customer.name,
  email: customer.email ?? "",
  phone: customer.phone ?? "",
  address: customer.address ?? "",
  notes: customer.notes ?? "",
  pricePerLinearMeter: customer.pricePerLinearMeter.toString(),
  pricePerSquareMeter: customer.pricePerSquareMeter.toString(),
  minimumRate: customer.minimumRate.toString(),
  grosorPrecio: customer.grosorPrecio?.toString() ?? "",
  specialPieces: customer.specialPieces.map((piece) => ({
    name: piece.name,
    price: piece.price.toString()
  }))
});

const toOptionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseNumber = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  return Number.parseFloat(normalized || "0");
};
const specialPieceDuplicateMessage = "No puede haber piezas especiales con el mismo nombre.";

const getCustomerFieldErrors = (error: ApiError | null): CustomerFieldErrors => {
  if (!error) {
    return {};
  }

  if (error.message === "Ya existe un cliente con ese nombre") {
    return {
      name: error.message
    };
  }

  if (error.message === "Ya existe un cliente con ese correo") {
    return {
      email: error.message
    };
  }

  if (error.message === "No puede haber piezas especiales con el mismo nombre para un cliente") {
    return {
      specialPieces: specialPieceDuplicateMessage
    };
  }

  return {};
};

const getDuplicatedSpecialPieceIndexes = (specialPieces: SpecialPieceFormState[]) => {
  const indexesByName = new Map<string, number[]>();

  specialPieces.forEach((piece, index) => {
    const normalizedName = piece.name.trim().toLowerCase();
    if (!normalizedName) {
      return;
    }

    const indexes = indexesByName.get(normalizedName) ?? [];
    indexes.push(index);
    indexesByName.set(normalizedName, indexes);
  });

  const duplicatedIndexes = new Set<number>();
  indexesByName.forEach((indexes) => {
    if (indexes.length < 2) {
      return;
    }

    indexes.forEach((index) => duplicatedIndexes.add(index));
  });

  return duplicatedIndexes;
};

const hasDuplicatedSpecialPieceNames = (specialPieces: SpecialPieceFormState[]) =>
  getDuplicatedSpecialPieceIndexes(specialPieces).size > 0;

const normalizeCustomerPayload = (form: CustomerFormState): CustomerInput => ({
  name: form.name.trim(),
  email: toOptionalText(form.email),
  phone: toOptionalText(form.phone),
  address: toOptionalText(form.address),
  notes: toOptionalText(form.notes),
  pricePerLinearMeter: parseNumber(form.pricePerLinearMeter),
  pricePerSquareMeter: parseNumber(form.pricePerSquareMeter),
  minimumRate: parseNumber(form.minimumRate),
  grosorPrecio: form.grosorPrecio.trim() ? parseNumber(form.grosorPrecio) : null,
  specialPieces: form.specialPieces
    .filter((piece) => piece.name.trim() && piece.price.trim())
    .map((piece) => ({
      name: piece.name.trim(),
      price: parseNumber(piece.price)
    }))
});

const priceTiles = [
  {
    key: "pricePerLinearMeter",
    label: "ML",
    accent: "text-[var(--epx-accent)] border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)]"
  },
  {
    key: "pricePerSquareMeter",
    label: "M2",
    accent: "text-white border-[var(--epx-surface-raised)] bg-[var(--epx-surface)]"
  },
  {
    key: "minimumRate",
    label: "Min",
    accent: "text-[var(--epx-success)] border-[var(--epx-success)]/30 bg-[color:rgb(209_255_0_/_0.12)]"
  }
] as const;

const badgeByStatus: Record<DeliveryNote["status"], string> = {
  DRAFT: "text-[var(--epx-text-muted)] bg-[var(--epx-surface)] border border-[var(--epx-surface-raised)]",
  PENDING: "text-[var(--epx-accent)] bg-[color:rgb(255_149_0_/_0.12)] border border-[var(--epx-accent)]/30",
  REVIEWED: "text-[var(--epx-success)] bg-[color:rgb(209_255_0_/_0.12)] border border-[var(--epx-success)]/30"
};

const statusLabel: Record<DeliveryNote["status"], string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  REVIEWED: "Revisado"
};

export const CustomersPage = () => {
  const initialCustomerNotesLimit = 5;
  const customerNotesPageStep = 10;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [specialPiecesReadFilter, setSpecialPiecesReadFilter] = useState("");
  const [specialPiecesEditFilter, setSpecialPiecesEditFilter] = useState("");
  const [isSpecialPiecesReadOpen, setIsSpecialPiecesReadOpen] = useState(false);
  const [isSpecialPiecesEditorOpen, setIsSpecialPiecesEditorOpen] = useState(false);
  const [customerNotesLimit, setCustomerNotesLimit] = useState(initialCustomerNotesLimit);
  const duplicatedSpecialPieceIndexes = useMemo(
    () => getDuplicatedSpecialPieceIndexes(form.specialPieces),
    [form.specialPieces]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers()
  });
  const customersQueryError = error instanceof ApiError ? error.message : null;

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return data?.customers ?? [];
    }

    return (data?.customers ?? []).filter((customer) =>
      customer.name.toLowerCase().includes(query)
    );
  }, [data?.customers, search]);

  const selectedCustomer =
    filteredCustomers.find((customer) => customer.id === selectedCustomerId) ?? null;

  useEffect(() => {
    setSpecialPiecesReadFilter("");
    setIsSpecialPiecesReadOpen(false);
  }, [selectedCustomer?.id]);

  useEffect(() => {
    setCustomerNotesLimit(initialCustomerNotesLimit);
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (isComposerOpen) {
      setSpecialPiecesEditFilter("");
    }
  }, [editingCustomerId, isComposerOpen]);

  useEffect(() => {
    if (!isComposerOpen) {
      setIsSpecialPiecesEditorOpen(false);
      return;
    }

    if (editingCustomerId || form.specialPieces.length > 0) {
      setIsSpecialPiecesEditorOpen(true);
    }
  }, [editingCustomerId, form.specialPieces.length, isComposerOpen]);

  const normalizedReadFilter = specialPiecesReadFilter.trim().toLowerCase();
  const visibleReadPieces = selectedCustomer
    ? selectedCustomer.specialPieces.filter((piece) =>
        piece.name.toLowerCase().includes(normalizedReadFilter)
      )
    : [];

  const customerNotesQuery = useQuery({
    queryKey: ["delivery-notes", "customer-detail", selectedCustomer?.id, customerNotesLimit],
    queryFn: () =>
      getDeliveryNotes({
        customerId: selectedCustomer?.id,
        limit: customerNotesLimit
    }),
    enabled: Boolean(selectedCustomer?.id)
  });

  const visibleCustomerNotes = customerNotesQuery.data?.deliveryNotes.slice(0, customerNotesLimit) ?? [];
  const customerNotesTotal = customerNotesQuery.data?.pagination.total ?? visibleCustomerNotes.length;
  const customerNotesHasMore = customerNotesTotal > visibleCustomerNotes.length;

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async (result) => {
      setForm(emptyCustomerForm());
      setFormError(null);
      setFieldErrors({});
      setIsComposerOpen(false);
      setSelectedCustomerId(result.customer.id);
      setMobilePane("detail");
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) =>
      updateCustomer(id, input),
    onSuccess: async (result) => {
      setEditingCustomerId(null);
      setForm(emptyCustomerForm());
      setFormError(null);
      setFieldErrors({});
      setIsSpecialPiecesEditorOpen(false);
      setIsComposerOpen(false);
      setSelectedCustomerId(result.customer.id);
      setMobilePane("detail");
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      setSelectedCustomerId(null);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const mutationError = useMemo(() => {
    const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error;
    return error instanceof ApiError ? error.message : null;
  }, [createMutation.error, deleteMutation.error, updateMutation.error]);

  const closeComposer = () => {
    setEditingCustomerId(null);
    setForm(emptyCustomerForm());
    setFormError(null);
    setFieldErrors({});
    setIsSpecialPiecesEditorOpen(false);
    setIsComposerOpen(false);
    setMobilePane(selectedCustomerId ? "detail" : "list");
  };

  const handleSubmit = async () => {
    setFormError(null);
    setFieldErrors({});

    if (hasDuplicatedSpecialPieceNames(form.specialPieces)) {
      setFieldErrors({
        specialPieces: specialPieceDuplicateMessage
      });
      setIsSpecialPiecesEditorOpen(true);
      return;
    }

    const payload = normalizeCustomerPayload(form);

    try {
      if (editingCustomerId) {
        await updateMutation.mutateAsync({ id: editingCustomerId, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const nextFieldErrors = getCustomerFieldErrors(error);
        if (nextFieldErrors.name || nextFieldErrors.email || nextFieldErrors.specialPieces) {
          setFieldErrors(nextFieldErrors);
          if (nextFieldErrors.specialPieces) {
            setIsSpecialPiecesEditorOpen(true);
          }
          return;
        }
      }

      return;
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--epx-text-muted)]">Clientes</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Clientes y tarifas
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--epx-text-muted)]">
            Consulta de ficha, tarifas y actividad reciente del cliente desde una
            vista unica.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-3 text-sm font-semibold text-white"
          onClick={() => {
            setSelectedCustomerId(null);
            setEditingCustomerId(null);
            setForm(emptyCustomerForm());
            setFormError(null);
            setIsSpecialPiecesEditorOpen(false);
            setMobilePane("detail");
            setIsComposerOpen(true);
          }}
          type="button"
        >
          <UserPlusIcon className="h-5 w-5" />
          Nuevo cliente
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div
          className={`space-y-4 ${
            mobilePane === "detail" ? "hidden xl:block" : "block"
          }`}
        >
          <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4">
            <input
              className="w-full rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-[var(--epx-text-muted)] focus:border-[var(--epx-accent)]/50"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente"
              value={search}
            />
          </div>

          <div className="space-y-3">
            {customersQueryError ? (
              <ApiErrorState message={customersQueryError} title="Error al cargar clientes" />
            ) : null}

            {isLoading ? (
              <p className="text-sm text-[var(--epx-text-muted)]">Cargando clientes...</p>
            ) : null}

            {filteredCustomers.map((customer) => (
              <button
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  selectedCustomer?.id === customer.id
                    ? "border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.12)]"
                    : "border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] hover:border-[var(--epx-accent)]/30"
                }`}
                key={customer.id}
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setMobilePane("detail");
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {customer.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--epx-text-muted)]">
                      {customer.phone ?? customer.email ?? "Sin contacto"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--epx-bg)] px-3 py-1 text-xs font-semibold text-[var(--epx-text-muted)]">
                    {customer.specialPieces.length} piezas
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-3 py-1 text-[var(--epx-accent)]">
                    ML {customer.pricePerLinearMeter.toFixed(2)} €
                  </span>
                  <span className="rounded-full border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-1 text-white">
                    M2 {customer.pricePerSquareMeter.toFixed(2)} €
                  </span>
                </div>
              </button>
            ))}

            {!isLoading && filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--epx-surface-raised)] p-5 text-sm text-[var(--epx-text-muted)]">
                No hay clientes que coincidan con la busqueda.
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`space-y-4 ${
            mobilePane === "list" ? "hidden xl:block" : "block"
          }`}
        >
          {selectedCustomer ? (
            <article className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
              <button
                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-2 text-sm font-semibold text-white xl:hidden"
                onClick={() => setMobilePane("list")}
                type="button"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver a la lista
              </button>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--epx-text-muted)]">Cliente seleccionado</p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {selectedCustomer.name}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--epx-text-muted)]">
                    {selectedCustomer.address ?? "Sin direccion"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    className="rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => {
                      setEditingCustomerId(selectedCustomer.id);
                      setForm(customerToFormState(selectedCustomer));
                      setFormError(null);
                      setIsSpecialPiecesEditorOpen(true);
                      setMobilePane("detail");
                      setIsComposerOpen(true);
                    }}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
                    onClick={() => {
                      if (window.confirm(`Eliminar a ${selectedCustomer.name}?`)) {
                        deleteMutation.mutate(selectedCustomer.id);
                      }
                    }}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {priceTiles.map((tile) => (
                  <div
                    className={`rounded-2xl border p-4 ${tile.accent}`}
                    key={tile.key}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">
                      {tile.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {selectedCustomer[tile.key].toFixed(2)} €
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Contacto
                  </p>
                  <p className="mt-3 text-sm text-white">
                    {selectedCustomer.email ?? "Sin email"}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    {selectedCustomer.phone ?? "Sin telefono"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">
                        Piezas especiales
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Solo se muestran si quieres desplegarlas.
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {selectedCustomer.specialPieces.length} piezas
                    </span>
                  </div>

                  <button
                    className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-left text-sm font-semibold text-white"
                    onClick={() => setIsSpecialPiecesReadOpen((current) => !current)}
                    type="button"
                  >
                    <span>
                      {selectedCustomer.specialPieces.length
                        ? "Ver piezas especiales"
                        : "Sin piezas especiales"}
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${
                        isSpecialPiecesReadOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isSpecialPiecesReadOpen && selectedCustomer.specialPieces.length > 0 ? (
                    <div className="mt-3">
                      <input
                        className="w-full rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-3 text-sm text-white placeholder:text-[var(--epx-text-muted)]"
                        onChange={(event) => setSpecialPiecesReadFilter(event.target.value)}
                        placeholder="Buscar pieza..."
                        value={specialPiecesReadFilter}
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleReadPieces.length ? (
                          visibleReadPieces.map((piece, index) => (
                            <span
                              className="rounded-full border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-3 py-2 text-sm text-[var(--epx-accent)]"
                              key={`${selectedCustomer.id}-piece-${index}`}
                            >
                              {piece.name} · {piece.price.toFixed(2)} €
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full border border-dashed border-[var(--epx-surface-raised)] px-3 py-2 text-sm text-[var(--epx-text-muted)]">
                            Sin resultados
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Albaranes
                    </h4>
                    <p className="text-sm text-gray-500">
                      Historial operativo del cliente seleccionado.
                    </p>
                  </div>
                  <span className="rounded-full bg-[color:rgb(255_255_255_/_0.05)] px-3 py-2 text-xs font-semibold text-[var(--epx-text-muted)]">
                    {customerNotesTotal} registros
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {customerNotesQuery.error instanceof ApiError ? (
                    <ApiErrorState
                      message={customerNotesQuery.error.message}
                      title="Error al cargar albaranes"
                    />
                  ) : null}

                  {customerNotesQuery.isLoading ? (
                    <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4 text-sm text-[var(--epx-text-muted)]">
                      Cargando albaranes...
                    </div>
                  ) : null}

                  {visibleCustomerNotes.length ? (
                    <>
                      {visibleCustomerNotes.map((note) => (
                        <Link
                          className="block rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4 transition-colors hover:border-[var(--epx-accent)]/30 hover:bg-[var(--epx-surface)]"
                          key={note.id}
                          to={`/delivery-notes?noteId=${encodeURIComponent(note.id)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {note.number}
                              </p>
                              <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                                <CalendarDaysIcon className="h-4 w-4 text-[var(--epx-accent)]" />
                                {new Date(note.date).toLocaleDateString("es-ES")}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`}
                            >
                              {statusLabel[note.status]}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              {note.items.length} lineas
                            </span>
                            <span className="font-mono text-[var(--epx-accent)]">
                              {note.totalAmount.toFixed(2)} €
                            </span>
                          </div>
                        </Link>
                      ))}

                      {customerNotesHasMore ? (
                        <button
                          className="w-full rounded-2xl border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] px-4 py-3 text-sm font-semibold text-white"
                          onClick={() =>
                            setCustomerNotesLimit((current) => current + customerNotesPageStep)
                          }
                          type="button"
                        >
                          Mostrar 10 mas
                        </button>
                      ) : null}
                    </>
                  ) : customerNotesQuery.isLoading ? null : (
                    <div className="rounded-2xl border border-dashed border-[var(--epx-surface-raised)] p-4 text-sm text-[var(--epx-text-muted)]">
                      Este cliente aun no tiene albaranes.
                    </div>
                  )}
                </div>
              </div>
            </article>
          ) : null}

          {isComposerOpen ? (
            <div className="fixed inset-0 z-40 flex items-start justify-center bg-[color:rgb(19_19_19_/_0.78)] backdrop-blur sm:items-center">
              <button
                aria-label="Cerrar formulario de cliente"
                className="absolute inset-0"
                onClick={closeComposer}
                type="button"
              />
              <CustomerFormStepper
                duplicatedSpecialPieceIndexes={duplicatedSpecialPieceIndexes}
                fieldErrors={fieldErrors}
                form={form}
                isEditing={Boolean(editingCustomerId)}
                isPending={createMutation.isPending || updateMutation.isPending}
                isSpecialPiecesEditorOpen={isSpecialPiecesEditorOpen}
                mutationError={formError ?? mutationError}
                onClose={closeComposer}
                onFieldErrorsChange={setFieldErrors}
                onFormChange={(updater) => setForm((current) => updater(current))}
                onSubmit={() => void handleSubmit()}
                onToggleSpecialPiecesEditor={setIsSpecialPiecesEditorOpen}
                onSpecialPiecesEditFilterChange={setSpecialPiecesEditFilter}
                specialPiecesEditFilter={specialPiecesEditFilter}
              />
            </div>
          ) : !selectedCustomer ? (
            <div className="rounded-2xl border border-dashed border-[var(--epx-surface-raised)] p-8 text-sm text-[var(--epx-text-muted)]">
              Selecciona un cliente de la lista para ver su ficha, tarifas y albaranes.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

