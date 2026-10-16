"use client";

import { useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Just the fields the search and filters look at
export interface TeamSearchFields {
  name: string;
  role: string;
  bio?: string;
  years?: string[];
  board: string;
}

// The search and filters of the team directory. The member cards are rendered
// on the server and passed in by member name, so neither their code nor the
// team data file ships to the browser; this component only decides which to
// show.
export function TeamDirectory({
  members,
  years,
  boards,
  cards,
}: {
  members: TeamSearchFields[];
  years: string[];
  boards: string[];
  cards: Record<string, ReactNode>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterBoard, setFilterBoard] = useState<string>("all");

  let filteredMembers = members;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredMembers = filteredMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query) ||
        (member.bio && member.bio.toLowerCase().includes(query)),
    );
  }

  if (filterYear !== "all") {
    filteredMembers = filteredMembers.filter((member) => {
      if (filterYear.includes(" ")) {
        return member.years?.includes(filterYear);
      } else {
        return member.years?.some((yearEntry) =>
          yearEntry.includes(filterYear),
        );
      }
    });
  }

  if (filterBoard !== "all") {
    filteredMembers = filteredMembers.filter(
      (member) => member.board === filterBoard,
    );
  }

  const clearFilters = () => {
    setSearchQuery("");
    setFilterYear("all");
    setFilterBoard("all");
  };

  const hasActiveFilters =
    searchQuery || filterYear !== "all" || filterBoard !== "all";

  return (
    <>
      {/* Search and filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, role, or bio"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 sm:w-auto">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year === "all" ? "All Years" : year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterBoard} onValueChange={setFilterBoard}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Board" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board} value={board}>
                  {board === "all" ? "All Boards" : board}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear filters</span>
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredMembers.length}{" "}
          {filteredMembers.length === 1 ? "member" : "members"} found
        </p>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Team members grid */}
      {filteredMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member, index) => (
            <div
              key={member.name}
              className="motion-safe:animate-fade-up"
              style={{
                animationDuration: "0.4s",
                animationDelay: `${index * 0.05}s`,
                animationTimingFunction: "cubic-bezier(0.19, 1, 0.22, 1)",
              }}
            >
              {cards[member.name]}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <h3 className="text-xl font-medium mb-2">No team members found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filters
          </p>
          <Button variant="outline" onClick={clearFilters} className="mt-4">
            Clear all filters
          </Button>
        </div>
      )}
    </>
  );
}
