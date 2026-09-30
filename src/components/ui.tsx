import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "lg" };
export function Button({ variant="default", size="default", className="", type="button", ...props }: ButtonProps) {
  return <button type={type} className={`btn ${variant === "outline" ? "btn-outline" : variant === "ghost" ? "btn-ghost" : ""} ${size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : ""} ${className}`} {...props}/>;
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className="", ...props }, ref) {
  return <input ref={ref} className={`input ${className}`} {...props}/>;
});
