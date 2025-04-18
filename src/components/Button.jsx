import clsx from "clsx"

export default function Button({ 
  children, 
  className, 
  variant = "primary", 
  size = "md", 
  ...otherProps 
}) {
  const baseClasses = "btn-shadow relative overflow-hidden rounded-md font-semibold transition-all duration-300";
  
  const variantClasses = {
    primary: "bg-gradient-primary text-white hover:shadow-glow",
    secondary: "bg-gradient-secondary text-white",
    outline: "bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white",
    ghost: "bg-transparent text-primary hover:bg-primary/10",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  
  const sizeClasses = {
    sm: "py-1 px-3 text-sm",
    md: "py-2 px-4 text-base",
    lg: "py-3 px-6 text-lg",
    xl: "py-4 px-8 text-xl",
  };
  
  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...otherProps}
    >
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-gradient-to-r from-transparent via-white/5 to-transparent blur-sm transition-opacity duration-1000"></div>
    </button>
  )
}
