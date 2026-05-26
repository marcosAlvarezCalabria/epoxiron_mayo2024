import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from "@/application/use-cases";
import type { Customer, CustomerInput } from "@/domain/entities";
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
  grosorMm: string;
  grosorPrecio: string;
  specialPieces: SpecialPieceFormState[];
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
  grosorMm: "",
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
  grosorMm: customer.grosorMm?.toString() ?? "",
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

const normalizeCustomerPayload = (form: CustomerFormState): CustomerInput => ({
  name: form.name.trim(),
  email: toOptionalText(form.email),
  phone: toOptionalText(form.phone),
  address: toOptionalText(form.address),
  notes: toOptionalText(form.notes),
  pricePerLinearMeter: parseNumber(form.pricePerLinearMeter),
  pricePerSquareMeter: parseNumber(form.pricePerSquareMeter),
  minimumRate: parseNumber(form.minimumRate),
  grosorMm: form.grosorMm.trim() ? parseNumber(form.grosorMm) : null,
  grosorPrecio: form.grosorPrecio.trim() ? parseNumber(form.grosorPrecio) : null,
  specialPieces: form.specialPieces
    .filter((piece) => piece.name.trim() && piece.price.trim())
    .map((piece) => ({
      name: piece.name.trim(),
      price: parseNumber(piece.price)
    }))
});

const numberCardClass =
  "rounded-2xl border border-gray-700 bg-gray-800/70 p-4 shadow-sm shadow-black/10";

export const CustomersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", deferredSearch],
    queryFn: () => getCustomers(deferredSearch)
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      setForm(emptyCustomerForm());
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) => updateCustomer(id, input),
    onSuccess: async () => {
      setEditingCustomerId(null);
      setForm(emptyCustomerForm());
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const mutationError = useMemo(() => {
    const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error;
    return error instanceof ApiError ? error.message : null;
  }, [createMutation.error, deleteMutation.error, updateMutation.error]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("El nombre del cliente es obligatorio.");
      return;
    }

    const payload = normalizeCustomerPayload(form);

    try {
      if (editingCustomerId) {
        await updateMutation.mutateAsync({ id: editingCustomerId, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch {
      return;
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Clientes</h2>
          <p className="text-sm text-gray-400">CRUD completo con tarifas y piezas especiales.</p>
        </div>
        <div className="w-full max-w-sm">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Buscar
          </label>
          <input
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre del cliente"
            value={search}
          />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <form className="space-y-6 rounded-2xl border border-gray-700 bg-gray-800/60 p-6" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-100">
                {editingCustomerId ? "Editar cliente" : "Nuevo cliente"}
              </h3>
              <p className="text-sm text-gray-400">Datos, tarifas y piezas especiales.</p>
            </div>
            {editingCustomerId ? (
              <button
                className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300"
                onClick={() => {
                  setEditingCustomerId(null);
                  setForm(emptyCustomerForm());
                  setFormError(null);
                }}
                type="button"
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Nombre
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                value={form.name}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Email
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                value={form.email}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Teléfono
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                value={form.phone}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Dirección
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                value={form.address}
              />
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className={numberCardClass}>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-blue-300">
                Precio ML
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-3 text-center text-2xl font-bold text-blue-200"
                inputMode="decimal"
                onChange={(event) =>
                  setForm((current) => ({ ...current, pricePerLinearMeter: event.target.value }))
                }
                value={form.pricePerLinearMeter}
              />
            </div>
            <div className={numberCardClass}>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-purple-300">
                Precio M²
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-3 text-center text-2xl font-bold text-purple-200"
                inputMode="decimal"
                onChange={(event) =>
                  setForm((current) => ({ ...current, pricePerSquareMeter: event.target.value }))
                }
                value={form.pricePerSquareMeter}
              />
            </div>
            <div className={numberCardClass}>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-green-300">
                Tarifa mínima
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-3 text-center text-2xl font-bold text-green-200"
                inputMode="decimal"
                onChange={(event) => setForm((current) => ({ ...current, minimumRate: event.target.value }))}
                value={form.minimumRate}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Grosor mínimo (mm)
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                inputMode="decimal"
                onChange={(event) => setForm((current) => ({ ...current, grosorMm: event.target.value }))}
                value={form.grosorMm}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
                Suplemento grosor
              </label>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                inputMode="decimal"
                onChange={(event) =>
                  setForm((current) => ({ ...current, grosorPrecio: event.target.value }))
                }
                value={form.grosorPrecio}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                  Piezas especiales
                </h4>
                <p className="text-sm text-gray-400">Precio fijo por nombre exacto de pieza.</p>
              </div>
              <button
                className="rounded-lg border border-blue-700/50 bg-blue-900/20 px-3 py-2 text-sm text-blue-200"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    specialPieces: [...current.specialPieces, { name: "", price: "" }]
                  }))
                }
                type="button"
              >
                Añadir pieza
              </button>
            </div>

            {form.specialPieces.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">
                Sin piezas especiales configuradas.
              </p>
            ) : null}

            {form.specialPieces.map((piece, index) => (
              <div className="grid gap-3 rounded-xl border border-gray-700 bg-gray-900/40 p-4 md:grid-cols-[1fr_180px_auto]" key={`piece-${index}`}>
                <input
                  className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      specialPieces: current.specialPieces.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, name: event.target.value } : entry
                      )
                    }))
                  }
                  placeholder="Nombre de la pieza"
                  value={piece.name}
                />
                <input
                  className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100"
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      specialPieces: current.specialPieces.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, price: event.target.value } : entry
                      )
                    }))
                  }
                  placeholder="Precio"
                  value={piece.price}
                />
                <button
                  className="rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      specialPieces: current.specialPieces.filter((_, entryIndex) => entryIndex !== index)
                    }))
                  }
                  type="button"
                >
                  Eliminar
                </button>
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              disabled={createMutation.isPending || updateMutation.isPending}
              type="submit"
            >
              {editingCustomerId ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {isLoading ? <p className="text-sm text-gray-400">Cargando clientes…</p> : null}

          {data?.customers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 p-6 text-sm text-gray-500">
              No hay clientes para el filtro actual.
            </div>
          ) : null}

          {data?.customers.map((customer) => (
            <article className="rounded-2xl border border-gray-700 bg-gray-800 p-5" key={customer.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-gray-100">{customer.name}</p>
                  <p className="mt-1 text-sm text-gray-400">{customer.email ?? "Sin email"}</p>
                  <p className="text-sm text-gray-500">{customer.phone ?? "Sin teléfono"}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300"
                    onClick={() => {
                      setEditingCustomerId(customer.id);
                      setForm(customerToFormState(customer));
                      setFormError(null);
                    }}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className="rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300"
                    onClick={() => {
                      if (window.confirm(`Eliminar a ${customer.name}?`)) {
                        deleteMutation.mutate(customer.id);
                      }
                    }}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-blue-700/50 bg-blue-900/30 px-3 py-1 text-blue-200">
                  ML {customer.pricePerLinearMeter.toFixed(2)}€
                </span>
                <span className="rounded-full border border-purple-700/50 bg-purple-900/20 px-3 py-1 text-purple-200">
                  M² {customer.pricePerSquareMeter.toFixed(2)}€
                </span>
                <span className="rounded-full border border-green-700/50 bg-green-900/20 px-3 py-1 text-green-200">
                  Min {customer.minimumRate.toFixed(2)}€
                </span>
              </div>

              {customer.specialPieces.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {customer.specialPieces.map((piece, index) => (
                    <span
                      className="rounded-full border border-blue-700/50 bg-blue-900/20 px-3 py-1 text-sm text-blue-100"
                      key={`${customer.id}-piece-${index}`}
                    >
                      {piece.name} · {piece.price.toFixed(2)}€
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
