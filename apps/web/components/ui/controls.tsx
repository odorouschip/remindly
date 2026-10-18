import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./controls.module.css";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx(styles.button, styles[variant], size === "sm" && styles.sm, className)} {...rest} />
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & {
  /** Used for both the tooltip and the accessible name. */
  label: string;
  size?: number;
  pressed?: boolean;
  children: ReactNode;
};

export function IconButton({ label, size = 28, pressed, className, style, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className={cx(styles.iconButton, className)}
      style={{ width: size, height: size, ...style }} {...rest} />
  );
}

type SegmentedProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  ariaLabel: string;
};

export function Segmented<T extends string>({ options, value, onChange, fullWidth, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cx(styles.segmented, fullWidth && styles.full)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value}
          className={styles.segment} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className={styles.switch} onClick={() => onChange(!checked)} />
  );
}
