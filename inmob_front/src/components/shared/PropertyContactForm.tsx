'use client';

import { useState } from 'react';
import { Property } from '@/types/property';
import { Phone, Mail, MessageSquare, Send } from 'lucide-react';

interface PropertyContactFormProps {
    property: Property;
}

export default function PropertyContactForm({ property }: PropertyContactFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: `Hola, estoy interesado en la propiedad "${property.title}" ubicada en ${property.location.address}. Me gustaría obtener más información.`,
        contactMethod: 'whatsapp'
    });
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.contactMethod === 'whatsapp') handleWhatsAppClick();
        else if (formData.contactMethod === 'email') handleEmailClick();
        else handleCallClick();
    };

    const handleWhatsAppClick = () => {
        // Usar mensaje custom si el usuario escribió uno, si no el default
        const messageText = formData.message ||
            `Hola, estoy interesado en la propiedad "${property.title}" ubicada en ${property.location.address}. Me gustaría obtener más información.`;
        const message = encodeURIComponent(messageText);
        // TODO: Reemplazar por tu número real de WhatsApp Business
        const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5491234567890';
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleCallClick = () => {
        // TODO: Reemplazar por tu teléfono real del negocio
        const phoneNumber = process.env.NEXT_PUBLIC_PHONE_NUMBER || '+5491234567890';
        window.open(`tel:${phoneNumber}`, '_self');
    };

    const handleEmailClick = () => {
        // TODO: Reemplazar por tu email real del negocio
        const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contacto@inmobiliaria.com';
        const subject = encodeURIComponent(`Consulta sobre: ${property.title}`);
        const body = encodeURIComponent(
            `Hola,\n\nEstoy interesado en la propiedad "${property.title}" ubicada en ${property.location.address}.\n\n${formData.message || 'Me gustaría obtener más información.'}\n\nSaludos,\n${formData.name || ''}`
        );
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
    };

    return (
        <div className="bg-muted rounded-lg p-6 space-y-6">
            <div>
                <h2 className="text-xl font-semibold mb-2">¿Interesado en esta propiedad?</h2>
                <p className="text-muted-foreground">
                    Contáctanos para más información o agenda una visita
                </p>
            </div>

            {/* Quick Contact Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                    onClick={handleWhatsAppClick}
                    type="button"
                    className="bg-success text-success-foreground hover:bg-success/90 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    <MessageSquare className="w-5 h-5" />
                    <span>WhatsApp</span>
                </button>
                <button
                    onClick={handleCallClick}
                    type="button"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    <Phone className="w-5 h-5" />
                    <span>Llamar</span>
                </button>
                <button
                    onClick={handleEmailClick}
                    type="button"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    <Mail className="w-5 h-5" />
                    <span>Email</span>
                </button>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-muted-foreground/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-muted px-3 text-muted-foreground">o envía un mensaje</span>
                </div>
            </div>

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Nombre *
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Tu nombre completo"
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium mb-2">
                            Teléfono *
                        </label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="+54 9 11 1234-5678"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email *
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="tu@email.com"
                    />
                </div>

                <div>
                    <label htmlFor="contactMethod" className="block text-sm font-medium mb-2">
                        Método de contacto preferido
                    </label>
                    <select
                        id="contactMethod"
                        name="contactMethod"
                        value={formData.contactMethod}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="phone">Teléfono</option>
                        <option value="email">Email</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-2">
                        Mensaje
                    </label>
                    <textarea
                        id="message"
                        name="message"
                        rows={4}
                        value={formData.message}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                        placeholder="Escribe tu consulta aquí..."
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                    <Send className="w-5 h-5" />
                    <span>Enviar consulta</span>
                </button>
            </form>
        </div>
    );
}