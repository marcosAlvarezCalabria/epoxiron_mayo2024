import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeftIcon, CalendarDaysIcon, PlusIcon, TrashIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createCustomer, deleteCustomer, getDeliveryNotes, getCustomers, updateCustomer } from "@/application/use-cases";
import { ApiError } from "@/infrastructure/api/apiClient";
const quickSpecialPieces = [
    "Barandilla",
    "Marco",
    "Puerta",
    "Bastidor",
    "Rejilla",
    "Pletina"
];
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
];
const badgeByStatus = {
    DRAFT: "text-gray-300 bg-white/5",
    PENDING: "text-amber-200 bg-amber-500/10 border border-amber-500/20",
    REVIEWED: "text-emerald-200 bg-emerald-500/10 border border-emerald-500/20"
};
const statusLabel = {
    DRAFT: "Borrador",
    PENDING: "Pendiente",
    REVIEWED: "Revisado"
};
export const CustomersPage = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [editingCustomerId, setEditingCustomerId] = useState(null);
    const [mobilePane, setMobilePane] = useState("list");
    const [form, setForm] = useState(emptyCustomerForm);
    const [formError, setFormError] = useState(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ["customers"],
        queryFn: () => getCustomers()
    });
    const filteredCustomers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return data?.customers ?? [];
        }
        return (data?.customers ?? []).filter((customer) => customer.name.toLowerCase().includes(query));
    }, [data?.customers, search]);
    const selectedCustomer = filteredCustomers.find((customer) => customer.id === selectedCustomerId) ?? null;
    const customerNotesQuery = useQuery({
        queryKey: ["delivery-notes", "customer-detail", selectedCustomer?.id],
        queryFn: () => getDeliveryNotes({ customerId: selectedCustomer?.id }),
        enabled: Boolean(selectedCustomer?.id)
    });
    const createMutation = useMutation({
        mutationFn: createCustomer,
        onSuccess: async (result) => {
            setForm(emptyCustomerForm());
            setFormError(null);
            setIsComposerOpen(false);
            setSelectedCustomerId(result.customer.id);
            await queryClient.invalidateQueries({ queryKey: ["customers"] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, input }) => updateCustomer(id, input),
        onSuccess: async (result) => {
            setEditingCustomerId(null);
            setForm(emptyCustomerForm());
            setFormError(null);
            setIsComposerOpen(false);
            setSelectedCustomerId(result.customer.id);
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
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-400", children: "Clientes" }), _jsx("h2", { className: "text-3xl font-semibold tracking-tight text-white", children: "Clientes y tarifas" }), _jsx("p", { className: "mt-2 max-w-2xl text-sm text-slate-400", children: "Consulta de ficha, tarifas y actividad reciente del cliente desde una vista unica." })] }), _jsxs("button", { className: "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50", onClick: () => {
                            setEditingCustomerId(null);
                            setForm(emptyCustomerForm());
                            setFormError(null);
                            setIsComposerOpen(true);
                        }, type: "button", children: [_jsx(UserPlusIcon, { className: "h-5 w-5" }), "Nuevo cliente"] })] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-[0.92fr_1.08fr]", children: [_jsxs("div", { className: `space-y-4 ${mobilePane === "detail" ? "hidden xl:block" : "block"}`, children: [_jsx("div", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-4", children: _jsx("input", { className: "w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-gray-500 focus:border-cyan-500/50", onChange: (event) => setSearch(event.target.value), placeholder: "Buscar cliente", value: search }) }), _jsxs("div", { className: "space-y-3", children: [isLoading ? (_jsx("p", { className: "text-sm text-gray-400", children: "Cargando clientes..." })) : null, filteredCustomers.map((customer) => (_jsxs("button", { className: `w-full rounded-2xl border p-4 text-left transition-colors ${selectedCustomer?.id === customer.id
                                            ? "border-cyan-400/30 bg-cyan-400/10"
                                            : "border-white/10 bg-slate-900/70 hover:border-white/20"}`, onClick: () => {
                                            setSelectedCustomerId(customer.id);
                                            setMobilePane("detail");
                                        }, type: "button", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-semibold text-white", children: customer.name }), _jsx("p", { className: "mt-1 text-sm text-slate-400", children: customer.phone ?? customer.email ?? "Sin contacto rapido" })] }), _jsxs("div", { className: "rounded-lg bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300", children: [customer.specialPieces.length, " piezas"] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2 text-xs", children: [_jsxs("span", { className: "rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-200", children: ["ML ", customer.pricePerLinearMeter.toFixed(2), " \u20AC"] }), _jsxs("span", { className: "rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200", children: ["M2 ", customer.pricePerSquareMeter.toFixed(2), " \u20AC"] })] })] }, customer.id))), !isLoading && filteredCustomers.length === 0 ? (_jsx("div", { className: "rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500", children: "No hay clientes que coincidan con la busqueda." })) : null] })] }), _jsxs("div", { className: `space-y-4 ${mobilePane === "list" ? "hidden xl:block" : "block"}`, children: [selectedCustomer ? (_jsxs("article", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-5", children: [_jsxs("button", { className: "mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white xl:hidden", onClick: () => setMobilePane("list"), type: "button", children: [_jsx(ArrowLeftIcon, { className: "h-4 w-4" }), "Volver a la lista"] }), _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-400", children: "Ficha activa" }), _jsx("h3", { className: "mt-1 text-2xl font-semibold text-white", children: selectedCustomer.name }), _jsx("p", { className: "mt-2 text-sm text-slate-400", children: selectedCustomer.address ?? "Sin direccion" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 sm:flex", children: [_jsx("button", { className: "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white", onClick: () => {
                                                            setEditingCustomerId(selectedCustomer.id);
                                                            setForm(customerToFormState(selectedCustomer));
                                                            setFormError(null);
                                                            setIsComposerOpen(true);
                                                        }, type: "button", children: "Editar" }), _jsx("button", { className: "rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200", onClick: () => {
                                                            if (window.confirm(`Eliminar a ${selectedCustomer.name}?`)) {
                                                                deleteMutation.mutate(selectedCustomer.id);
                                                            }
                                                        }, type: "button", children: "Eliminar" })] })] }), _jsx("div", { className: "mt-5 grid gap-3 sm:grid-cols-3", children: priceTiles.map((tile) => (_jsxs("div", { className: `rounded-2xl border p-4 ${tile.accent}`, children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em]", children: tile.label }), _jsxs("p", { className: "mt-2 text-2xl font-bold", children: [selectedCustomer[tile.key].toFixed(2), " \u20AC"] })] }, tile.key))) }), _jsxs("div", { className: "mt-5 grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-gray-950/50 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Contacto" }), _jsx("p", { className: "mt-3 text-sm text-white", children: selectedCustomer.email ?? "Sin email" }), _jsx("p", { className: "mt-1 text-sm text-gray-400", children: selectedCustomer.phone ?? "Sin telefono" })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-gray-950/50 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Grosor" }), _jsxs("p", { className: "mt-3 text-sm text-white", children: ["Minimo ", selectedCustomer.grosorMm?.toFixed(1) ?? "N/A", " mm"] }), _jsxs("p", { className: "mt-1 text-sm text-gray-400", children: ["Suplemento ", selectedCustomer.grosorPrecio?.toFixed(2) ?? "0.00", " \u20AC"] })] })] }), _jsxs("div", { className: "mt-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h4", { className: "text-sm font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Piezas especiales" }), _jsx("span", { className: "text-xs text-gray-500", children: "Toque rapido para futuras entradas" })] }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: selectedCustomer.specialPieces.length ? (selectedCustomer.specialPieces.map((piece, index) => (_jsxs("span", { className: "rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100", children: [piece.name, " \u00B7 ", piece.price.toFixed(2), " \u20AC"] }, `${selectedCustomer.id}-piece-${index}`)))) : (_jsx("span", { className: "rounded-full border border-dashed border-white/10 px-3 py-2 text-sm text-gray-500", children: "Sin piezas especiales" })) })] }), _jsxs("div", { className: "mt-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Albaranes" }), _jsx("p", { className: "text-sm text-gray-500", children: "Historial operativo del cliente seleccionado." })] }), _jsxs("span", { className: "rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300", children: [customerNotesQuery.data?.deliveryNotes.length ?? 0, " registros"] })] }), _jsxs("div", { className: "mt-3 space-y-3", children: [customerNotesQuery.isLoading ? (_jsx("div", { className: "rounded-2xl border border-white/10 bg-gray-950/50 p-4 text-sm text-gray-400", children: "Cargando albaranes..." })) : null, customerNotesQuery.data?.deliveryNotes.length ? (customerNotesQuery.data.deliveryNotes.map((note) => (_jsxs(Link, { className: "block rounded-2xl border border-white/10 bg-gray-950/50 p-4 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5", to: `/delivery-notes?noteId=${encodeURIComponent(note.id)}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-white", children: note.number }), _jsxs("div", { className: "mt-2 flex items-center gap-2 text-sm text-gray-400", children: [_jsx(CalendarDaysIcon, { className: "h-4 w-4 text-cyan-300" }), new Date(note.date).toLocaleDateString("es-ES")] })] }), _jsx("span", { className: `rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`, children: statusLabel[note.status] })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-gray-500", children: [note.items.length, " lineas"] }), _jsxs("span", { className: "font-mono text-cyan-300", children: [note.totalAmount.toFixed(2), " \u20AC"] })] })] }, note.id)))) : customerNotesQuery.isLoading ? null : (_jsx("div", { className: "rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-500", children: "Este cliente aun no tiene albaranes." }))] })] })] })) : null, isComposerOpen ? (_jsxs("div", { className: "fixed inset-0 z-40 flex items-end bg-gray-950/75 backdrop-blur sm:items-center sm:justify-center", children: [_jsx("button", { "aria-label": "Cerrar formulario de cliente", className: "absolute inset-0", onClick: () => {
                                            setEditingCustomerId(null);
                                            setForm(emptyCustomerForm());
                                            setFormError(null);
                                            setIsComposerOpen(false);
                                        }, type: "button" }), _jsxs("form", { className: "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b1220] p-5 shadow-2xl shadow-cyan-950/40 sm:max-w-3xl sm:rounded-[2rem] sm:p-6", onSubmit: handleSubmit, children: [_jsxs("div", { className: "sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-cyan-300", children: editingCustomerId ? "Editar cliente" : "Alta rapida" }), _jsx("h3", { className: "mt-1 text-xl font-bold text-white", children: editingCustomerId ? "Actualizar ficha" : "Nuevo cliente" })] }), _jsx("button", { className: "rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-300", onClick: () => {
                                                            setEditingCustomerId(null);
                                                            setForm(emptyCustomerForm());
                                                            setFormError(null);
                                                            setIsComposerOpen(false);
                                                        }, type: "button", children: "Cerrar" })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => setForm((current) => ({ ...current, name: event.target.value })), placeholder: "Nombre del cliente", value: form.name }), _jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => setForm((current) => ({ ...current, phone: event.target.value })), placeholder: "Telefono", value: form.phone }), _jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500 sm:col-span-2", onChange: (event) => setForm((current) => ({ ...current, email: event.target.value })), placeholder: "Email", value: form.email }), _jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500 sm:col-span-2", onChange: (event) => setForm((current) => ({ ...current, address: event.target.value })), placeholder: "Direccion", value: form.address })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-3", children: priceTiles.map((tile) => (_jsxs("label", { className: `rounded-2xl border p-4 ${tile.accent}`, children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.24em]", children: tile.label }), _jsx("input", { className: "mt-3 w-full bg-transparent text-center text-2xl font-bold outline-none", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                                ...current,
                                                                [tile.key]: event.target.value
                                                            })), value: form[tile.key] })] }, tile.key))) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", inputMode: "decimal", onChange: (event) => setForm((current) => ({ ...current, grosorMm: event.target.value })), placeholder: "Grosor minimo (mm)", value: form.grosorMm }), _jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                            ...current,
                                                            grosorPrecio: event.target.value
                                                        })), placeholder: "Suplemento grosor", value: form.grosorPrecio })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold uppercase tracking-[0.24em] text-gray-400", children: "Piezas especiales" }), _jsx("p", { className: "text-sm text-gray-500", children: "Crea las frecuentes sin escribir de mas." })] }), _jsxs("button", { className: "inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-gray-200", onClick: () => setForm((current) => ({
                                                                    ...current,
                                                                    specialPieces: [...current.specialPieces, { name: "", price: "" }]
                                                                })), type: "button", children: [_jsx(PlusIcon, { className: "h-4 w-4" }), "Manual"] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: quickSpecialPieces.map((piece) => (_jsx("button", { className: "rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100", onClick: () => setForm((current) => {
                                                                if (current.specialPieces.some((entry) => entry.name.toLowerCase() === piece.toLowerCase())) {
                                                                    return current;
                                                                }
                                                                return {
                                                                    ...current,
                                                                    specialPieces: [
                                                                        ...current.specialPieces,
                                                                        { name: piece, price: "" }
                                                                    ]
                                                                };
                                                            }), type: "button", children: piece }, piece))) }), _jsx("div", { className: "space-y-3", children: form.specialPieces.map((piece, index) => (_jsxs("div", { className: "grid gap-3 rounded-2xl border border-white/10 bg-gray-950/50 p-3 sm:grid-cols-[1fr_140px_auto]", children: [_jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => setForm((current) => ({
                                                                        ...current,
                                                                        specialPieces: current.specialPieces.map((entry, entryIndex) => entryIndex === index
                                                                            ? { ...entry, name: event.target.value }
                                                                            : entry)
                                                                    })), placeholder: "Nombre de pieza", value: piece.name }), _jsx("input", { className: "rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", inputMode: "decimal", onChange: (event) => setForm((current) => ({
                                                                        ...current,
                                                                        specialPieces: current.specialPieces.map((entry, entryIndex) => entryIndex === index
                                                                            ? { ...entry, price: event.target.value }
                                                                            : entry)
                                                                    })), placeholder: "Precio", value: piece.price }), _jsx("button", { className: "inline-flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-red-200", onClick: () => setForm((current) => ({
                                                                        ...current,
                                                                        specialPieces: current.specialPieces.filter((_, entryIndex) => entryIndex !== index)
                                                                    })), type: "button", children: _jsx(TrashIcon, { className: "h-5 w-5" }) })] }, `piece-${index}`))) })] }), _jsx("textarea", { className: "min-h-24 w-full rounded-2xl border border-white/10 bg-gray-950/60 px-4 py-3 text-sm text-white placeholder:text-gray-500", onChange: (event) => setForm((current) => ({ ...current, notes: event.target.value })), placeholder: "Notas internas", value: form.notes }), formError || mutationError ? (_jsx("p", { className: "rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200", children: formError ?? mutationError })) : null, _jsx("div", { className: "sticky bottom-0 flex gap-3 rounded-2xl border border-white/10 bg-gray-950/90 p-3 backdrop-blur", children: _jsx("button", { className: "flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-gray-950", disabled: createMutation.isPending || updateMutation.isPending, type: "submit", children: editingCustomerId ? "Guardar cambios" : "Crear cliente" }) })] })] })) : (_jsx("div", { className: "rounded-2xl border border-dashed border-white/10 p-8 text-sm text-slate-500", children: "Selecciona un cliente de la lista para ver su ficha, tarifas y albaranes." }))] })] })] }));
};
