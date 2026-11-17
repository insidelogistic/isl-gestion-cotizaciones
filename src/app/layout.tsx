import type { Metadata } from 'next';
import { Barlow, Poppins, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--fuente-titulos',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--fuente-textos',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fuente-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IN SIDE LOGISTIC | Gestión de Cotizaciones',
  description:
    'Sistema empresarial para registro de solicitudes, seguimiento de cotizaciones, gestión documental y cierres comerciales de IN SIDE LOGISTIC S.A. de C.V.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`h-full bg-[#F5F7FA] ${barlow.variable} ${poppins.variable} ${jetbrainsMono.variable}`}
    >
      <body className="h-full antialiased selection:bg-[#C72106] selection:text-white">
        {children}
      </body>
    </html>
  );
}
