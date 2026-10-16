"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Book,
  Contact,
  FileCode,
  HelpCircle,
  Home,
  Mail,
  Moon,
  Sun,
  Users,
  User,
  Linkedin,
  Github,
  Globe,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { DialogTitle } from "@/components/ui/dialog";
import teamData from "@/data/team.json";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function CommandMenu({
  defaultOpen = false,
}: {
  // True when CommandMenuLoader mounts this in answer to the first ⌘K press
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  // Get current team members (has 2026 in their years array)
  const currentTeamMembers = teamData.allTeamMembers.filter((member) =>
    member.years?.includes("2026"),
  );

  // Extract unique team roles for searching
  const teamRoles = new Set<string>();
  currentTeamMembers.forEach((member) => {
    const roleWords = member.role.split(/,|\s+/);
    roleWords.forEach((word) => {
      if (
        word.includes("Team") ||
        word.includes("Lead") ||
        word === "President" ||
        word === "Vice" ||
        word === "Treasurer"
      ) {
        teamRoles.add(word);
      }
    });
  });

  // Filter team members based on search query
  const filteredTeamMembers = currentTeamMembers.filter((member) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();

    // Search by name
    if (member.name.toLowerCase().includes(searchLower)) return true;

    // Search by role
    if (member.role.toLowerCase().includes(searchLower)) return true;

    // Search by year
    if (member.years?.some((year) => year.includes(searchLower))) return true;

    // Search by team (extracted from role)
    const memberTeams = member.role
      .split(/,|\s+/)
      .filter(
        (word) =>
          word.includes("Team") ||
          word.includes("Lead") ||
          word === "President" ||
          word === "Vice" ||
          word === "Treasurer",
      );

    if (memberTeams.some((team) => team.toLowerCase().includes(searchLower)))
      return true;

    return false;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">Command Menu</DialogTitle>
      <CommandInput
        placeholder="Type a command or search for team members, roles, or years..."
        value={search}
        onValueChange={setSearch}
        className="h-14"
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {!search && (
          <>
            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => runCommand(() => router.push("/#home"))}
              >
                <Home className="mr-2 h-4 w-4" />
                <span>Home</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push("/#about"))}
              >
                <FileCode className="mr-2 h-4 w-4" />
                <span>About</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push("/#programs"))}
              >
                <Book className="mr-2 h-4 w-4" />
                <span>Programs</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push("/#team"))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Team</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push("/#contact"))}
              >
                <Contact className="mr-2 h-4 w-4" />
                <span>Contact</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Team Members Group */}
        <CommandGroup heading={search ? "Team Members" : "Current Team"}>
          {filteredTeamMembers.map((member) => (
            <CommandItem
              key={member.name}
              onSelect={() =>
                runCommand(() => {
                  // If member has a LinkedIn profile, open it in a new tab
                  if (member.linkedin) {
                    window.open(member.linkedin, "_blank");
                  } else {
                    // Otherwise navigate to team section
                    router.push("/#team");
                  }
                })
              }
              className="flex items-center gap-3 py-3"
            >
              <div className="flex items-center gap-3 flex-1">
                {member.image ? (
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={member.image} alt={member.name} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <User className="h-5 w-5" />
                )}
                <div className="flex flex-col">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[350px]">
                    {member.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {member.years?.join(", ")}
                  </span>
                </div>
              </div>

              {/* Social icons */}
              <div className="flex gap-2 justify-end">
                {member.linkedin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(member.linkedin, "_blank");
                    }}
                    className="opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-accent p-1.5"
                  >
                    <Linkedin className="h-4 w-4" />
                  </button>
                )}
                {member.github && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(member.github, "_blank");
                    }}
                    className="opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-accent p-1.5"
                  >
                    <Github className="h-4 w-4" />
                  </button>
                )}
                {member.website && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(member.website, "_blank");
                    }}
                    className="opacity-60 hover:opacity-100 transition-opacity rounded-full hover:bg-accent p-1.5"
                  >
                    <Globe className="h-4 w-4" />
                  </button>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        {!search && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() =>
                  runCommand(() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark"),
                  )
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                <span>Toggle Theme</span>
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  runCommand(() =>
                    window.open("mailto:info@firstbyte.org", "_blank"),
                  )
                }
              >
                <Mail className="mr-2 h-4 w-4" />
                <span>Email us</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push("/#about"))}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
