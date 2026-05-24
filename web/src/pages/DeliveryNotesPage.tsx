import { useQuery } from "@tanstack/react-query";
import { getDeliveryNotes } from "@/application/use-cases";

const badgeByStatus: Record<string, string> = {
  DRAFT: "bg-gray-700 text-gray-300",
  PENDING: "border border-yellow-700/50 bg-yellow-900/30 text-yellow-400",
  REVIEWED: "border border-green-700/50 bg-green-900/30 text-green-400"
};

export const DeliveryNotesPage = () => {
  const { data } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: getDeliveryNotes
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Albaranes</h2>
        <p className="text-sm text-gray-400">Consulta y seguimiento operativo.</p>
      </div>

      <div className="space-y-4">
        {data?.deliveryNotes.map((note) => (
          <article className="rounded-xl border border-gray-700 bg-gray-800 p-5" key={note.id}>
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
          </article>
        ))}
      </div>
    </section>
  );
};

