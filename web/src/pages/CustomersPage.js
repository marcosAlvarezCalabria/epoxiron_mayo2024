import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from "@/application/use-cases";
import { ApiError } from "@/infrastructure/api/apiClient";
const emptyCustomerForm = () => ({
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
const customerToFormState = (customer) => ({
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
const toOptionalText = (value) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
const parseNumber = (value) => Number.parseFloat(value || "0");
const normalizeCustomerPayload = (form) => ({
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
const numberCardClass = "rounded-2xl border border-gray-700 bg-gray-800/70 p-4 shadow-sm shadow-black/10";
export const CustomersPage = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [editingCustomerId, setEditingCustomerId] = useState(null);
    const [form, setForm] = useState(emptyCustomerForm);
    const [formError, setFormError] = useState(null);
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
        mutationFn: ({ id, input }) => updateCustomer(id, input),
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
    const handleSubmit = async (event) => {
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
            }
            else {
                await createMutation.mutateAsync(payload);
            }
        }
        catch {
            return;
        }
    };
    return (_jsxs("section", { className: "space-y-8", children: [_jsxs("div", { className: "flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-100", children: "Clientes" }), _jsx("p", { className: "text-sm text-gray-400", children: "CRUD completo con tarifas y piezas especiales." })] }), _jsxs("div", { className: "w-full max-w-sm", children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Buscar" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500", onChange: (event) => setSearch(event.target.value), placeholder: "Nombre del cliente", value: search })] })] }), _jsxs("div", { className: "grid gap-8 xl:grid-cols-[1.15fr_0.85fr]", children: [_jsxs("form", { className: "space-y-6 rounded-2xl border border-gray-700 bg-gray-800/60 p-6", onSubmit: handleSubmit, children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-bold text-gray-100", children: editingCustomerId ? "Editar cliente" : "Nuevo cliente" }), _jsx("p", { className: "text-sm text-gray-400", children: "Datos, tarifas y piezas especiales." })] }), editingCustomerId ? (_jsx("button", { className: "rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300", onClick: () => {
                                            setEditingCustomerId(null);
                                            setForm(emptyCustomerForm());
                                            setFormError(null);
                                        }, type: "button", children: "Cancelar edici\u00F3n" })) : null] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Nombre" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, name: event.target.value })), value: form.name })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Email" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, email: event.target.value })), value: form.email })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Tel\u00E9fono" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, phone: event.target.value })), value: form.phone })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Direcci\u00F3n" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, address: event.target.value })), value: form.address })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Notas" }), _jsx("textarea", { className: "min-h-24 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({ ...current, notes: event.target.value })), value: form.notes })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: numberCardClass, children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-blue-300", children: "Precio ML" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-3 text-center text-2xl font-bold text-blue-200", inputMode: "decimal", onChange: (event) => setForm((current) => ({ ...current, pricePerLinearMeter: event.target.value })), value: form.pricePerLinearMeter })] }), _jsxs("div", { className: numberCardClass, children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-purple-300", children: "Precio M\u00B2" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-3 text-center text-2xl font-bold text-purple-200", inputMode: "decimal", onChange: (event) => setForm((current) => ({ ...current, pricePerSquareMeter: event.target.value })), value: form.pricePerSquareMeter })] }), _jsxs("div", { className: numberCardClass, children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-green-300", children: "Tarifa m\u00EDnima" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-3 text-center text-2xl font-bold text-green-200", inputMode: "decimal", onChange: (event) => setForm((current) => ({ ...current, minimumRate: event.target.value })), value: form.minimumRate })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Grosor m\u00EDnimo (mm)" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "decimal", onChange: (event) => setForm((current) => ({ ...current, grosorMm: event.target.value })), value: form.grosorMm })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400", children: "Suplemento grosor" }), _jsx("input", { className: "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "decimal", onChange: (event) => setForm((current) => ({ ...current, grosorPrecio: event.target.value })), value: form.grosorPrecio })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-bold uppercase tracking-wider text-gray-300", children: "Piezas especiales" }), _jsx("p", { className: "text-sm text-gray-400", children: "Precio fijo por nombre exacto de pieza." })] }), _jsx("button", { className: "rounded-lg border border-blue-700/50 bg-blue-900/20 px-3 py-2 text-sm text-blue-200", onClick: () => setForm((current) => ({
                                                    ...current,
                                                    specialPieces: [...current.specialPieces, { name: "", price: "" }]
                                                })), type: "button", children: "A\u00F1adir pieza" })] }), form.specialPieces.length === 0 ? (_jsx("p", { className: "rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-500", children: "Sin piezas especiales configuradas." })) : null, form.specialPieces.map((piece, index) => (_jsxs("div", { className: "grid gap-3 rounded-xl border border-gray-700 bg-gray-900/40 p-4 md:grid-cols-[1fr_180px_auto]", children: [_jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", onChange: (event) => setForm((current) => ({
                                                    ...current,
                                                    specialPieces: current.specialPieces.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry)
                                                })), placeholder: "Nombre de la pieza", value: piece.name }), _jsx("input", { className: "rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                    ...current,
                                                    specialPieces: current.specialPieces.map((entry, entryIndex) => entryIndex === index ? { ...entry, price: event.target.value } : entry)
                                                })), placeholder: "Precio", value: piece.price }), _jsx("button", { className: "rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300", onClick: () => setForm((current) => ({
                                                    ...current,
                                                    specialPieces: current.specialPieces.filter((_, entryIndex) => entryIndex !== index)
                                                })), type: "button", children: "Eliminar" })] }, `piece-${index}`)))] }), formError || mutationError ? (_jsx("p", { className: "rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300", children: formError ?? mutationError })) : null, _jsx("div", { className: "flex gap-3", children: _jsx("button", { className: "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500", disabled: createMutation.isPending || updateMutation.isPending, type: "submit", children: editingCustomerId ? "Guardar cambios" : "Crear cliente" }) })] }), _jsxs("div", { className: "space-y-4", children: [isLoading ? _jsx("p", { className: "text-sm text-gray-400", children: "Cargando clientes\u2026" }) : null, data?.customers.length === 0 ? (_jsx("div", { className: "rounded-2xl border border-dashed border-gray-700 p-6 text-sm text-gray-500", children: "No hay clientes para el filtro actual." })) : null, data?.customers.map((customer) => (_jsxs("article", { className: "rounded-2xl border border-gray-700 bg-gray-800 p-5", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-bold text-gray-100", children: customer.name }), _jsx("p", { className: "mt-1 text-sm text-gray-400", children: customer.email ?? "Sin email" }), _jsx("p", { className: "text-sm text-gray-500", children: customer.phone ?? "Sin teléfono" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300", onClick: () => {
                                                            setEditingCustomerId(customer.id);
                                                            setForm(customerToFormState(customer));
                                                            setFormError(null);
                                                        }, type: "button", children: "Editar" }), _jsx("button", { className: "rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300", onClick: () => {
                                                            if (window.confirm(`Eliminar a ${customer.name}?`)) {
                                                                deleteMutation.mutate(customer.id);
                                                            }
                                                        }, type: "button", children: "Eliminar" })] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2 text-sm", children: [_jsxs("span", { className: "rounded-full border border-blue-700/50 bg-blue-900/30 px-3 py-1 text-blue-200", children: ["ML ", customer.pricePerLinearMeter.toFixed(2), "\u20AC"] }), _jsxs("span", { className: "rounded-full border border-purple-700/50 bg-purple-900/20 px-3 py-1 text-purple-200", children: ["M\u00B2 ", customer.pricePerSquareMeter.toFixed(2), "\u20AC"] }), _jsxs("span", { className: "rounded-full border border-green-700/50 bg-green-900/20 px-3 py-1 text-green-200", children: ["Min ", customer.minimumRate.toFixed(2), "\u20AC"] })] }), customer.specialPieces.length > 0 ? (_jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: customer.specialPieces.map((piece, index) => (_jsxs("span", { className: "rounded-full border border-blue-700/50 bg-blue-900/20 px-3 py-1 text-sm text-blue-100", children: [piece.name, " \u00B7 ", piece.price.toFixed(2), "\u20AC"] }, `${customer.id}-piece-${index}`))) })) : null] }, customer.id)))] })] })] }));
};
