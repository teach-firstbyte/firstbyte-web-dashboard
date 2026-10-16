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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Program } from "./programs-data";

// The search, filters and grid/list toggle of the programs page. The cards
// themselves are rendered on the server and passed in by program id, so their
// code never ships to the browser; this component only decides which to show.
export function ProgramsBrowser({
  programs,
  categories,
  tags,
  gridCards,
  listRows,
}: {
  programs: Program[];
  categories: string[];
  tags: string[];
  gridCards: Record<string, ReactNode>;
  listRows: Record<string, ReactNode>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<string>("grid");

  let filteredPrograms = programs;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredPrograms = filteredPrograms.filter(
      (program) =>
        program.title.toLowerCase().includes(query) ||
        program.description.toLowerCase().includes(query) ||
        (program.longDescription &&
          program.longDescription.toLowerCase().includes(query)) ||
        (program.tags &&
          program.tags.some((tag) => tag.toLowerCase().includes(query))),
    );
  }

  if (filterCategory !== "All") {
    filteredPrograms = filteredPrograms.filter(
      (program) => program.category === filterCategory,
    );
  }

  if (filterTags.length > 0) {
    filteredPrograms = filteredPrograms.filter((program) => {
      // Ensure program.tags exists and is an array before checking includes
      return (
        Array.isArray(program.tags) &&
        program.tags.length > 0 &&
        filterTags.every((tag) => program.tags!.includes(tag))
      );
    });
  }

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("All");
    setFilterTags([]);
  };

  const hasActiveFilters =
    searchQuery || filterCategory !== "All" || filterTags.length > 0;

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const items = activeView === "grid" ? gridCards : listRows;

  return (
    <>
      {/* Search and filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programs"
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
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
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

      {/* Tags filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant={filterTags.includes(tag) ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-colors",
              filterTags.includes(tag)
                ? "bg-primary text-primary-foreground"
                : "hover:bg-primary/10",
            )}
            onClick={() => toggleTag(tag)}
          >
            {tag}
            {filterTags.includes(tag) && <X className="ml-1 h-3 w-3" />}
          </Badge>
        ))}
      </div>

      {/* Programs display */}
      {filteredPrograms.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {filteredPrograms.length}{" "}
              {filteredPrograms.length === 1 ? "program" : "programs"} found
            </p>

            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="h-7 px-3">
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list" className="h-7 px-3">
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Keyed by view so switching views remounts the cards and replays
              their fade-in, as it did when grid and list were separate lists */}
          <div
            key={activeView}
            className={
              activeView === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            }
          >
            {filteredPrograms.map((program, index) => (
              <div
                key={program.id}
                className="motion-safe:animate-fade-up"
                style={{
                  animationDuration: "0.4s",
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                {items[program.id]}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No programs match your search criteria.
          </p>
          <Button onClick={clearFilters}>Clear all filters</Button>
        </div>
      )}
    </>
  );
}
