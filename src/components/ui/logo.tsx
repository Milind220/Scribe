import { useTheme } from "next-themes"
import Image from "next/image"

interface LogoProps {
  className?: string
  width?: number
  height?: number
}

export function Logo({ className = "", width = 40, height = 40 }: LogoProps) {
  const { theme } = useTheme()
  
  return (
    <div className={className}>
      <Image
        src={theme === "dark" ? "/logos/logo-light.png" : "/logos/logo-dark.png"}
        alt="Scribe Logo"
        width={width}
        height={height}
        priority
      />
    </div>
  )
} 