export default function Button({
  children,
  variant = "default",
  size = "medium",
  className = "",
  fullWidth = false,
  ...props
}) {
  const baseClass = "app-btn";
  const variantClass = `app-btn-${variant}`;
  const sizeClass = `app-btn-${size}`;
  const widthClass = fullWidth ? "app-btn-full" : "";

  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
