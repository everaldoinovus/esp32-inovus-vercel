export const metadata = {
  title: 'INOVUS — Controle ESP32',
  description: 'Dashboard IoT para controle de ESP32 via MQTT',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
