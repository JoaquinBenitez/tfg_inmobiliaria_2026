'use client';

import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from 'lucide-react';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        propertyType: 'consulta-general'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Información de contacto - actualiza estos datos con la información real
    const contactInfo = {
        phone: '+54 3482 566020',
        whatsapp: '+543482566020',
        email: 'contacto@inversionesinmobiliarias.com.ar',
        address: 'Chacabuco 606, Reconquista, Santa Fe',
        hours: {
            weekdays: 'Lunes a Viernes: 08:00 - 12:00 y 16:00 - 20:00',
            saturday: 'Sábados: 9:00 - 13:00',
            sunday: 'Domingos: Cerrado'
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            // Aquí puedes integrar con tu backend para enviar el email
            // Por ahora simularemos el envío
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setSubmitStatus('success');
            setFormData({
                name: '',
                email: '',
                phone: '',
                subject: '',
                message: '',
                propertyType: 'consulta-general'
            });
        } catch {
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWhatsAppClick = () => {
        const message = encodeURIComponent(
            `Hola! Me interesa obtener más información sobre sus servicios inmobiliarios.`
        );
        window.open(`https://wa.me/${contactInfo.whatsapp}?text=${message}`, '_blank');
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-background">
                {/* Hero Section */}
                <section className="bg-gradient-to-r from-primary to-primary-dark text-primary-foreground py-16 lg:py-20 mt-16">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto text-center">
                            <h1 className="text-4xl md:text-5xl font-bold mb-6">
                                Contactanos
                            </h1>
                            <p className="text-xl md:text-2xl opacity-90">
                                Estamos para ayudarte con todas tus necesidades inmobiliarias
                            </p>
                        </div>
                    </div>
                </section>

                {/* Services Section */}
                <section className="py-16 bg-card">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-3xl font-bold text-center text-foreground mb-8">
                                Nuestros Servicios
                            </h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <div className="text-center p-4 bg-accent/50 rounded-lg">
                                    <div className="bg-accent rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                        <span className="text-primary font-semibold">🏠</span>
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2">Compra/Venta</h3>
                                    <p className="text-muted-foreground text-sm">Te ayudamos a encontrar tu hogar ideal o vender tu propiedad al mejor precio</p>
                                </div>
                                <div className="text-center p-4 bg-success/10 rounded-lg">
                                    <div className="bg-success/20 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                        <span className="text-success font-semibold">🔑</span>
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2">Alquileres</h3>
                                    <p className="text-muted-foreground text-sm">Gestión completa de alquileres con inquilinos verificados</p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                    <div className="bg-purple-100 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                        <span className="text-purple-600 font-semibold">📊</span>
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2">Tasaciones</h3>
                                    <p className="text-muted-foreground text-sm">Valuaciones profesionales para conocer el valor real de tu propiedad</p>
                                </div>
                                <div className="text-center p-4 bg-orange-50 rounded-lg">
                                    <div className="bg-orange-100 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                        <span className="text-orange-600 font-semibold">💼</span>
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2">Inversiones</h3>
                                    <p className="text-muted-foreground text-sm">Asesoramiento para inversiones inmobiliarias rentables</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Main Content */}
                <section className="py-16">
                    <div className="container mx-auto px-4">
                        <div className="max-w-6xl mx-auto">
                            <div className="grid lg:grid-cols-2 gap-12">
                                {/* Contact Form */}
                                <div className="bg-card rounded-lg shadow-lg p-8">
                                    <h2 className="text-2xl font-bold text-foreground mb-6">
                                        Envíanos un Mensaje
                                    </h2>
                                    
                                    {submitStatus === 'success' && (
                                        <div className="bg-success/20 border border-success text-success px-4 py-3 rounded mb-6">
                                            ¡Mensaje enviado exitosamente! Te contactaremos pronto.
                                        </div>
                                    )}
                                    
                                    {submitStatus === 'error' && (
                                        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-6">
                                            Error al enviar el mensaje. Por favor intenta nuevamente.
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                                                    Nombre Completo *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                                                    Teléfono
                                                </label>
                                                <input
                                                    type="tel"
                                                    id="phone"
                                                    name="phone"
                                                    value={formData.phone}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                                                Email *
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-3 py-2 border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="propertyType" className="block text-sm font-medium text-foreground mb-2">
                                                Tipo de Consulta
                                            </label>
                                            <select
                                                id="propertyType"
                                                name="propertyType"
                                                value={formData.propertyType}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
                                            >
                                                <option value="consulta-general">Consulta general</option>
                                                <option value="quiero-comprar">Quiero Comprar una Propiedad</option>
                                                <option value="quiero-alquilar">Quiero Alquilar una Propiedad</option>
                                                <option value="quiero-vender">Quiero Vender mi Propiedad</option>
                                                <option value="quiero-alquilar-mi-propiedad">Quiero Alquilar mi Propiedad</option>
                                                <option value="tasacion">Solicitar tasación</option>
                                                <option value="inversion">Consulta sobre Inversiones</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                                                Asunto
                                            </label>
                                            <input
                                                type="text"
                                                id="subject"
                                                name="subject"
                                                value={formData.subject}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                                                Mensaje *
                                            </label>
                                            <textarea
                                                id="message"
                                                name="message"
                                                value={formData.message}
                                                onChange={handleInputChange}
                                                required
                                                rows={5}
                                                className="w-full px-3 py-2 border border-input rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring"
                                                placeholder="Cuéntanos cómo podemos ayudarte..."
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-4 w-4 mr-2" />
                                                    Enviar Mensaje
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </div>

                                {/* Contact Information */}
                                <div className="space-y-8">
                                    {/* Contact Details */}
                                    <div className="bg-card rounded-lg shadow-lg p-8">
                                        <h2 className="text-2xl font-bold text-foreground mb-6">
                                            Información de Contacto
                                        </h2>
                                        
                                        <div className="space-y-4">
                                            <div className="flex items-center">
                                                <Phone className="h-5 w-5 text-primary mr-3" />
                                                <div>
                                                    <p className="font-medium text-foreground">Teléfono</p>
                                                    <a href={`tel:${contactInfo.phone}`} className="text-primary hover:underline">
                                                        {contactInfo.phone}
                                                    </a>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center">
                                                <Mail className="h-5 w-5 text-primary mr-3" />
                                                <div>
                                                    <p className="font-medium text-foreground">Email</p>
                                                    <a href={`mailto:${contactInfo.email}`} className="text-primary hover:underline">
                                                        {contactInfo.email}
                                                    </a>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-start">
                                                <MapPin className="h-5 w-5 text-primary mr-3 mt-1" />
                                                <div>
                                                    <p className="font-medium text-foreground">Dirección</p>
                                                    <p className="text-muted-foreground">{contactInfo.address}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-start">
                                                <Clock className="h-5 w-5 text-primary mr-3 mt-1" />
                                                <div>
                                                    <p className="font-medium text-foreground">Horarios de Atención</p>
                                                    <p className="text-muted-foreground">{contactInfo.hours.weekdays}</p>
                                                    <p className="text-muted-foreground">{contactInfo.hours.saturday}</p>
                                                    <p className="text-muted-foreground">{contactInfo.hours.sunday}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* WhatsApp Button */}
                                    <div className="bg-success/10 border border-success/30 rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-foreground mb-3">
                                            ¿Necesitas una respuesta rápida?
                                        </h3>
                                        <p className="text-muted-foreground mb-4">
                                            Contáctanos por WhatsApp para una atención inmediata
                                        </p>
                                        <button
                                            onClick={handleWhatsAppClick}
                                            className="w-full bg-success text-success-foreground py-3 px-6 rounded-md hover:bg-success/90 transition-colors flex items-center justify-center"
                                        >
                                            <MessageCircle className="h-5 w-5 mr-2" />
                                            Escribir por WhatsApp
                                        </button>
                                    </div>

                                    {/* Map Placeholder */}
                                    <div className="bg-card rounded-lg shadow-lg p-8">
                                        <h3 className="text-lg font-semibold text-foreground mb-4">
                                            Nuestra Ubicación
                                        </h3>
                                        <div className="bg-muted h-64 rounded-lg flex items-center justify-center">
                                            <div className="text-center text-muted-foreground">
                                                <MapPin className="h-12 w-12 mx-auto mb-2" />
                                                <p>Mapa de ubicación</p>
                                                <p className="text-sm">(Integrar con Google Maps)</p>
                                            </div>
                                        </div>
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