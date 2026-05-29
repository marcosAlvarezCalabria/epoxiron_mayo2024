import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
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
import type { Customer, CustomerInput, DeliveryNote } from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";

interface SpecialPieceFormState {
  name: string;
  price: string;
}

interface CustomerFormState {
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

interface CustomerFieldErrors {
  email?: string;
  name?: string;
}

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

const parseNumber = (value: string) => Number.parseFloat(value || "0");

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

  return {};
};

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
    accent: "text-cyan-200 border-cyan-500/20 bg-cyan-500/10"
  },
  {
    key: "pricePerSquareMeter",
    label: "M2",
    accent: "text-fuchsia-200 border-fuchsia-500/20 bg-fuchsia-500/10"
  },
  {
    key: "minimumRate",
    label: "Min",
    accent: "text-emerald-200 border-emerald-500/20 bg-emerald-500/10"
  }
] as const;

const badgeByStatus: Record<DeliveryNote["status"], string> = {
  DRAFT: "text-gray-300 bg-white/5",
  PENDING: "text-amber-200 bg-amber-500/10 border border-amber-500/20",
  REVIEWED: "text-emerald-200 bg-emerald-500/10 border border-emerald-500/20"
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
  const [isSpecialPiecesEditorOpen, setIsSpecialPiecesEditorOpen] = useState(false);
  const [customerNotesLimit, setCustomerNotesLimit] = useState(initialCustomerNotesLimit);

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

  const normalizedEditFilter = specialPiecesEditFilter.trim().toLowerCase();
  const visibleEditPieces = form.specialPieces
    .map((piece, index) => ({ piece, index }))
    .filter(({ piece }) => piece.name.toLowerCase().includes(normalizedEditFilter));

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!form.name.trim()) {
      setFieldErrors({
        name: "El nombre del cliente es obligatorio."
      });
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
        if (nextFieldErrors.name || nextFieldErrors.email) {
          setFieldErrors(nextFieldErrors);
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
          <p className="text-sm font-medium text-slate-400">Clientes</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Clientes y tarifas
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Consulta de ficha, tarifas y actividad reciente del cliente desde una
            vista unica.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50"
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
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <input
              className="w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-gray-500 focus:border-cyan-500/50"
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
              <p className="text-sm text-gray-400">Cargando clientes...</p>
            ) : null}

            {filteredCustomers.map((customer) => (
              <button
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  selectedCustomer?.id === customer.id
                    ? "border-cyan-400/30 bg-cyan-400/10"
                    : "border-white/10 bg-slate-900/70 hover:border-white/20"
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
                    <p className="mt-1 text-sm text-slate-400">
                      {customer.phone ?? customer.email ?? "Sin contacto"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                    {customer.specialPieces.length} piezas
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                    ML {customer.pricePerLinearMeter.toFixed(2)} €
                  </span>
                  <span className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200">
                    M2 {customer.pricePerSquareMeter.toFixed(2)} €
                  </span>
                </div>
              </button>
            ))}

            {!isLoading && filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
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
            <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <button
                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white xl:hidden"
                onClick={() => setMobilePane("list")}
                type="button"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver a la lista
              </button>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Cliente seleccionado</p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {selectedCustomer.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {selectedCustomer.address ?? "Sin direccion"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
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
                <div className="rounded-2xl border border-white/10 bg-gray-950/50 p-4">
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
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Piezas especiales
                  </h4>
                  <span className="text-xs text-gray-500">
                    Referencia frecuente
                  </span>
                </div>
                {selectedCustomer.specialPieces.length > 0 ? (
                  <input
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                    onChange={(event) => setSpecialPiecesReadFilter(event.target.value)}
                    placeholder="Buscar pieza..."
                    value={specialPiecesReadFilter}
                  />
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedCustomer.specialPieces.length ? (
                    visibleReadPieces.length ? (
                      visibleReadPieces.map((piece, index) => (
                        <span
                          className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
                          key={`${selectedCustomer.id}-piece-${index}`}
                        >
                          {piece.name} · {piece.price.toFixed(2)} €
                        </span>
                      ))
                    ) : normalizedReadFilter ? (
                      <span className="rounded-full border border-dashed border-white/10 px-3 py-2 text-sm text-gray-500">
                        Sin resultados
                      </span>
                    ) : null
                  ) : (
                    <span className="rounded-full border border-dashed border-white/10 px-3 py-2 text-sm text-gray-500">
                      Sin piezas especiales
                    </span>
                  )}
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
                  <span className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300">
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
                    <div className="rounded-2xl border border-white/10 bg-gray-950/50 p-4 text-sm text-gray-400">
                      Cargando albaranes...
                    </div>
                  ) : null}

                  {visibleCustomerNotes.length ? (
                    <>
                      {visibleCustomerNotes.map((note) => (
                        <Link
                          className="block rounded-2xl border border-white/10 bg-gray-950/50 p-4 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5"
                          key={note.id}
                          to={`/delivery-notes?noteId=${encodeURIComponent(note.id)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {note.number}
                              </p>
                              <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                                <CalendarDaysIcon className="h-4 w-4 text-cyan-300" />
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
                            <span className="font-mono text-cyan-300">
                              {note.totalAmount.toFixed(2)} €
                            </span>
                          </div>
                        </Link>
                      ))}

                      {customerNotesHasMore ? (
                        <button
                          className="w-full rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100"
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
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500">
                      Este cliente aun no tiene albaranes.
                    </div>
                  )}
                </div>
              </div>
            </article>
          ) : null}

          {isComposerOpen ? (
            <div className="fixed inset-0 z-40 flex items-end bg-gray-950/75 backdrop-blur sm:items-center sm:justify-center">
              <button
                aria-label="Cerrar formulario de cliente"
                className="absolute inset-0"
                onClick={closeComposer}
                type="button"
              />
            <form
              className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b1220] p-5 shadow-2xl shadow-cyan-950/40 sm:max-w-3xl sm:rounded-[2rem] sm:p-6"
              onSubmit={handleSubmit}
            >
              <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6">
                <div>
                  <p className="text-sm font-medium text-cyan-300">
                    {editingCustomerId ? "Editar cliente" : "Alta de cliente"}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-white">
                    {editingCustomerId ? "Actualizar ficha" : "Nuevo cliente"}
                  </h3>
                </div>
                <button
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-300"
                  onClick={closeComposer}
                  type="button"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className={`rounded-2xl border px-4 py-3 text-sm text-white placeholder:text-gray-500 ${
                    fieldErrors.name
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-white/10 bg-gray-950/60"
                  }`}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                  }}
                  placeholder="Nombre del cliente"
                  value={form.name}
                />
                {fieldErrors.name ? (
                  <p className="sm:col-span-2 -mt-1 text-sm text-red-300">{fieldErrors.name}</p>
                ) : null}
                <input
                  className="rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="Telefono"
                  value={form.phone}
                />
                <input
                  className={`rounded-2xl border px-4 py-3 text-sm text-white placeholder:text-gray-500 sm:col-span-2 ${
                    fieldErrors.email
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-white/10 bg-gray-950/60"
                  }`}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, email: event.target.value }));
                    setFieldErrors((current) => ({ ...current, email: undefined }));
                  }}
                  placeholder="Email"
                  value={form.email}
                />
                {fieldErrors.email ? (
                  <p className="sm:col-span-2 -mt-1 text-sm text-red-300">{fieldErrors.email}</p>
                ) : null}
                <input
                  className="rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500 sm:col-span-2"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, address: event.target.value }))
                  }
                  placeholder="Direccion"
                  value={form.address}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {priceTiles.map((tile) => (
                  <label
                    className={`rounded-2xl border p-4 ${tile.accent}`}
                    key={tile.key}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">
                      {tile.label}
                    </p>
                    <input
                      className="mt-3 w-full bg-transparent text-center text-2xl font-bold outline-none"
                      inputMode="decimal"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [tile.key]: event.target.value
                        }))
                      }
                      value={form[tile.key]}
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-3">
                <input
                  className="rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      grosorPrecio: event.target.value
                    }))
                  }
                  placeholder="Suplemento por grosor"
                  value={form.grosorPrecio}
                />
              </div>

              <div className="rounded-[1.75rem] border border-cyan-500/20 bg-cyan-500/10 p-4 shadow-lg shadow-cyan-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                      Piezas especiales
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-white">
                      Catalogo rapido del cliente
                    </h4>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-50"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        specialPieces: [...current.specialPieces, { name: "", price: "" }]
                      }))
                    }
                    type="button"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Manual
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left text-sm font-semibold text-white"
                    onClick={() => setIsSpecialPiecesEditorOpen((current) => !current)}
                    type="button"
                  >
                    <span>
                      {form.specialPieces.length
                        ? `${form.specialPieces.length} piezas cargadas`
                        : "Abrir editor de piezas"}
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${
                        isSpecialPiecesEditorOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isSpecialPiecesEditorOpen ? (
                    <div className="mt-3 space-y-3">
                      {form.specialPieces.length > 0 ? (
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                          onChange={(event) => setSpecialPiecesEditFilter(event.target.value)}
                          placeholder="Buscar pieza..."
                          value={specialPiecesEditFilter}
                        />
                      ) : null}
                      {normalizedEditFilter && visibleEditPieces.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          Sin resultados para «{specialPiecesEditFilter}»
                        </p>
                      ) : null}
                      {visibleEditPieces.map(({ piece, index }) => (
                        <div
                          className="grid gap-3 rounded-2xl border border-white/10 bg-gray-950/60 p-3 sm:grid-cols-[1fr_140px_auto]"
                          key={`piece-${index}`}
                        >
                          <input
                            className="rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                specialPieces: current.specialPieces.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, name: event.target.value }
                                    : entry
                                )
                              }))
                            }
                            placeholder="Nombre de pieza"
                            value={piece.name}
                          />
                          <input
                            className="rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                            inputMode="decimal"
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                specialPieces: current.specialPieces.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, price: event.target.value }
                                    : entry
                                )
                              }))
                            }
                            placeholder="Precio"
                            value={piece.price}
                          />
                          <button
                            className="inline-flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-red-200"
                            onClick={() =>
                              setForm((current) => ({
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
                        </div>
                      ))}
                      {!form.specialPieces.length ? (
                        <div className="rounded-2xl border border-dashed border-cyan-400/20 bg-slate-950/50 px-4 py-5 text-sm text-cyan-100/70">
                          No hay piezas especiales cargadas todavia.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <textarea
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500"
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Notas internas"
                value={form.notes}
              />

              {formError || mutationError ? (
                <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {formError ?? mutationError}
                </p>
              ) : null}

              <div className="sticky bottom-0 flex gap-3 rounded-2xl border border-white/10 bg-gray-950/90 p-3 backdrop-blur">
                <button
                  className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-gray-950"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  type="submit"
                >
                  {editingCustomerId ? "Guardar cambios" : "Crear cliente"}
                </button>
              </div>
            </form>
            </div>
          ) : !selectedCustomer ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-slate-500">
              Selecciona un cliente de la lista para ver su ficha, tarifas y albaranes.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

