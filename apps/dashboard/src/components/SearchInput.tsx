"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export function SearchInput({
  placeholder = "Search by name, email, or meeting...",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);

      if (value.trim().length != 0) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }

      params.set("page", "1");

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 100);

    return () => clearTimeout(timer);
  }, [value, pathname, router]);

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
