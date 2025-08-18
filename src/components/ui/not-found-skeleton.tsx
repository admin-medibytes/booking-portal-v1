import { Skeleton } from "@/components/ui/skeleton";

export function NotFound404Skeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
          <Skeleton className="h-10 w-20 mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}