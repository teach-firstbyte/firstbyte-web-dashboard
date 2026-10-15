import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Pill-shaped, like the marketing site's buttons.
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_14%,transparent)] hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-card shadow-xs hover:border-primary/60 hover:bg-card dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3.5",
        xs: "h-6 gap-1 rounded-full px-2.5 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-full px-3.5 has-[>svg]:px-3",
        lg: "h-11 rounded-full px-6 text-base has-[>svg]:px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonBaseProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export type ButtonProps = ButtonBaseProps & {
  /** Shows a spinner, disables the button, and sets aria-busy. */
  pending?: boolean;
  /**
   * Replaces the children while pending. Omit it to keep the label in place and
   * only add the spinner; pass `null` for a spinner-only button, which is what
   * cramped `size="sm"` rows want.
   */
  pendingLabel?: React.ReactNode;
};

// `asChild` renders through Slot.Root, which throws unless its children resolve
// to exactly one element -- so a spinner can't be injected alongside them. Making
// that a type error beats a runtime crash. An asChild caller that needs a pending
// state renders <Spinner /> inside the slotted child itself.
type ButtonComponentProps =
  | (ButtonProps & { asChild?: false })
  | (ButtonBaseProps & {
      asChild: true;
      pending?: never;
      pendingLabel?: never;
    });

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending,
  pendingLabel,
  disabled,
  type,
  children,
  ...props
}: ButtonComponentProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  if (asChild) {
    // No `type` in this branch: it would land on the slotted <a>, where it means
    // something else entirely.
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-pending={pending ? "" : undefined}
      className={classes}
      // Buttons default to submit in HTML, which silently turns any in-form
      // button into a submit button. Use SubmitButton to submit a form.
      type={type ?? "button"}
      {...props}
      // After the spread on purpose: `pending` owns these two. `disabled` is
      // destructured above so a caller's own value is OR'd rather than clobbered.
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <Spinner />}
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}

export { Button, buttonVariants };
