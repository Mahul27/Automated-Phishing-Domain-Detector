// This is a reusable button component used across the whole application.
// It allows custom text, styles (variants), sizes, and widths.

export default function Button({
  children,            // The text or icon inside the button
  variant = "default", // Style look (e.g., "default", "outline")
  size = "medium",     // Button size (e.g., "small", "medium", "large")
  className = "",      // Any extra custom CSS classes passed from parent
  fullWidth = false,   // If true, button stretches to take full width
  ...props             // Any other standard button properties like onClick, disabled, type, etc.
}) {
  // Combine CSS classes based on the options passed in
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
