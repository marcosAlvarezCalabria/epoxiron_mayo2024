interface ApiErrorStateProps {
  message: string;
  title?: string;
}

export const ApiErrorState = ({
  message,
  title = "No se pudieron cargar los datos"
}: ApiErrorStateProps) => {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-100">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-200">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-red-100">{message}</p>
    </div>
  );
};
