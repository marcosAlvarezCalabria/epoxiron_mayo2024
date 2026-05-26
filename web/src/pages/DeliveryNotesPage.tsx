import { useEffect, useMemo, useState, startTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  calculatePricePreview,
  createDeliveryNote,
  deleteDeliveryNote,
  getCustomers,
  getDeliveryNotes,
  updateDeliveryNote,
  updateDeliveryNoteStatus
} from "@/application/use-cases";
import type {
  DeliveryNote,
  DeliveryNoteInput,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus
} from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";

interface DeliveryNoteItemFormState {
  description: string;
  color: string;
  linearMeters: string;
  squareMeters: string;
  thickness: string;
  quantity: string;
}

interface DeliveryNoteFormState {
  number: string;
  customerId: string;
  notes: string;
  date: string;
  items: DeliveryNoteItemFormState[];
}

interface PricePreviewState {
  unitPrice: number;
  totalPrice: number;
}

const badgeByStatus: Record<DeliveryNoteStatus, string> = {
  DRAFT: "bg-gray-700 text-gray-300",
  PENDING: "border border-yellow-700/50 bg-yellow-900/30 text-yellow-400",
  REVIEWED: "border border-green-700/50 bg-green-900/30 text-green-400"
};

const emptyItem = (): DeliveryNoteItemFormState => ({
  description: "",
  color: "",
  linearMeters: "",
  squareMeters: "",
  thickness: "",
  quantity: "1"
});

const emptyForm = (): DeliveryNoteFormState => ({
  number: "",
  customerId: "",
  notes: "",
  date: new Date().toISOString().slice(0, 10),
  items: [emptyItem()]
});

const noteToFormState = (note: DeliveryNote): DeliveryNoteFormState => ({
  number: note.number,
  customerId: note.customerId,
  notes: note.notes ?? "",
  date: note.date.slice(0, 10),
  items: note.items.map((item) => ({
    description: item.description,
    color: item.color,
    linearMeters: item.linearMeters?.toString() ?? "",
    squareMeters: item.squareMeters?.toString() ?? "",
    thickness: item.thickness?.toString() ?? "",
    quantity: item.quantity.toString()
  }))
});

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? Number.parseFloat(trimmed) : null;
};

const normalizeItem = (item: DeliveryNoteItemFormState): DeliveryNoteItemDraft => ({
  description: item.description.trim(),
  color: item.color.trim(),
  linearMeters: parseOptionalNumber(item.linearMeters),
  squareMeters: parseOptionalNumber(item.squareMeters),
  thickness: parseOptionalNumber(item.thickness),
  quantity: Number.parseInt(item.quantity || "1", 10)
});

const normalizePayload = (
  form: DeliveryNoteFormState,
  status: DeliveryNoteStatus
): DeliveryNoteInput => ({
  number: form.number.trim(),
  customerId: form.customerId,
  notes: form.notes.trim() ? form.notes.trim() : null,
  status,
  date: new Date(form.date).toISOString(),
  items: form.items.map(normalizeItem)
});

const canPreviewItem = (customerId: string, item: DeliveryNoteItemFormState) =>
  Boolean(customerId && item.description.trim() && item.color.trim() && Number.parseInt(item.quantity || "0", 10) > 0);

export const DeliveryNotesPage = () => {
  const queryClient = useQueryClient();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [form, setForm] = useState<DeliveryNoteFormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<DeliveryNoteStatus | "ALL">("ALL");
  const [customerFilter, setCustomerFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<number, PricePreviewState>>({});

  const customersQuery = useQuery({
    queryKey: ["customers", "all-for-delivery-notes"],
    queryFn: () => getCustomers()
  });

  const deliveryNotesQuery = useQuery({
    queryKey: ["delivery-notes", statusFilter, customerFilter, todayOnly],
    queryFn: () =>
      getDeliveryNotes({
        status: statusFilter,
        customerId: customerFilter || undefined,
        today: todayOnly
      })
  });

  const createMutation = useMutation({
    mutationFn: createDeliveryNote,
    onSuccess: async () => {
      setEditingNoteId(null);
      setForm(emptyForm());
      setPreviews({});
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeliveryNoteInput }) => updateDeliveryNote(id, input),
    onSuccess: async () => {
      setEditingNoteId(null);
      setForm(emptyForm());
      setPreviews({});
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryNoteStatus }) =>
      updateDeliveryNoteStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const mutationError = useMemo(() => {
    const error =
      createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? statusMutation.error;
    return error instanceof ApiError ? error.message : null;
  }, [createMutation.error, deleteMutation.error, statusMutation.error, updateMutation.error]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!form.customerId) {
        startTransition(() => setPreviews({}));
        return;
      }

      const activeEntries = form.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => canPreviewItem(form.customerId, item));

      if (activeEntries.length === 0) {
        startTransition(() => setPreviews({}));
        return;
      }

      void Promise.all(
        activeEntries.map(async ({ item, index }) => {
          const result = await calculatePricePreview(form.customerId, normalizeItem(item));
          return {
            index,
            preview: result.pricing
          };
        })
      )
        .then((results) => {
          startTransition(() => {
            setPreviews(
              results.reduce<Record<number, PricePreviewState>>((accumulator, entry) => {
                accumulator[entry.index] = entry.preview;
                return accumulator;
              }, {})
            );
          });
        })
        .catch(() => {
          startTransition(() => setPreviews({}));
        });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [form]);

  const submitForm = async (status: DeliveryNoteStatus) => {
    setFormError(null);
    if (!form.number.trim()) {
      setFormError("El número de albarán es obligatorio.");
      return;
    }
    if (!form.customerId) {
      setFormError("Selecciona un cliente.");
      return;
    }
    if (form.items.some((item) => !item.description.trim() || !item.color.trim())) {
      setFormError("Todos los items deben tener descripción y color.");
      return;
    }

    const payload = normalizePayload(form, status);
    try {
      if (editingNoteId) {
        await updateMutation.mutateAsync({ id: editingNoteId, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch {
      return;
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Albaranes</h2>
        <p className="text-sm text-gray-400">CRUD operativo con preview de precio desde la API.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 rounded-2xl border border-gray-700 bg-gray-800/60 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-100">
                {editingNoteId ? "Editar albarán" : "Nuevo albarán"}
              </h3>
              <p className="text-sm text-gray-400">La API recalcula todos los importes al guardar.</p>
            </div>
            {editingNoteId ? (
              <button
                className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300"
                onClick={() => {
                  setEditingNoteId(null);
                  setForm(emptyForm());
                  setPreviews({});
                  setFormError(null);
                }}
                type="button"
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Número
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
                value={form.number}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Fecha
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                type="date"
                value={form.date}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Cliente
              </label>
              <select
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
                value={form.customerId}
              >
                <option value="">Selecciona un cliente</option>
                {customersQuery.data?.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Notas
              </label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                value={form.notes}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-300">Items</h4>
                <p className="text-sm text-gray-400">Preview unitario y total por item.</p>
              </div>
              <button
                className="rounded-lg border border-blue-700/50 bg-blue-900/20 px-3 py-2 text-sm text-blue-200"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    items: [...current.items, emptyItem()]
                  }))
                }
                type="button"
              >
                Añadir item
              </button>
            </div>

            {form.items.map((item, index) => (
              <div className="space-y-3 rounded-2xl border border-gray-700 bg-gray-900/40 p-4" key={`item-${index}`}>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, description: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder="Descripción"
                    value={item.description}
                  />
                  <input
                    className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, color: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder="Color RAL"
                    value={item.color}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <input
                    className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    inputMode="numeric"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, quantity: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder="Cantidad"
                    value={item.quantity}
                  />
                  <input
                    className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    inputMode="decimal"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, linearMeters: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder="ML"
                    value={item.linearMeters}
                  />
                  <input
                    className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    inputMode="decimal"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, squareMeters: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder="M²"
                    value={item.squareMeters}
                  />
                  <input
                    className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                    inputMode="decimal"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        items: current.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, thickness: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder="Grosor"
                    value={item.thickness}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {previews[index] ? (
                      <span className="font-mono text-blue-300">
                        Unit. {previews[index].unitPrice.toFixed(2)}€ · Total {previews[index].totalPrice.toFixed(2)}€
                      </span>
                    ) : (
                      <span>Sin preview todavía</span>
                    )}
                  </div>
                  {form.items.length > 1 ? (
                    <button
                      className="rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.filter((_, entryIndex) => entryIndex !== index)
                        }))
                      }
                      type="button"
                    >
                      Quitar item
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {formError || mutationError ? (
            <p className="rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {formError ?? mutationError}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-100"
              onClick={() => void submitForm("DRAFT")}
              type="button"
            >
              Guardar borrador
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void submitForm("PENDING")}
              type="button"
            >
              Marcar pendiente
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
            <h3 className="text-lg font-bold text-gray-100">Filtros</h3>
            <div className="mt-4 grid gap-3">
              <select
                className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setStatusFilter(event.target.value as DeliveryNoteStatus | "ALL")}
                value={statusFilter}
              >
                <option value="ALL">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="PENDING">Pendiente</option>
                <option value="REVIEWED">Revisado</option>
              </select>
              <select
                className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setCustomerFilter(event.target.value)}
                value={customerFilter}
              >
                <option value="">Todos los clientes</option>
                {customersQuery.data?.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input checked={todayOnly} onChange={() => setTodayOnly((current) => !current)} type="checkbox" />
                Solo hoy
              </label>
            </div>
          </div>

          {deliveryNotesQuery.data?.deliveryNotes.map((note) => (
            <article className="rounded-2xl border border-gray-700 bg-gray-800 p-5" key={note.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-gray-100">{note.number}</p>
                  <p className="text-sm text-gray-400">{note.customerName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`}>
                  {note.status}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                <span>{new Date(note.date).toLocaleDateString("es-ES")}</span>
                <span className="font-mono text-blue-400">{note.totalAmount.toFixed(2)}€</span>
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-gray-700 bg-gray-900/30 p-3">
                {note.items.map((item, index) => (
                  <div className="flex items-center justify-between text-sm text-gray-300" key={`${note.id}-${index}`}>
                    <span>
                      {item.description} · {item.color} · x{item.quantity}
                    </span>
                    <span className="font-mono text-gray-400">{item.totalPrice.toFixed(2)}€</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300"
                  onClick={() => {
                    setEditingNoteId(note.id);
                    setForm(noteToFormState(note));
                    setFormError(null);
                  }}
                  type="button"
                >
                  Editar
                </button>

                {note.status !== "REVIEWED" ? (
                  <button
                    className="rounded-lg border border-green-700/50 bg-green-900/20 px-3 py-2 text-sm text-green-300"
                    onClick={() => statusMutation.mutate({ id: note.id, status: "REVIEWED" })}
                    type="button"
                  >
                    Marcar revisado
                  </button>
                ) : null}

                {note.status === "DRAFT" ? (
                  <button
                    className="rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300"
                    onClick={() => {
                      if (window.confirm(`Eliminar albarán ${note.number}?`)) {
                        deleteMutation.mutate(note.id);
                      }
                    }}
                    type="button"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
