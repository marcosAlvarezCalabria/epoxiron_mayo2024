import { useQuery } from "@tanstack/react-query";
import { getHermesTasks } from "@/application/use-cases";

export const useHermesTasks = () =>
  useQuery({
    queryKey: ["hermes-tasks"],
    queryFn: getHermesTasks,
    refetchInterval: 30000
  });

