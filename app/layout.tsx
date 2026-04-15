import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Jason's Finance Dashboard",
  description: 'Private family finance dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" defer></script>
      </head>
      <body style={{margin:0,padding:0}}>{children}</body>
    </html>
  )
}
