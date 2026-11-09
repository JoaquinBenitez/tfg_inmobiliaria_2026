// src/components/layout/Navbar.tsx
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { config } from '@/config'
import { ComparisonBadge } from "@/components/shared/ComparisonBadge"

// Esto vendría de tu API más adelante
const PROPERTIES = {
    venta: [
        { title: "Casas", href: config.routes.sale.houses },
        { title: "Departamentos", href: config.routes.sale.apartments },
        { title: "Terrenos", href: config.routes.sale.land },
    ],
    alquiler: [
        { title: "Casas", href: config.routes.rent.houses },
        { title: "Departamentos", href: config.routes.rent.apartments },
    ],
} as const;

// Se quitó CONTACT_OPTIONS - ahora se usa link de contacto directo

export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-sm border-b-2 border-primary shadow-sm">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
                        Inversiones Inmobiliarias
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-4">
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-1">
                                    Alquiler <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-white/80 backdrop-blur-sm">
                                {PROPERTIES.alquiler.map((property) => (
                                    <DropdownMenuItem key={property.href} asChild>
                                        <Link
                                            href={property.href}
                                            className="w-full cursor-pointer"
                                        >
                                            {property.title}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-1">
                                    Venta <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-white/80 backdrop-blur-sm">
                                {PROPERTIES.venta.map((property) => (
                                    <DropdownMenuItem key={property.href} asChild>
                                        <Link
                                            href={property.href}
                                            className="w-full cursor-pointer"
                                        >
                                            {property.title}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Link href="/nosotros">
                            <Button variant="ghost">Nosotros</Button>
                        </Link>

                        <Link href="/contacto">
                            <Button variant="ghost">Contacto</Button>
                        </Link>

                        {/* Comparison Badge - Shows when properties are added to compare */}
                        <ComparisonBadge />

                    </div>

                    {/* Social Media Icons */}
                    <div className="flex space-x-4">
                        <a href="#" className="hover:opacity-80">
                            <Image
                                src="/facebook.svg"
                                alt="Facebook"
                                width={20}
                                height={20}
                                className="w-5 h-5 cursor-pointer"
                            />
                        </a>
                        <a href="#" className="hover:opacity-80">
                            <Image
                                src="/instagram.svg"
                                alt="Instagram"
                                width={20}
                                height={20}
                                className="w-5 h-5 cursor-pointer"
                            />
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
}