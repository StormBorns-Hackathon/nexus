import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Menu, X, Zap } from "lucide-react"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#why-us" },
  { label: "Testimonials", href: "#testimonials" },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/50 bg-background/60 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a
          href="#"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="glow-primary-sm flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">
            Nexus
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/signin">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Sign In
            </Button>
          </Link>
          <Link to="/signup">
            <Button
              size="sm"
              className="glow-primary-sm bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="border-b border-border/50 bg-background/95 px-6 pb-6 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Link to="/signin">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button
                size="sm"
                className="glow-primary-sm mt-1 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
