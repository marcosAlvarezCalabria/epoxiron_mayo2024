import { useQuery } from "@tanstack/react-query";
import { getCustomers } from "@/application/use-cases";

export const CustomersPage = () => {
  const { data } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Clientes</h2>
        <p className="text-sm text-gray-400">Listado base conectado a la API.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.customers.map((customer) => (
          <article className="rounded-xl border border-gray-700 bg-gray-800 p-5" key={customer.id}>
            <p className="text-lg font-bold text-gray-100">{customer.name}</p>
            <p className="mt-2 text-sm text-gray-400">{customer.email ?? "Sin email"}</p>
            <div className="mt-4 flex gap-3 text-sm">
              <span className="rounded-full border border-blue-700/50 bg-blue-900/30 px-3 py-1 text-blue-200">
                ML {customer.pricePerLinearMeter.toFixed(2)}€
              </span>
              <span className="rounded-full border border-purple-700/50 bg-purple-900/20 px-3 py-1 text-purple-200">
                M² {customer.pricePerSquareMeter.toFixed(2)}€
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

