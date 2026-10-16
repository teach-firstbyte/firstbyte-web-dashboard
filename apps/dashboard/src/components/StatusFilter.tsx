"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ATTENDANCE_STATUS_OPTIONS } from "@/lib/enums";

export function StatusFilter() {
  const router = useRouter();
  const pathName = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("status") ?? "ALL";

  const onValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === "ALL") {
      params.delete("status");
    } else {
      params.set("status", value);
    }

    params.set("page", "1");
    router.push(`${pathName}?${params.toString()}`);
  };

  return (
    <Select value={current} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-[180px]">
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All statuses</SelectItem>
        {ATTENDANCE_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
