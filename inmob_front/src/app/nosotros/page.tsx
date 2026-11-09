import Navbar from '@/components/layout/Navbar';
import { Building2, Users, Award, MapPin } from 'lucide-react';

export default function AboutPage() {
    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-background">
                {/* Hero Section */}
                <section className="bg-gradient-to-r from-primary to-primary-dark text-primary-foreground py-16 lg:py-20 mt-16">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto text-center">
                            <h1 className="text-4xl md:text-5xl font-bold mb-6">
                                Sobre Nosotros
                            </h1>
                            <p className="text-xl md:text-2xl opacity-90">
                                Tu socio de confianza en el mercado inmobiliario
                            </p>
                        </div>
                    </div>
                </section>

                {/* Main Content */}
                <section className="py-16">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto">
                            {/* Company Description */}
                            <div className="bg-card rounded-lg shadow-lg p-8 mb-12">
                                <h2 className="text-3xl font-bold text-foreground mb-6">
                                    Nuestra Historia
                                </h2>
                                <div className="prose prose-lg max-w-none text-muted-foreground">
                                    <p className="mb-4">
                                        Con más de 25 años de experiencia en el mercado inmobiliario local, 
                                        nos hemos consolidado como una de las inmobiliarias más confiables 
                                        de la región. Nuestro compromiso es brindar un servicio personalizado 
                                        y profesional a cada uno de nuestros clientes.
                                    </p>
                                    <p className="mb-4">
                                        Especializados en la compra, venta y alquiler de propiedades, 
                                        trabajamos con un amplio portafolio que incluye casas, departamentos, 
                                        terrenos y locales comerciales. Nuestro equipo de profesionales 
                                        altamente capacitados te acompañará en cada paso del proceso.
                                    </p>
                                </div>
                            </div>

                            {/* Features Grid */}
                            <div className="grid md:grid-cols-2 gap-8 mb-12">
                                {/* Mission */}
                                <div className="bg-card rounded-lg shadow-lg p-8">
                                    <div className="flex items-center mb-4">
                                        <Building2 className="h-8 w-8 text-primary mr-3" />
                                        <h3 className="text-2xl font-bold text-foreground">
                                            Nuestra Misión
                                        </h3>
                                    </div>
                                    <p className="text-muted-foreground">
                                        Facilitar el acceso a la vivienda y la inversión inmobiliaria, 
                                        brindando asesoramiento profesional y transparente para que 
                                        nuestros clientes tomen las mejores decisiones.
                                    </p>
                                </div>

                                {/* Vision */}
                                <div className="bg-card rounded-lg shadow-lg p-8">
                                    <div className="flex items-center mb-4">
                                        <Award className="h-8 w-8 text-primary mr-3" />
                                        <h3 className="text-2xl font-bold text-foreground">
                                            Nuestra Visión
                                        </h3>
                                    </div>
                                    <p className="text-muted-foreground">
                                        Ser la inmobiliaria líder en la región, reconocida por 
                                        nuestra excelencia en el servicio, innovación tecnológica 
                                        y compromiso con la satisfacción del cliente.
                                    </p>
                                </div>
                            </div>

                            {/* Values */}
                            <div className="bg-card rounded-lg shadow-lg p-8 mb-12">
                                <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
                                    Nuestros Valores
                                </h3>
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className="bg-accent rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                            <Users className="h-8 w-8 text-primary" />
                                        </div>
                                        <h4 className="font-semibold text-foreground mb-2">Confianza</h4>
                                        <p className="text-muted-foreground text-sm">
                                            Construimos relaciones duraderas basadas en la transparencia y honestidad.
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <div className="bg-accent rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                            <Award className="h-8 w-8 text-primary" />
                                        </div>
                                        <h4 className="font-semibold text-foreground mb-2">Excelencia</h4>
                                        <p className="text-muted-foreground text-sm">
                                            Nos esforzamos por superar las expectativas en cada transacción.
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <div className="bg-accent rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                            <MapPin className="h-8 w-8 text-primary" />
                                        </div>
                                        <h4 className="font-semibold text-foreground mb-2">Compromiso local</h4>
                                        <p className="text-muted-foreground text-sm">
                                            Conocemos profundamente el mercado local y sus oportunidades.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Team Section */}
                            <div className="bg-card rounded-lg shadow-lg p-8">
                                <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
                                    Nuestro Equipo
                                </h3>
                                <p className="text-muted-foreground text-center mb-8">
                                    Contamos con un equipo de profesionales especializados en diferentes 
                                    áreas del mercado inmobiliario, listos para brindarte el mejor servicio.
                                </p>
                                
                                {/* Placeholder for team members - you can add actual team info later */}
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className="bg-muted rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                                            <Users className="h-12 w-12 text-muted-foreground" />
                                        </div>
                                        <h4 className="font-semibold text-foreground">[Nombre del Director]</h4>
                                        <p className="text-muted-foreground text-sm">Director general</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="bg-muted rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                                            <Users className="h-12 w-12 text-muted-foreground" />
                                        </div>
                                        <h4 className="font-semibold text-foreground">[Nombre del Agente]</h4>
                                        <p className="text-muted-foreground text-sm">Agente inmobiliario senior</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="bg-muted rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                                            <Users className="h-12 w-12 text-muted-foreground" />
                                        </div>
                                        <h4 className="font-semibold text-foreground">[Nombre del Asesor]</h4>
                                        <p className="text-muted-foreground text-sm">Asesor comercial</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
} 