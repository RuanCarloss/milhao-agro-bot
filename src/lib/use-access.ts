import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getMyAccess } from "@/lib/admin.functions";

export function useAccess() {
  const { user } = useAuth();
  const fn = useServerFn(getMyAccess);
  const q = useQuery({
    queryKey: ["my-access", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
  return {
    isAdmin: q.data?.isAdmin ?? false,
    canControlBot: q.data?.canControlBot ?? false,
    canEditSettings: q.data?.canEditSettings ?? false,
    loading: q.isLoading,
  };
}
