"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

// Shared styling for the native <select> below. It stays a native control rather
// than the Radix Select primitive because callers pass native onChange handlers
// and rely on native form submission; `color-scheme` (set by next-themes) is what
// darkens the OS-rendered option popup.
const nativeControl =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

interface ModalProps extends React.ComponentProps<"div"> {
  onClose?: () => void;
  isOpen?: boolean;
}

function Modal({
  className,
  onClose,
  isOpen = true,
  children,
  ...props
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      data-slot="modal-overlay"
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <div
        data-slot="modal"
        className={cn(
          "bg-popover text-popover-foreground border rounded-lg shadow-lg p-6 w-96",
          className,
        )}
        onClick={(e) => e.stopPropagation()} // prevent closing on inner clicks
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-header"
      className={cn("text-lg font-semibold mb-4", className)}
      {...props}
    />
  );
}

interface ModalFormProps {
  newUser: { name: string | null; email: string };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  children?: React.ReactNode;
}

function ModalForm({ newUser, onChange, onSubmit, children }: ModalFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col space-y-3">
      <Input
        type="text"
        name="name"
        value={newUser.name ?? ""}
        onChange={onChange}
        placeholder="Name"
        required
      />
      <Input
        type="email"
        name="email"
        value={newUser.email}
        onChange={onChange}
        placeholder="Email"
        required
      />

      <div className="flex justify-end space-x-2 pt-2">{children}</div>
    </form>
  );
}

// Its own `variant` union shadows Button's, so that one is omitted rather than
// widened. Everything else -- including `pending` and `pendingLabel` -- passes
// straight through.
function ModalButton({
  variant = "primary",
  className,
  ...props
}: Omit<ButtonProps, "variant" | "asChild"> & {
  variant?: "primary" | "cancel";
}) {
  return (
    <Button
      variant={variant === "primary" ? "brand" : "secondary"}
      size="sm"
      className={className}
      {...props}
    />
  );
}

// Shown beside a control's label while its options are still being fetched. Keeps
// the label itself stable, rather than overwriting it with "Loading…".
function ControlLabel({
  label,
  loading,
}: {
  label: string;
  loading?: boolean;
}) {
  return (
    <label className="mb-1 flex items-center gap-2 text-sm font-medium">
      {label}
      {loading && <Spinner className="size-3" />}
    </label>
  );
}

interface ModalDropdownProps {
  label?: string;
  value: string | number | null;
  options: Array<{ value: string | number; label: string }>;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

function ModalDropdown({
  label,
  value,
  options,
  onChange,
  required,
  disabled,
  loading,
  className,
}: ModalDropdownProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <ControlLabel label={label} loading={loading} />}
      <select
        className={nativeControl}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
      >
        <option value="" disabled>
          Select an option...
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ModalCheckboxesProps {
  label?: string;
  options: Array<{ value: string | number; label: string }>;
  selected: Array<string | number>;
  onToggle: (value: string | number) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

function ModalCheckboxes({
  label,
  options,
  selected,
  onToggle,
  disabled,
  loading,
  className,
}: ModalCheckboxesProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <ControlLabel label={label} loading={loading} />}
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => onToggle(opt.value)}
            disabled={disabled}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export {
  Modal,
  ModalHeader,
  ModalForm,
  ModalButton,
  ModalDropdown,
  ModalCheckboxes,
  ControlLabel,
};
